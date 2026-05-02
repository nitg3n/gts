"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { SchoolCard } from "@/components/SchoolCard";
import { SEOUL_CENTER } from "@/lib/schools";
import type { School, SchoolDataSource, SchoolLevel } from "@/lib/types";
import {
  getStoredUserLocation,
  saveUserLocation,
  storedLocationLabel,
} from "@/lib/user-location";
import { cn } from "@/lib/utils";

type SchoolWithDistance = School & { distanceKm?: number };
type SchoolSearchResponse = {
  schools: SchoolWithDistance[];
  source?: SchoolDataSource | "none";
  usedRadiusKm?: number;
  message?: string;
};

type LocationState = "checking" | "picking" | "ready" | "needs-action";

const levelFilters: Array<{ label: string; value: SchoolLevel | "all" }> = [
  { label: "전체", value: "all" },
  { label: "중학교", value: "middle" },
  { label: "고등학교", value: "high" },
];

export function HomeExplorer() {
  const [schools, setSchools] = useState<SchoolWithDistance[]>([]);
  const [level, setLevel] = useState<SchoolLevel | "all">("all");
  const [center, setCenter] = useState(SEOUL_CENTER);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("현재 위치를 확인하는 중");
  const [locationState, setLocationState] = useState<LocationState>("checking");
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number }>();
  const [draftAccuracy, setDraftAccuracy] = useState<number>();

  const visibleSchools = useMemo(() => {
    const keyword = query.trim();

    return schools.filter((school) => {
      const matchesLevel = level === "all" || school.level === level;
      const matchesQuery =
        keyword.length === 0 ||
        school.name.includes(keyword) ||
        school.tags.some((tag) => tag.includes(keyword)) ||
        school.district.includes(keyword);

      return matchesLevel && matchesQuery;
    });
  }, [level, query, schools]);

  const loadSchoolsForLocation = useCallback(
    async (nextCenter: { lat: number; lng: number }, locationLabel: string) => {
      setSchools([]);
      setCenter(nextCenter);
      setLocationState("checking");
      setStatus("주변 학교를 찾는 중");

      try {
        const params = new URLSearchParams({
          lat: String(nextCenter.lat),
          lng: String(nextCenter.lng),
          radiusKm: "25",
        });
        const response = await fetch(`/api/schools?${params.toString()}`);
        const data = (await response.json()) as SchoolSearchResponse;

        if (!response.ok || data.schools.length === 0) {
          setSchools([]);
          setLocationState("needs-action");
          setStatus(data.message ?? "이 위치에서는 주변 학교를 찾지 못했습니다.");
          return;
        }

        setSchools(data.schools);
        setLocationState("ready");
        setStatus(`${getSourceLabel(data.source)} · ${locationLabel}`);
      } catch {
        setSchools([]);
        setLocationState("needs-action");
        setStatus("위치를 다시 확인해주세요.");
      }
    },
    [],
  );

  const refreshWithLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setSchools([]);
      setLocationState("needs-action");
      setStatus("브라우저 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setSchools([]);
    setLocationState("checking");
    setStatus("위치 확인 중");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        setCenter(nextCenter);
        setDraftLocation(nextCenter);
        setDraftAccuracy(position.coords.accuracy);
        setLocationState("picking");
        setStatus("지도에서 위치를 선택해주세요.");
      },
      () => {
        setSchools([]);
        setLocationState("needs-action");
        setStatus("위치 권한이 필요합니다.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const confirmDraftLocation = useCallback(async () => {
    if (!draftLocation) {
      await refreshWithLocation();
      return;
    }

    saveUserLocation(draftLocation, draftAccuracy);
    await loadSchoolsForLocation(draftLocation, "선택한 위치");
  }, [draftAccuracy, draftLocation, loadSchoolsForLocation, refreshWithLocation]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedLocation = getStoredUserLocation();

      if (storedLocation) {
        void loadSchoolsForLocation(
          storedLocation,
          storedLocationLabel(storedLocation),
        );
        return;
      }

      void refreshWithLocation();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSchoolsForLocation, refreshWithLocation]);

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:py-16">
          <div className="flex min-h-[420px] flex-col justify-center">
            <div>
              <h1 className="apple-title max-w-3xl text-6xl leading-[0.96] sm:text-7xl">
                학교로GO
              </h1>
              <p className="apple-copy mt-6 max-w-2xl text-xl">
                내게 맞는 학교로 가는 길.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/survey"
                  className="apple-button-primary h-12 gap-2 px-5 text-sm"
                >
                  <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  설문 시작
                </Link>
                {locationState === "ready" ? (
                  <button
                    type="button"
                    onClick={refreshWithLocation}
                    className="apple-button-secondary h-12 gap-2 px-5 text-sm"
                  >
                    <LocateFixed className="h-4 w-4" aria-hidden />
                    위치 변경
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div>
            {locationState === "ready" ? (
              <KakaoMap schools={visibleSchools} center={center} />
            ) : locationState === "picking" && draftLocation ? (
              <LocationPicker
                location={draftLocation}
                onChange={setDraftLocation}
                onConfirm={confirmDraftLocation}
              />
            ) : (
              <LocationPrompt
                status={status}
                canRetry={locationState === "needs-action"}
                onRetry={refreshWithLocation}
              />
            )}
          </div>
        </div>
      </section>

      {locationState === "ready" ? (
        <section className="apple-shell py-10 lg:py-12">
          <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--brand-primary)]">
                {status}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h2 className="apple-title text-3xl">주변 학교</h2>
                {visibleSchools.length > 0 ? (
                  <span className="pb-1 text-sm font-black text-[#86868b]">
                    {visibleSchools.length}곳
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="학교명, 지역, 관심사"
                  className="apple-field h-11 w-full pl-10 pr-4 text-sm sm:w-72"
                />
              </label>
              <div className="flex rounded-full border border-[var(--line-strong)] bg-white/78 p-1">
                {levelFilters.map((item) => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setLevel(item.value)}
                    className={cn(
                      "h-9 rounded-full px-3 text-sm font-black transition",
                      level === item.value
                        ? "bg-[#1d1d1f] text-white shadow-sm"
                        : "text-[#6e6e73] hover:bg-[var(--brand-primary-soft)] hover:text-[#1d1d1f]",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleSchools.length > 0 ? (
              visibleSchools.map((school) => (
                <SchoolCard
                  key={school.id}
                  school={school}
                  distanceKm={school.distanceKm}
                />
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyCandidateState />
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LocationPicker({
  location,
  onChange,
  onConfirm,
}: {
  location: { lat: number; lng: number };
  onChange: (location: { lat: number; lng: number }) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="apple-panel p-3">
      <KakaoMap
        schools={[]}
        center={location}
        centerMarkerLabel="선택할 위치"
        className="min-h-[340px] border-0 shadow-none"
        onCenterChange={onChange}
      />
      <button
        type="button"
        onClick={onConfirm}
        className="apple-button-primary mt-3 h-11 w-full gap-2 text-sm"
      >
        <LocateFixed className="h-4 w-4" aria-hidden />
        위치 선택
      </button>
    </div>
  );
}

function EmptyCandidateState() {
  return (
    <div className="apple-panel p-8 text-center">
      <h3 className="text-xl font-black text-[#1d1d1f]">
        조건에 맞는 학교가 없습니다.
      </h3>
      <p className="mt-2 text-sm font-semibold text-[#6e6e73]">
        검색어나 학교급 필터를 조정해보세요.
      </p>
    </div>
  );
}

function LocationPrompt({
  status,
  canRetry,
  onRetry,
}: {
  status: string;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="apple-panel grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <div className="apple-icon-bubble mx-auto h-12 w-12">
          <LocateFixed className="h-5 w-5" aria-hidden />
        </div>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-[#1d1d1f]">
          {canRetry ? "위치가 필요해요" : "위치 확인 중"}
        </h2>
        <p className="mt-3 max-w-md text-sm font-semibold leading-6 text-[#6e6e73]">
          {status}
        </p>
        {canRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="apple-button-primary mt-5 h-11 gap-2 px-4 text-sm"
          >
            <LocateFixed className="h-4 w-4" aria-hidden />
            위치 확인
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getSourceLabel(source?: SchoolDataSource | "none") {
  if (source === "kakao-neis") {
    return "실제 학교 정보 반영";
  }

  if (source === "kakao") {
    return "현재 위치 기준";
  }

  return "주변 학교";
}
