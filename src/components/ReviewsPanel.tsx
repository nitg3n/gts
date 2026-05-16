"use client";

import { useMemo, useState } from "react";
import { MessageSquarePlus, Star } from "lucide-react";
import type { SchoolReview } from "@/lib/types";

const ratingLabels: Array<{
  key: keyof SchoolReview["ratings"];
  label: string;
}> = [
  { key: "atmosphere", label: "분위기" },
  { key: "exams", label: "시험" },
  { key: "meals", label: "급식" },
  { key: "activities", label: "활동" },
  { key: "facilities", label: "시설" },
];

const defaultRatings: SchoolReview["ratings"] = {
  atmosphere: 4,
  exams: 4,
  meals: 4,
  activities: 4,
  facilities: 4,
};

export function ReviewsPanel({
  schoolId,
  initialReviews,
}: {
  schoolId: string;
  initialReviews: SchoolReview[];
}) {
  const [reviews, setReviews] = useState<SchoolReview[]>(initialReviews);
  const [authorName, setAuthorName] = useState("익명 학생");
  const [relation, setRelation] = useState<SchoolReview["relation"]>("current");
  const [enrolledYear, setEnrolledYear] = useState(new Date().getFullYear());
  const [graduatedYear, setGraduatedYear] = useState<number | undefined>();
  const [ratings, setRatings] =
    useState<SchoolReview["ratings"]>(defaultRatings);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");

  const ratingSummary = useMemo(() => {
    if (!reviews.length) {
      return undefined;
    }

    const total = reviews.reduce(
      (sum, review) => sum + getReviewAverage(review),
      0,
    );

    return total / reviews.length;
  }, [reviews]);

  async function submitReview() {
    if (body.trim().length < 12) {
      setStatus("리뷰는 최소 12자 이상 작성해주세요.");
      return;
    }

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        authorName,
        relation,
        enrolledYear,
        graduatedYear: relation === "graduate" ? graduatedYear : undefined,
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

    setStatus("리뷰가 바로 공개되었습니다.");
    setReviews((current) => [data.review!, ...current]);
    setBody("");
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="apple-eyebrow">Reviews</p>
          <h2 className="apple-title mt-2 text-3xl">재학생·졸업생 리뷰</h2>
        </div>
        {typeof ratingSummary === "number" ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-black text-[#1d1d1f] ring-1 ring-[var(--line)]">
            <Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" aria-hidden />
            {ratingSummary.toFixed(1)}
            <span className="text-[#86868b]">리뷰 {reviews.length}개</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {reviews.length ? (
            reviews.map((review) => (
              <article key={review.id} className="apple-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-[#1d1d1f]">
                      {review.authorName}
                    </div>
                    <div className="mt-1 text-sm font-bold text-[#86868b]">
                      {review.relation === "current" ? "재학생" : "졸업생"} ·{" "}
                      {review.enrolledYear} 입학
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full bg-[#fff7e8] px-3 py-1 text-sm font-black text-[#1d1d1f]">
                    <Star className="h-3.5 w-3.5 fill-[#ff9f0a] text-[#ff9f0a]" aria-hidden />
                    {getReviewAverage(review).toFixed(1)}
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#6e6e73]">
                  {review.body}
                </p>
              </article>
            ))
          ) : (
            <div className="apple-panel p-6 text-sm font-semibold leading-6 text-[#6e6e73]">
              아직 공개된 리뷰가 없습니다. 이 학교를 알고 있다면 첫 리뷰를 남겨주세요.
            </div>
          )}
        </div>

        <aside className="apple-panel p-5">
          <div className="flex items-center gap-2 text-lg font-black text-[#1d1d1f]">
            <MessageSquarePlus
              className="h-5 w-5 text-[var(--brand-primary)]"
              aria-hidden
            />
            리뷰 작성
          </div>
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            className="apple-field mt-4 h-10 w-full px-4 text-sm"
            aria-label="작성자 이름"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              value={relation}
              onChange={(event) =>
                setRelation(event.target.value as SchoolReview["relation"])
              }
              className="apple-field h-10 px-3 text-sm"
            >
              <option value="current">재학생</option>
              <option value="graduate">졸업생</option>
            </select>
            <input
              type="number"
              value={enrolledYear}
              onChange={(event) => setEnrolledYear(Number(event.target.value))}
              className="apple-field h-10 px-3 text-sm"
              aria-label="입학 연도"
            />
          </div>
          {relation === "graduate" ? (
            <input
              type="number"
              value={graduatedYear ?? ""}
              onChange={(event) =>
                setGraduatedYear(
                  event.target.value ? Number(event.target.value) : undefined,
                )
              }
              placeholder="졸업 연도"
              className="apple-field mt-3 h-10 w-full px-3 text-sm"
            />
          ) : null}

          <div className="mt-4 space-y-3">
            {ratingLabels.map((rating) => (
              <label key={rating.key} className="block">
                <div className="mb-1 flex items-center justify-between text-xs font-black text-[#6e6e73]">
                  <span>{rating.label}</span>
                  <span>{ratings[rating.key]}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={ratings[rating.key]}
                  onChange={(event) =>
                    setRatings((current) => ({
                      ...current,
                      [rating.key]: Number(event.target.value),
                    }))
                  }
                  className="w-full accent-[var(--brand-primary)]"
                />
              </label>
            ))}
          </div>

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="학교 분위기, 시험, 급식, 활동 경험"
            className="mt-4 min-h-32 w-full rounded-2xl border border-[#d2d2d7] bg-white/90 p-3 text-sm font-semibold leading-6 outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-ring)]"
          />
          <button
            type="button"
            onClick={submitReview}
            className="apple-button-primary mt-3 h-11 w-full text-sm"
          >
            리뷰 공개
          </button>
          <p className="mt-3 text-xs font-bold leading-5 text-[#86868b]">
            {status || "제출한 리뷰와 평점은 바로 공개됩니다."}
          </p>
        </aside>
      </div>
    </section>
  );
}

function getReviewAverage(review: SchoolReview) {
  const values = Object.values(review.ratings);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
