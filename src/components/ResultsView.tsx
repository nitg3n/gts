"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { SchoolCard } from "@/components/SchoolCard";
import type { StoredSurveyResponse } from "@/lib/types";
import { formatDistance } from "@/lib/utils";

export function ResultsView({ responseId }: { responseId: string }) {
  const [result, setResult] = useState<StoredSurveyResponse>();
  const [status, setStatus] = useState("추천 결과를 불러오는 중");

  useEffect(() => {
    fetch(`/api/recommendations/${responseId}`)
      .then((response) => response.json())
      .then((data: StoredSurveyResponse) => {
        setResult(data);
        setStatus("추천 결과");
      })
      .catch(() => setStatus("추천 결과를 불러오지 못했습니다."));
  }, [responseId]);

  if (!result) {
    return (
      <div className="apple-page grid min-h-[60vh] place-items-center px-4">
        <div className="text-center">
          <p className="apple-eyebrow">Results</p>
          <h1 className="apple-title mt-3 text-3xl">{status}</h1>
        </div>
      </div>
    );
  }

  const recommendations = result.recommendations.filter(
    (recommendation) => recommendation.school.level === "high",
  );
  const topThree = recommendations.slice(0, 3);
  const first = topThree[0];
  const compareSchools = topThree.map((item) => item.school);
  const topThreeIds = new Set(topThree.map((item) => item.school.id));
  const expandedRecommendations = recommendations
    .filter(
      (recommendation) =>
        recommendation.matchType === "expanded" &&
        !topThreeIds.has(recommendation.school.id),
    )
    .sort(
      (a, b) =>
        (b.semanticScore ?? b.score) - (a.semanticScore ?? a.score) ||
        (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, 3);

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid gap-8 py-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-16">
          <div>
            <p className="apple-eyebrow">{status}</p>
            <h1 className="apple-title mt-3 max-w-3xl text-5xl leading-[1.04] sm:text-6xl">
              지금 조건에서 가장 잘 맞는 학교.
            </h1>
            <div className="mt-6 flex flex-wrap gap-2">
              <Pill>
                학교급 고등학교
              </Pill>
              <Pill>거리 {distanceLabel(result.answer.distancePreference)}</Pill>
            </div>
          </div>

          <div className="apple-dark-panel p-6">
            <p className="text-sm font-bold text-white/62">먼저 살펴볼 학교</p>
            <p className="mt-3 text-3xl font-black leading-tight">
              {first?.school.name ?? "-"}
            </p>
            {first?.reasons[0] ? (
              <p className="mt-4 text-sm font-semibold leading-6 text-white/72">
                {first.reasons[0]}
              </p>
            ) : null}
            <CompareButton
              schools={compareSchools}
              navigateOnAdd
              className="mt-6 border-0 bg-white text-[#1d1d1f] hover:bg-[var(--brand-primary-soft)]"
            >
              상위 학교 비교
            </CompareButton>
          </div>
        </div>
      </section>

      <section className="apple-shell py-10 lg:py-12">
        <div className="grid gap-5 lg:grid-cols-3">
          {topThree.map((recommendation) => (
            <SchoolCard
              key={recommendation.school.id}
              school={recommendation.school}
              distanceKm={recommendation.distanceKm}
              reasons={recommendation.reasons}
              caution={recommendation.caution}
            />
          ))}
        </div>

        {expandedRecommendations.length ? (
          <section className="mt-10">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="apple-eyebrow">더 넓게 보기</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1d1d1f]">
                  조금 멀어도 조건이 강한 후보.
                </h2>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-[#6e6e73]">
                통학 거리는 따로 확인하되, 설문 응답과 학교 성격이 잘 맞는
                학교입니다.
              </p>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">
              {expandedRecommendations.map((recommendation) => (
                <SchoolCard
                  key={recommendation.school.id}
                  school={recommendation.school}
                  distanceKm={recommendation.distanceKm}
                  reasons={recommendation.reasons}
                  caution={recommendation.caution}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="apple-panel mt-8 overflow-hidden">
          <div className="grid grid-cols-[64px_1fr_96px] border-b border-[var(--line)] bg-white/48 px-4 py-3 text-xs font-black text-[#86868b] sm:grid-cols-[80px_1fr_140px]">
            <span>순위</span>
            <span>학교</span>
            <span className="text-right sm:text-left">거리</span>
          </div>
          {recommendations.map((recommendation) => (
            <Link
              key={recommendation.school.id}
              href={`/schools/${recommendation.school.id}`}
              className="apple-row-hover grid grid-cols-[64px_1fr_96px] items-center border-b border-[#f1f1f4] px-4 py-4 last:border-b-0 sm:grid-cols-[80px_1fr_140px]"
            >
              <span className="font-black text-[#1d1d1f]">
                #{recommendation.rank}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-black text-[#1d1d1f]">
                  {recommendation.school.name}
                </span>
                <span className="mt-1 flex items-start gap-2 text-sm font-semibold text-[#6e6e73]">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-none text-[#34c759]"
                    aria-hidden
                  />
                  <span className="line-clamp-2">{recommendation.reasons[0]}</span>
                </span>
              </span>
              <span className="text-right text-sm font-black text-[#6e6e73] sm:text-left">
                {formatDistance(recommendation.distanceKm)}
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Link href="/survey" className="apple-button-secondary h-11 gap-2 px-4 text-sm">
            설문 다시 하기
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="apple-chip apple-chip-brand px-3 py-1.5">{children}</span>;
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
