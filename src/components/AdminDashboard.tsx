"use client";

import { useEffect, useState } from "react";
import { Check, Shield, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { PublicRuntimeConfig, SchoolReview } from "@/lib/types";

export function AdminDashboard() {
  const [config, setConfig] = useState<PublicRuntimeConfig>();
  const [accessToken, setAccessToken] = useState<string>();
  const [reviews, setReviews] = useState<SchoolReview[]>([]);
  const [status, setStatus] = useState("관리자 세션을 확인하는 중");

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(async (runtimeConfig: PublicRuntimeConfig) => {
        setConfig(runtimeConfig);
        const supabase = createBrowserSupabaseClient(runtimeConfig);
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        setAccessToken(token);

        if (token) {
          await loadReviews(token);
        } else {
          setStatus("로그인한 관리자만 검수 목록을 볼 수 있습니다.");
        }
      })
      .catch(() => setStatus("관리자 설정을 불러오지 못했습니다."));
  }, []);

  async function loadReviews(token: string) {
    const response = await fetch("/api/admin/reviews", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = (await response.json()) as {
      reviews?: SchoolReview[];
      message?: string;
    };

    if (!response.ok || !data.reviews) {
      setStatus(data.message ?? "검수 목록을 불러오지 못했습니다.");
      return;
    }

    setReviews(data.reviews);
    setStatus(`리뷰 ${data.reviews.length}건`);
  }

  async function updateStatus(id: string, nextStatus: SchoolReview["status"]) {
    if (!accessToken) {
      return;
    }

    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.ok) {
      setReviews((current) =>
        current.map((review) =>
          review.id === id ? { ...review, status: nextStatus } : review,
        ),
      );
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-teal-700">
            <Shield className="h-4 w-4" aria-hidden />
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">
            설문·리뷰 관리
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
            첫 버전은 리뷰 검수 흐름과 설문 구조 확인을 중심으로 동작합니다.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <aside className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-black text-zinc-500">상태</div>
          <div className="mt-2 text-xl font-black text-zinc-950">{status}</div>
          <div className="mt-6 space-y-3 text-sm font-semibold text-zinc-600">
            <div>Supabase {config?.hasSupabase ? "연결됨" : "설정 필요"}</div>
            <div>검수 대기 {reviews.filter((review) => review.status === "pending").length}건</div>
            <div>승인 {reviews.filter((review) => review.status === "approved").length}건</div>
          </div>
        </aside>

        <main className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_120px_180px] border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
            <span>리뷰</span>
            <span>상태</span>
            <span>검수</span>
          </div>
          {reviews.map((review) => (
            <div
              key={review.id}
              className="grid grid-cols-[1fr_120px_180px] items-center border-b border-zinc-100 px-4 py-4 last:border-b-0"
            >
              <div>
                <div className="font-black text-zinc-950">{review.authorName}</div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
                  {review.body}
                </p>
              </div>
              <div className="text-sm font-black text-zinc-600">{review.status}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateStatus(review.id, "approved")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-700 text-white transition hover:bg-teal-800"
                  aria-label="승인"
                >
                  <Check className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(review.id, "rejected")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-white transition hover:bg-red-700"
                  aria-label="반려"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </main>
      </section>
    </div>
  );
}
