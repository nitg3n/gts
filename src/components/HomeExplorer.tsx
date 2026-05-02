"use client";

import { useMemo, useState } from "react";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { SchoolCard } from "@/components/SchoolCard";
import { SEOUL_CENTER } from "@/lib/schools";
import type { School, SchoolLevel } from "@/lib/types";
import { cn } from "@/lib/utils";

type SchoolWithDistance = School & { distanceKm?: number };

const levelFilters: Array<{ label: string; value: SchoolLevel | "all" }> = [
  { label: "전체", value: "all" },
  { label: "중학교", value: "middle" },
  { label: "고등학교", value: "high" },
];

export function HomeExplorer({ initialSchools }: { initialSchools: School[] }) {
  const [schools, setSchools] = useState<SchoolWithDistance[]>(initialSchools);
  const [level, setLevel] = useState<SchoolLevel | "all">("all");
  const [center, setCenter] = useState(SEOUL_CENTER);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("서울 중심 기준 추천 학교");

  const visibleSchools = useMemo(() => {
    return schools.filter((school) => {
      const matchesLevel = level === "all" || school.level === level;
      const matchesQuery =
        query.trim().length === 0 ||
        school.name.includes(query.trim()) ||
        school.tags.some((tag) => tag.includes(query.trim())) ||
        school.district.includes(query.trim());

      return matchesLevel && matchesQuery;
    });
  }, [level, query, schools]);

  async function refreshWithLocation() {
    if (!navigator.geolocation) {
      setStatus("브라우저 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setStatus("현재 위치를 확인하는 중");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCenter(nextCenter);

        const params = new URLSearchParams({
          lat: String(nextCenter.lat),
          lng: String(nextCenter.lng),
          radiusKm: "25",
        });
        const response = await fetch(`/api/schools?${params.toString()}`);
        const data = (await response.json()) as { schools: SchoolWithDistance[] };
        setSchools(data.schools);
        setStatus("현재 위치 기준 주변 학교");
      },
      () => setStatus("위치 권한 없이 서울 중심 기준으로 표시 중"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div className="flex min-h-[360px] flex-col justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-teal-700">
                학교 선택의 방향을 잡다
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-zinc-950 sm:text-6xl">
                내 조건에 맞는 학교로 가는 가장 선명한 길
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600">
                위치, 학교 공시 데이터, 재학생 리뷰, 설문 응답을 함께 반영해
                중학교와 고등학교를 비교합니다.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={refreshWithLocation}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-zinc-950 px-5 text-sm font-black text-white transition hover:bg-teal-700"
              >
                <LocateFixed className="h-4 w-4" aria-hidden />
                내 위치로 보기
              </button>
              <a
                href="/survey"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-zinc-300 px-5 text-sm font-black text-zinc-950 transition hover:border-teal-400 hover:bg-teal-50"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                설문 시작
              </a>
            </div>
          </div>
          <KakaoMap schools={visibleSchools} center={center} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-zinc-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-teal-700">{status}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">
              추천 후보 {visibleSchools.length}개
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="학교명, 지역, 관심사"
                className="h-11 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100 sm:w-72"
              />
            </label>
            <div className="flex rounded-md border border-zinc-300 bg-white p-1">
              {levelFilters.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setLevel(item.value)}
                  className={cn(
                    "h-9 rounded px-3 text-sm font-black transition",
                    level === item.value
                      ? "bg-zinc-950 text-white"
                      : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSchools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              distanceKm={school.distanceKm}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
