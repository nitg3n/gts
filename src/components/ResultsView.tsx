"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Scale } from "lucide-react";
import { SchoolCard } from "@/components/SchoolCard";
import type { StoredSurveyResponse } from "@/lib/types";
import { formatDistance, metricLabel } from "@/lib/utils";

export function ResultsView({ responseId }: { responseId: string }) {
  const [result, setResult] = useState<StoredSurveyResponse>();
  const [status, setStatus] = useState("추천 결과를 불러오는 중");

  useEffect(() => {
    fetch(`/api/recommendations/${responseId}`)
      .then((response) => response.json())
      .then((data: StoredSurveyResponse) => {
        setResult(data);
        setStatus(data.id === "demo" ? "샘플 추천 결과" : "설문 기반 추천 결과");
      })
      .catch(() => setStatus("추천 결과를 불러오지 못했습니다."));
  }, [responseId]);

  if (!result) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-zinc-50 px-4">
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
            Results
          </p>
          <h1 className="mt-3 text-3xl font-black text-zinc-950">{status}</h1>
        </div>
      </div>
    );
  }

  const topThree = result.recommendations.slice(0, 3);
  const compareIds = topThree.map((item) => item.school.id).join(",");

  return (
    <div className="min-h-screen bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
              {status}
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
              지금 조건에서 가장 잘 맞는 학교
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
              거리 선호와 선택한 기준을 가중치로 바꿔 학교별 매칭도를 계산했습니다.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>학교급 {result.answer.level === "all" ? "전체" : result.answer.level === "middle" ? "중학교" : "고등학교"}</Pill>
              <Pill>거리 {distanceLabel(result.answer.distancePreference)}</Pill>
              {result.answer.priorities.map((priority) => (
                <Pill key={priority}>{metricLabel(priority)}</Pill>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-950 p-5 text-white">
            <BarChart3 className="h-6 w-6 text-cyan-300" aria-hidden />
            <p className="mt-4 text-sm font-bold text-zinc-300">Top match</p>
            <div className="mt-2 text-6xl font-black">
              {topThree[0]?.score ?? 0}
            </div>
            <p className="mt-3 text-xl font-black">{topThree[0]?.school.name}</p>
            <Link
              href={`/compare?ids=${compareIds}`}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-black text-zinc-950 transition hover:bg-cyan-100"
            >
              상위 학교 비교
              <Scale className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {topThree.map((recommendation) => (
            <SchoolCard
              key={recommendation.school.id}
              school={recommendation.school}
              distanceKm={recommendation.distanceKm}
              score={recommendation.score}
              reason={recommendation.reasons[0]}
            />
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="grid grid-cols-[80px_1fr_120px_140px] border-b border-zinc-200 bg-zinc-100 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">
            <span>순위</span>
            <span>학교</span>
            <span>매칭도</span>
            <span>거리</span>
          </div>
          {result.recommendations.map((recommendation) => (
            <Link
              key={recommendation.school.id}
              href={`/schools/${recommendation.school.id}`}
              className="grid grid-cols-[80px_1fr_120px_140px] items-center border-b border-zinc-100 px-4 py-4 transition last:border-b-0 hover:bg-teal-50"
            >
              <span className="font-black text-zinc-950">#{recommendation.rank}</span>
              <span>
                <span className="block font-black text-zinc-950">
                  {recommendation.school.name}
                </span>
                <span className="mt-1 flex items-center gap-2 text-sm text-zinc-600">
                  <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden />
                  {recommendation.reasons[0]}
                </span>
              </span>
              <span className="text-2xl font-black text-zinc-950">
                {recommendation.score}
              </span>
              <span className="font-bold text-zinc-600">
                {formatDistance(recommendation.distanceKm)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-black text-zinc-700">
      {children}
    </span>
  );
}

function distanceLabel(value: StoredSurveyResponse["answer"]["distancePreference"]) {
  if (value === "near") {
    return "가까운 곳";
  }
  if (value === "not-important") {
    return "상관없음";
  }
  return "균형";
}
