"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  LocateFixed,
  MapPinned,
  Search,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { SchoolEmblem } from "@/components/SchoolEmblem";
import { SchoolCard } from "@/components/SchoolCard";
import { SurveyForm } from "@/components/SurveyForm";
import {
  clearLatestSurveyResponseId,
  getLatestSurveyResponseId,
  getLatestSurveyResult,
  saveLatestSurveyResult,
} from "@/lib/latest-survey-result";
import { SEOUL_CENTER } from "@/lib/schools";
import type { Recommendation, School, StoredSurveyResponse } from "@/lib/types";
import { saveUserLocation } from "@/lib/user-location";
import { cn, formatDistance } from "@/lib/utils";

type SchoolWithDistance = School & { distanceKm?: number };
type SchoolSearchResponse = {
  schools: SchoolWithDistance[];
  usedRadiusKm?: number;
  message?: string;
};

type LocationState = "checking" | "picking" | "ready" | "needs-action";
type HomeStage = "checking-survey" | "survey" | "ready";

export function HomeExplorer() {
  const [schools, setSchools] = useState<SchoolWithDistance[]>([]);
  const [surveyResult, setSurveyResult] = useState<StoredSurveyResponse>();
  const [homeStage, setHomeStage] = useState<HomeStage>("checking-survey");
  const [latestResponseId, setLatestResponseId] = useState<string>();
  const [center, setCenter] = useState(SEOUL_CENTER);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("위치 조정을 눌러 주변 학교를 찾으세요.");
  const [locationState, setLocationState] =
    useState<LocationState>("needs-action");
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number }>();
  const [draftAccuracy, setDraftAccuracy] = useState<number>();

  const recommendations = useMemo(
    () =>
      (surveyResult?.recommendations ?? []).filter(
        (recommendation) => recommendation.school.level === "high",
      ),
    [surveyResult],
  );
  const rankedRecommendations = useMemo(
    () => recommendations.slice(0, 3),
    [recommendations],
  );
  const firstRecommendation = rankedRecommendations[0];
  const visibleRecommendations = useMemo(() => {
    const keyword = query.trim();

    return recommendations.filter((recommendation) => {
      const school = recommendation.school;
      const matchesQuery =
        keyword.length === 0 ||
        school.name.includes(keyword) ||
        school.tags.some((tag) => tag.includes(keyword)) ||
        school.district.includes(keyword) ||
        recommendation.reasons.some((reason) => reason.includes(keyword));

      return matchesQuery;
    });
  }, [query, recommendations]);

  const applySurveyResult = useCallback((data: StoredSurveyResponse) => {
    const highSchoolRecommendations = data.recommendations.filter(
      (recommendation) => recommendation.school.level === "high",
    );
    const firstSchool = highSchoolRecommendations[0]?.school;
    const answerLocation =
      typeof data.answer.lat === "number" && typeof data.answer.lng === "number"
        ? { lat: data.answer.lat, lng: data.answer.lng }
        : undefined;

    setLatestResponseId(data.id);
    setSurveyResult(data);
    setSchools(
      highSchoolRecommendations.map((recommendation) => ({
        ...recommendation.school,
        distanceKm: recommendation.distanceKm,
      })),
    );
    setCenter(answerLocation ?? firstSchool ?? SEOUL_CENTER);
    setLocationState("ready");
    setStatus("설문 결과 기반 추천");
    setHomeStage("ready");
  }, []);

  const loadSurveyResult = useCallback(async (
    responseId: string,
    options: { preserveView?: boolean } = {},
  ) => {
    const cachedResult = getLatestSurveyResult();
    const canUseCachedResult = cachedResult?.id === responseId;

    if (canUseCachedResult) {
      applySurveyResult(cachedResult);
    } else {
      setLatestResponseId(responseId);
      setStatus("추천 결과를 불러오는 중");

      if (!options.preserveView) {
        setHomeStage("checking-survey");
      }
    }

    try {
      const response = await fetch(`/api/recommendations/${responseId}`);
      const data = (await response.json()) as StoredSurveyResponse;

      if (!response.ok || !Array.isArray(data.recommendations)) {
        throw new Error("Invalid recommendation response");
      }

      saveLatestSurveyResult(data);
      applySurveyResult(data);
    } catch {
      if (canUseCachedResult) {
        applySurveyResult(cachedResult);
        return;
      }

      clearLatestSurveyResponseId();
      setLatestResponseId(undefined);
      setSurveyResult(undefined);
      setSchools([]);
      setLocationState("needs-action");
      setStatus("설문을 먼저 진행해주세요.");
      setHomeStage("survey");
    }
  }, [applySurveyResult]);

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
          level: "high",
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

  const recomputeSurveyForLocation = useCallback(
    async (nextCenter: { lat: number; lng: number }) => {
      if (!surveyResult) {
        await loadSchoolsForLocation(nextCenter, "선택한 위치");
        return;
      }

      setStatus("새 위치로 추천을 다시 계산하는 중");
      setLocationState("checking");

      try {
        const response = await fetch("/api/survey-responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...surveyResult.answer,
            lat: nextCenter.lat,
            lng: nextCenter.lng,
          }),
        });
        const data = (await response.json()) as Partial<StoredSurveyResponse> & {
          message?: string;
        };

        if (
          !response.ok ||
          !data.id ||
          !data.answer ||
          !data.createdAt ||
          !Array.isArray(data.recommendations)
        ) {
          setStatus(data.message ?? "추천을 다시 계산하지 못했습니다.");
          setLocationState("ready");
          return;
        }

        saveLatestSurveyResult(data as StoredSurveyResponse);
        await loadSurveyResult(data.id, { preserveView: true });
      } catch {
        setStatus("추천을 다시 계산하지 못했습니다.");
        setLocationState("ready");
      }
    },
    [loadSchoolsForLocation, loadSurveyResult, surveyResult],
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
    setDraftLocation(undefined);
    setDraftAccuracy(undefined);
    await recomputeSurveyForLocation(draftLocation);
  }, [
    draftAccuracy,
    draftLocation,
    recomputeSurveyForLocation,
    refreshWithLocation,
  ]);

  const startSurveyAgain = useCallback(() => {
    clearLatestSurveyResponseId();
    setLatestResponseId(undefined);
    setSurveyResult(undefined);
    setSchools([]);
    setQuery("");
    setLocationState("needs-action");
    setStatus("새 설문으로 추천을 다시 계산합니다.");
    setHomeStage("survey");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const responseId = getLatestSurveyResponseId();

      if (responseId) {
        void loadSurveyResult(responseId);
        return;
      }

      setSchools([]);
      setLocationState("needs-action");
      setStatus("설문을 먼저 진행해주세요.");
      setHomeStage("survey");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadSurveyResult]);

  if (homeStage === "checking-survey") {
    return (
      <div className="apple-page grid min-h-[60vh] place-items-center px-4">
        <div className="text-center">
          <p className="apple-eyebrow">학교로GO</p>
          <h1 className="apple-title mt-3 text-3xl">
            추천 기준을 확인하는 중
          </h1>
        </div>
      </div>
    );
  }

  if (homeStage === "survey") {
    return <SurveyForm />;
  }

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell grid max-w-[88rem] gap-6 py-8 lg:min-h-[500px] lg:grid-cols-[250px_minmax(420px,560px)_minmax(330px,400px)] lg:items-center lg:gap-7 xl:gap-9">
          <div className="flex flex-col justify-center">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSds5GVKRUvHpCC9ZNXu28qFoUa9qoFktwhShTilKZxdlAGYdA/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="apple-button-primary mt-5 h-11 w-fit gap-2 px-5 mb-5 text-sm inline-flex items-center"
            >
              <h1 className="text-[0.25rem] leading-none tracking-normal text-[#ffffff] sm:text-[1rem]">
              사용 후기 설문하러 가기
              </h1>
            </a>
            <h1 className="text-[2rem] font-extrabold leading-none tracking-normal text-[#1d1d1f] sm:text-[2.35rem]">
              학교로GO
            </h1>
            <p className="mt-3 text-base font-bold leading-7 text-[#6e6e73]">
              내게 맞는 학교로 가는 길.
            </p>
            <HomeCriterionSummary
              result={surveyResult}
              firstRecommendation={firstRecommendation}
            />
            <button
              type="button"
              onClick={startSurveyAgain}
              className="apple-button-primary mt-5 h-11 w-fit gap-2 px-5 text-sm"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              설문 다시 하기
            </button>
            {latestResponseId ? (
              <Link
                href={`/results/${latestResponseId}`}
                className="mt-3 inline-flex w-fit items-center gap-2 text-sm font-extrabold text-[var(--brand-primary)]"
              >
                전체 결과 보기
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <MainMapStage
              locationState={locationState}
              center={center}
              draftLocation={draftLocation}
              schools={schools}
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
              className="apple-button-secondary h-12 gap-2 px-5 text-base"
            >
              <LocateFixed className="h-4 w-4" aria-hidden />
              {locationState === "picking" ? "위치 선택" : "위치 조정"}
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <RecommendationRankList
              recommendations={rankedRecommendations}
              isReady={locationState === "ready"}
            />
          </div>
        </div>
      </section>

      {locationState === "ready" ? (
        <section className="apple-shell py-10 lg:py-12">
          <div className="flex flex-col gap-5 border-b border-[var(--line)] pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-extrabold text-[var(--brand-primary)]">
                {status}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h2 className="apple-title text-3xl">
                  추천 학교 목록
                </h2>
                {visibleRecommendations.length > 0 ? (
                  <span className="pb-1 text-sm font-extrabold text-[#86868b]">
                    {visibleRecommendations.length}곳
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
            {visibleRecommendations.length > 0 ? (
              visibleRecommendations.map((recommendation) => (
                <SchoolCard
                  key={recommendation.school.id}
                  school={recommendation.school}
                  distanceKm={recommendation.distanceKm}
                  reasons={recommendation.reasons}
                  caution={recommendation.caution}
                  evidence={recommendation.evidence}
                  graduationOutcome={recommendation.graduationOutcome}
                  score={recommendation.score}
                  semanticScore={recommendation.semanticScore}
                  distanceScore={recommendation.distanceScore}
                  confidence={recommendation.confidence}
                  dimensionScores={recommendation.dimensionScores}
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
        className="h-[320px] min-h-0 lg:h-[360px]"
      />
    );
  }

  if (locationState === "picking" && draftLocation) {
    return (
      <KakaoMap
        schools={[]}
        center={draftLocation}
        centerMarkerLabel="선택할 위치"
        className="h-[320px] min-h-0 lg:h-[360px]"
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
    <div className="relative grid h-[320px] min-h-0 place-items-center overflow-hidden rounded-[22px] border border-[var(--line)] bg-[#eef1ec] p-8 text-center shadow-[0_10px_26px_rgba(29,29,31,0.05)] lg:h-[360px]">
      <div className="relative">
        <div className="apple-icon-bubble mx-auto h-12 w-12">
          <MapPinned className="h-5 w-5" aria-hidden />
        </div>
        <p className="apple-eyebrow mt-4">지도</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-normal text-[#1d1d1f]">
          {isChecking ? "위치 확인 중" : "맵"}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-6 text-[#6e6e73]">
          {status}
        </p>
      </div>
    </div>
  );
}

function RecommendationRankList({
  recommendations,
  isReady,
}: {
  recommendations: Recommendation[];
  isReady: boolean;
}) {
  const placeholders = [1, 2, 3];

  return (
    <div>
      <p className="mb-3 pl-1 text-sm font-extrabold text-[var(--brand-primary)]">
        맞춤 추천
      </p>
      <div className="grid gap-3">
        {placeholders.map((rank) => {
          const recommendation = recommendations[rank - 1];
          const school = recommendation?.school;
          const isTop = rank === 1;

          if (!isReady || !school) {
            return (
              <div
                key={rank}
                className="flex min-h-[74px] flex-col justify-center rounded-[18px] border border-[var(--line)] bg-white/78 px-4 py-3 shadow-[0_8px_22px_rgba(29,29,31,0.035)]"
              >
                <span className="text-sm font-extrabold text-[var(--brand-primary)]">
                  후보 {rank}
                </span>
                <span className="mt-2 text-base font-extrabold text-[#86868b]">
                  설문 완료 후 표시
                </span>
              </div>
            );
          }

          return (
            <Link
              key={school.id}
              href={`/schools/${school.id}`}
              className={cn(
                "group flex items-center justify-between gap-4 rounded-[18px] border border-[var(--line)] bg-white/92 px-4 py-3 shadow-[0_8px_22px_rgba(29,29,31,0.04)] transition hover:border-[rgba(70,138,87,0.36)] hover:bg-[var(--brand-primary-faint)]",
                isTop
                  ? "min-h-[92px] border-[rgba(70,138,87,0.32)] bg-[var(--brand-primary-faint)] shadow-[0_12px_28px_rgba(70,138,87,0.08)]"
                  : "min-h-[78px]",
              )}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {isTop ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(70,138,87,0.18)]">
                      <Trophy className="h-3 w-3" aria-hidden />
                      1위
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "text-xs font-extrabold text-[var(--brand-primary)]",
                      isTop && "text-xs",
                    )}
                  >
                    기준 위치 {formatDistance(recommendation.distanceKm)}
                  </span>
                </span>
                <span className="mt-1 flex min-w-0 items-start gap-2">
                  <SchoolEmblem
                    school={school}
                    size={isTop ? 30 : 26}
                    className="mt-0.5 rounded-lg"
                  />
                  <span
                    className={cn(
                      "block min-w-0 break-keep font-extrabold leading-[1.22] text-[#1d1d1f]",
                      isTop
                        ? "line-clamp-2 text-[1.14rem] sm:text-[1.2rem]"
                        : "line-clamp-1 text-[1.05rem]",
                    )}
                  >
                    {school.name}
                  </span>
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "h-4 w-4 shrink-0 text-[#86868b] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-primary)]",
                  isTop && "text-[var(--brand-primary)]",
                )}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCandidateState() {
  return (
    <div className="apple-panel p-8 text-center">
      <h3 className="text-xl font-extrabold text-[#1d1d1f]">
        조건에 맞는 학교가 없습니다.
      </h3>
      <p className="mt-2 text-sm font-semibold text-[#6e6e73]">
        검색어를 조정해보세요.
      </p>
    </div>
  );
}

function HomeCriterionSummary({
  result,
  firstRecommendation,
}: {
  result?: StoredSurveyResponse;
  firstRecommendation?: Recommendation;
}) {
  if (!result) {
    return null;
  }

  const criteria = [
    result.answer.categoryPreference ?? "학교 유형 자유",
    `거리 ${distanceLabel(result.answer.distancePreference)}`,
    firstRecommendation?.graduationOutcome ? "졸업 후 데이터" : "공시 데이터",
  ];

  return (
    <div className="mt-5 rounded-[18px] border border-[var(--line)] bg-white/72 p-3 shadow-[0_8px_22px_rgba(29,29,31,0.035)]">
      <p className="text-xs font-extrabold text-[var(--brand-primary)]">
        현재 추천 기준
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {criteria.map((criterion) => (
          <span
            key={criterion}
            className="rounded-full bg-[var(--brand-primary-soft)] px-2.5 py-1 text-xs font-extrabold text-[var(--brand-primary-dark)]"
          >
            {criterion}
          </span>
        ))}
      </div>
    </div>
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
