"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LocateFixed } from "lucide-react";
import type { SchoolLevel, SchoolMetricKey } from "@/lib/types";
import { cn, metricLabel } from "@/lib/utils";

const priorities: SchoolMetricKey[] = [
  "academics",
  "activities",
  "environment",
  "meal",
  "reviews",
  "stability",
];

const tags = [
  "진학",
  "동아리",
  "상담",
  "급식",
  "과학",
  "AI",
  "실습",
  "통학",
  "분위기",
  "독서",
];

export function SurveyForm() {
  const router = useRouter();
  const [level, setLevel] = useState<SchoolLevel | "all">("all");
  const [distancePreference, setDistancePreference] =
    useState<"near" | "balanced" | "not-important">("balanced");
  const [selectedPriorities, setSelectedPriorities] = useState<SchoolMetricKey[]>([
    "activities",
    "environment",
    "academics",
  ]);
  const [preferredTags, setPreferredTags] = useState<string[]>(["동아리"]);
  const [location, setLocation] = useState<{ lat: number; lng: number }>();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function togglePriority(priority: SchoolMetricKey) {
    setSelectedPriorities((current) => {
      if (current.includes(priority)) {
        return current.filter((item) => item !== priority);
      }

      return [...current, priority].slice(-3);
    });
  }

  function toggleTag(tag: string) {
    setPreferredTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag].slice(0, 5),
    );
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus("브라우저 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setStatus("위치를 확인하는 중");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("위치가 반영됐습니다.");
      },
      () => setStatus("위치 없이 추천을 계산합니다."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submitSurvey() {
    setSubmitting(true);
    setStatus("추천을 계산하는 중");

    const response = await fetch("/api/survey-responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        level,
        distancePreference,
        priorities: selectedPriorities,
        preferredTags,
        ...location,
      }),
    });

    const data = (await response.json()) as { id?: string; message?: string };

    if (!response.ok || !data.id) {
      setStatus(data.message ?? "추천 계산에 실패했습니다.");
      setSubmitting(false);
      return;
    }

    router.push(`/results/${data.id}`);
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
          Matching Survey
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950">
          학교 추천 기준을 선택하세요
        </h1>
        <p className="mt-4 text-base leading-7 text-zinc-600">
          답변은 학교별 지표 가중치로 변환되어 추천 순위와 추천 이유에 반영됩니다.
        </p>
      </aside>

      <main className="space-y-5">
        <SurveyBlock title="학교급">
          <Segmented
            value={level}
            onChange={(value) => setLevel(value as SchoolLevel | "all")}
            items={[
              ["all", "전체"],
              ["middle", "중학교"],
              ["high", "고등학교"],
            ]}
          />
        </SurveyBlock>

        <SurveyBlock title="통학 거리">
          <Segmented
            value={distancePreference}
            onChange={(value) =>
              setDistancePreference(
                value as "near" | "balanced" | "not-important",
              )
            }
            items={[
              ["near", "가까운 곳"],
              ["balanced", "균형"],
              ["not-important", "상관없음"],
            ]}
          />
          <button
            type="button"
            onClick={captureLocation}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-black text-zinc-800 transition hover:border-teal-400 hover:bg-teal-50"
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            위치 반영
          </button>
        </SurveyBlock>

        <SurveyBlock title="중요한 기준">
          <div className="grid gap-2 sm:grid-cols-2">
            {priorities.map((priority) => (
              <ToggleChip
                key={priority}
                active={selectedPriorities.includes(priority)}
                onClick={() => togglePriority(priority)}
              >
                {metricLabel(priority)}
              </ToggleChip>
            ))}
          </div>
        </SurveyBlock>

        <SurveyBlock title="관심사">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <ToggleChip
                key={tag}
                active={preferredTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </ToggleChip>
            ))}
          </div>
        </SurveyBlock>

        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-zinc-500">{status}</p>
          <button
            type="button"
            onClick={submitSurvey}
            disabled={submitting}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            추천 결과 보기
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </main>
    </div>
  );
}

function SurveyBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Segmented({
  value,
  onChange,
  items,
}: {
  value: string;
  onChange: (value: string) => void;
  items: Array<[string, string]>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map(([itemValue, label]) => (
        <button
          key={itemValue}
          type="button"
          onClick={() => onChange(itemValue)}
          className={cn(
            "h-11 rounded-md border text-sm font-black transition",
            value === itemValue
              ? "border-zinc-950 bg-zinc-950 text-white"
              : "border-zinc-300 bg-white text-zinc-700 hover:border-teal-400 hover:bg-teal-50",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-md border px-4 text-sm font-black transition",
        active
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-zinc-300 bg-white text-zinc-700 hover:border-teal-400 hover:bg-teal-50",
      )}
    >
      {children}
    </button>
  );
}
