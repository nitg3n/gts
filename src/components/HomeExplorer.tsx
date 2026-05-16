"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LocateFixed,
  MapPinned,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { SchoolCard } from "@/components/SchoolCard";
import { SEOUL_CENTER } from "@/lib/schools";
import type { School, SchoolLevel } from "@/lib/types";
import {
  getStoredUserLocation,
  saveUserLocation,
  storedLocationLabel,
} from "@/lib/user-location";
import { cn, formatDistance } from "@/lib/utils";

type SchoolWithDistance = School & { distanceKm?: number };
type SchoolSearchResponse = {
  schools: SchoolWithDistance[];
  usedRadiusKm?: number;
  message?: string;
};

type LocationState = "checking" | "picking" | "ready" | "needs-action";

const levelFilters: Array<{ label: string; value: SchoolLevel }> = [
  { label: "중학교", value: "middle" },
  { label: "고등학교", value: "high" },
];

export function HomeExplorer() {
  const [schools, setSchools] = useState<SchoolWithDistance[]>([]);
  const [level, setLevel] = useState<SchoolLevel>("high");
  const [center, setCenter] = useState(SEOUL_CENTER);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("위치 조정을 눌러 주변 학교를 찾으세요.");
  const [locationState, setLocationState] =
    useState<LocationState>("needs-action");
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number }>();
  const [draftAccuracy, setDraftAccuracy] = useState<number>();

  const levelSchools = useMemo(
    () => schools.filter((school) => school.level === level),
    [level, schools],
  );
  const rankedSchools = useMemo(() => levelSchools.slice(0, 3), [levelSchools]);
  const visibleSchools = useMemo(() => {
    const keyword = query.trim();

    return levelSchools.filter((school) => {
      const matchesQuery =
        keyword.length === 0 ||
        school.name.includes(keyword) ||
        school.tags.some((tag) => tag.includes(keyword)) ||
        school.district.includes(keyword);

      return matchesQuery;
    });
  }, [levelSchools, query]);

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
        setStatus(`${locationLabel} 주변 학교`);
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
      (error) => {
        setSchools([]);
        setLocationState("needs-action");
        setStatus(
          error.code === error.PERMISSION_DENIED
            ? "브라우저 위치 권한을 허용한 뒤 다시 눌러주세요."
            : "위치를 다시 확인해주세요.",
        );
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

      setSchools([]);
      setLocationState("needs-action");
      setStatus("위치 조정을 눌러 주변 학교를 찾으세요.");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSchoolsForLocation]);

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid max-w-[96rem] gap-6 py-10 lg:min-h-[620px] lg:grid-cols-[250px_minmax(480px,680px)_minmax(360px,500px)] lg:items-center lg:gap-8 xl:gap-10">
          <div className="flex flex-col justify-center">
            <h1 className="apple-title text-5xl leading-none sm:text-[3.25rem]">
              학교로GO
            </h1>
            <p className="apple-copy mt-5 text-xl leading-8">
              내게 맞는 학교로 가는 길.
            </p>
            <Link
              href="/survey"
              className="apple-button-primary mt-12 h-14 w-fit gap-2 px-8 text-lg"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              설문 시작
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <MainMapStage
              locationState={locationState}
              center={center}
              draftLocation={draftLocation}
              schools={levelSchools}
              status={status}
              onDraftChange={setDraftLocation}
            />
            <button
              type="button"
              onClick={
                locationState === "picking"
                  ? confirmDraftLocation
                  : refreshWithLocation
              }
              className="apple-button-secondary h-14 gap-2 px-5 text-lg"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
              {locationState === "picking" ? "위치 선택" : "위치 조정"}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <LocationRankList
              schools={rankedSchools}
              isReady={locationState === "ready"}
              level={level}
            />
            <LevelSwitcher value={level} onChange={setLevel} />
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
                <h2 className="apple-title text-3xl">
                  {level === "middle" ? "중학교" : "고등학교"} 목록
                </h2>
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

function MainMapStage({
  locationState,
  center,
  draftLocation,
  schools,
  status,
  onDraftChange,
}: {
  locationState: LocationState;
  center: { lat: number; lng: number };
  draftLocation?: { lat: number; lng: number };
  schools: School[];
  status: string;
  onDraftChange: (location: { lat: number; lng: number }) => void;
}) {
  if (locationState === "ready") {
    return (
      <KakaoMap
        schools={schools}
        center={center}
        className="h-[360px] min-h-0 lg:h-[400px]"
      />
    );
  }

  if (locationState === "picking" && draftLocation) {
    return (
      <KakaoMap
        schools={[]}
        center={draftLocation}
        centerMarkerLabel="선택할 위치"
        className="h-[360px] min-h-0 lg:h-[400px]"
        onCenterChange={onDraftChange}
      />
    );
  }

  return <MapPlaceholder status={status} isChecking={locationState === "checking"} />;
}

function MapPlaceholder({
  status,
  isChecking,
}: {
  status: string;
  isChecking: boolean;
}) {
  return (
    <div className="relative grid h-[360px] min-h-0 place-items-center overflow-hidden rounded-[26px] border border-[var(--line)] bg-[#eef1ec] p-8 text-center shadow-[0_18px_48px_rgba(29,29,31,0.08)] lg:h-[400px]">
      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/5 to-transparent" />
      <div className="relative">
        <div className="apple-icon-bubble mx-auto h-12 w-12">
          <MapPinned className="h-5 w-5" aria-hidden />
        </div>
        <p className="apple-eyebrow mt-4">Map</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1d1d1f]">
          {isChecking ? "위치 확인 중" : "맵"}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6e6e73]">
          {status}
        </p>
      </div>
    </div>
  );
}

function LocationRankList({
  schools,
  isReady,
  level,
}: {
  schools: SchoolWithDistance[];
  isReady: boolean;
  level: SchoolLevel;
}) {
  const placeholders = [1, 2, 3];

  return (
    <div>
      <p className="mb-4 pl-2 text-lg font-black text-[var(--brand-primary)]">
        주변 학교 정보
      </p>
      <div className="grid gap-4">
        {placeholders.map((rank) => {
          const school = schools[rank - 1];

          if (!isReady || !school) {
            return (
              <div
                key={rank}
                className="flex h-24 flex-col justify-center rounded-[24px] border border-[var(--line)] bg-white/78 px-7 shadow-[0_10px_28px_rgba(29,29,31,0.045)]"
              >
                <span className="text-base font-black text-[var(--brand-primary)]">
                  {getLevelLabel(level)} {rank}
                </span>
                <span className="mt-2 text-xl font-black text-[#86868b]">
                  위치 조정 후 표시
                </span>
              </div>
            );
          }

          return (
            <Link
              key={school.id}
              href={`/schools/${school.id}`}
              className="group flex h-24 items-center justify-between gap-4 rounded-[24px] border border-[var(--line)] bg-white/92 px-7 shadow-[0_10px_28px_rgba(29,29,31,0.05)] transition hover:border-[rgba(70,138,87,0.36)] hover:bg-[var(--brand-primary-soft)]"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-black text-[var(--brand-primary)]">
                    선택된 위치로부터 {formatDistance(school.distanceKm)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-3xl font-black leading-tight text-[#1d1d1f]">
                  {school.name}
                </span>
              </span>
              <ArrowRight
                className="h-5 w-5 shrink-0 text-[#86868b] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-primary)]"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function LevelSwitcher({
  value,
  onChange,
}: {
  value: SchoolLevel;
  onChange: (level: SchoolLevel) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {levelFilters.map((item) => (
        <button
          type="button"
          key={item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "h-14 rounded-[22px] border px-4 text-2xl font-black transition",
            value === item.value
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_14px_34px_rgba(70,138,87,0.2)]"
              : "border-[var(--line-strong)] bg-white/78 text-[#1d1d1f] hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)]",
          )}
        >
          {item.label}
        </button>
      ))}
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

function getLevelLabel(level: SchoolLevel) {
  return level === "middle" ? "중학교" : "고등학교";
}
