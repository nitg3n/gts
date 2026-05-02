"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Star } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { PublicRuntimeConfig, SchoolReview } from "@/lib/types";

const ratingLabels = [
  ["atmosphere", "분위기"],
  ["exams", "시험"],
  ["meals", "급식"],
  ["activities", "활동"],
  ["facilities", "시설"],
] as const;

export function ReviewsPanel({
  schoolId,
  initialReviews,
}: {
  schoolId: string;
  initialReviews: SchoolReview[];
}) {
  const [reviews, setReviews] = useState(initialReviews);
  const [config, setConfig] = useState<PublicRuntimeConfig>();
  const [accessToken, setAccessToken] = useState<string>();
  const [authorName, setAuthorName] = useState("익명 학생");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [ratings, setRatings] = useState({
    atmosphere: 4,
    exams: 3,
    meals: 4,
    activities: 4,
    facilities: 4,
  });

  const average = useMemo(() => {
    if (reviews.length === 0) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => {
      const values = Object.values(review.ratings);
      return sum + values.reduce((itemSum, value) => itemSum + value, 0) / values.length;
    }, 0);

    return total / reviews.length;
  }, [reviews]);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(async (runtimeConfig: PublicRuntimeConfig) => {
        setConfig(runtimeConfig);
        const supabase = createBrowserSupabaseClient(runtimeConfig);
        const session = await supabase?.auth.getSession();
        setAccessToken(session?.data.session?.access_token);
      })
      .catch(() => setStatus("로그인 상태를 확인하지 못했습니다."));
  }, []);

  async function submitReview() {
    if (!accessToken) {
      setStatus("로그인 후 리뷰를 작성할 수 있습니다.");
      return;
    }

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        schoolId,
        authorName,
        relation: "current",
        enrolledYear: new Date().getFullYear(),
        ratings,
        body,
      }),
    });

    const data = (await response.json()) as {
      review?: SchoolReview;
      message?: string;
    };

    if (!response.ok || !data.review) {
      setStatus(data.message ?? "리뷰 저장에 실패했습니다.");
      return;
    }

    setStatus("리뷰가 검수 대기 상태로 저장됐습니다.");
    setBody("");
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
            Reviews
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">
            재학생·졸업생 리뷰
          </h2>
        </div>
        <div className="rounded-md bg-zinc-950 px-4 py-3 text-white">
          <div className="text-xs font-bold text-zinc-300">평균</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-black">
            <Star className="h-5 w-5 fill-cyan-300 text-cyan-300" aria-hidden />
            {average ? average.toFixed(1) : "-"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-black text-zinc-950">{review.authorName}</div>
                <div className="text-sm font-bold text-zinc-500">
                  {review.relation === "current" ? "재학생" : "졸업생"} ·{" "}
                  {review.enrolledYear} 입학
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{review.body}</p>
            </article>
          ))}
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-lg font-black text-zinc-950">
            <MessageSquarePlus className="h-5 w-5 text-teal-700" aria-hidden />
            리뷰 작성
          </div>
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            className="mt-4 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm font-semibold outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
          <div className="mt-4 space-y-3">
            {ratingLabels.map(([key, label]) => (
              <label key={key} className="block">
                <div className="mb-1 text-xs font-black text-zinc-600">{label}</div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={ratings[key]}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [key]: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-teal-700"
                />
              </label>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="학교 분위기, 시험, 급식, 활동 경험"
            className="mt-4 min-h-32 w-full rounded-md border border-zinc-300 p-3 text-sm font-medium leading-6 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
          />
          <button
            type="button"
            onClick={submitReview}
            className="mt-3 h-11 w-full rounded-md bg-zinc-950 text-sm font-black text-white transition hover:bg-teal-700"
          >
            검수 요청
          </button>
          <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">
            {status ||
              (config?.hasSupabase
                ? "로그인 세션이 있으면 제출됩니다."
                : "Supabase 설정이 필요합니다.")}
          </p>
        </aside>
      </div>
    </section>
  );
}
