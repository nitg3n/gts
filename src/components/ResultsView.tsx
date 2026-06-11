"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { CompareButton } from "@/components/CompareButton";
import { SchoolEmblem } from "@/components/SchoolEmblem";
import { SchoolCard } from "@/components/SchoolCard";
import {
  getLatestSurveyResult,
  getSavedSurveyResults,
  saveLatestSurveyResult,
} from "@/lib/latest-survey-result";
import {
  getHumanRecommendationReason,
  getRankDifferenceReason,
  getRecommendationAdjustmentNotes,
  getRecommendationConclusion,
  getRecommendationCriteria,
  getShortSchoolLine,
} from "@/lib/recommendation-explainer";
import { deriveSurveyAnswer, type SurveyResponseMap } from "@/lib/survey";
import type { StoredSurveyResponse, SurveyAnswer } from "@/lib/types";
import { getStoredUserLocation } from "@/lib/user-location";
import { cn, formatDistance } from "@/lib/utils";

export function ResultsView({ responseId }: { responseId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<StoredSurveyResponse>();
  const [savedResults, setSavedResults] = useState<StoredSurveyResponse[]>([]);
  const [status, setStatus] = useState("추천 결과를 불러오는 중");

  useEffect(() => {
    let isActive = true;
    const cachedResult = getLatestSurveyResult();

    if (cachedResult?.id === responseId) {
      window.queueMicrotask(() => {
        if (!isActive) {
          return;
        }

        setResult(cachedResult);
        setSavedResults(getSavedSurveyResults());
        setStatus("추천 결과");
      });
    }

    fetch(`/api/recommendations/${responseId}`)
      .then(async (response) => {
        const data = (await response.json()) as StoredSurveyResponse;

        if (!response.ok || !Array.isArray(data.recommendations)) {
          throw new Error("Invalid recommendation response");
        }

        return data;
      })
      .then((data: StoredSurveyResponse) => {
        if (!isActive) {
          return;
        }

        saveLatestSurveyResult(data);
        setResult(data);
        setSavedResults(getSavedSurveyResults());
        setStatus("추천 결과");
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        if (cachedResult?.id === responseId) {
          return;
        }

        setStatus("추천 결과를 불러오지 못했습니다.");
      });

    return () => {
      isActive = false;
    };
  }, [responseId]);

  if (!result) {
    return (
      <ResultLoadingShell status={status} />
    );
  }

  const recommendations = result.recommendations.filter(
    (recommendation) => recommendation.school.level === "high",
  );
  const topThree = recommendations.slice(0, 3);
  const first = topThree[0];
  const compareSchools = topThree.map((item) => item.school);
  const criteria = getRecommendationCriteria(result.answer);
  const adjustmentNotes = getRecommendationAdjustmentNotes(result.answer);
  const previousResults = savedResults
    .filter((item) => item.id !== result.id)
    .slice(0, 3);
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
        <div className="apple-shell py-9 lg:py-11">
          <div className="apple-panel p-4 sm:p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.95fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[var(--brand-primary)]">
                  추천 요약
                </p>
                <p className="mt-2 text-xl font-extrabold leading-tight text-[#1d1d1f]">
                  {first?.school ? (
                    <span className="flex min-w-0 items-center gap-2">
                      <SchoolEmblem school={first.school} size={32} />
                      <span className="min-w-0 break-keep">
                        {first.school.name}
                      </span>
                    </span>
                  ) : (
                    "-"
                  )}
                </p>
                {first ? (
                  <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#6e6e73]">
                    {getHumanRecommendationReason(first, result.answer)}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                <HeroMetric label="종합" value={formatScore(first?.score)} />
                <HeroMetric
                  label="설문"
                  value={formatScore(first?.semanticScore)}
                />
                <HeroMetric
                  label="신뢰도"
                  value={formatConfidence(first?.confidence)}
                />
                <HeroMetric label="후보" value={`${recommendations.length}곳`} />
              </div>

              <div className="flex flex-col gap-3 lg:w-52">
                <div className="flex flex-wrap gap-2">
                  {result.answer.categoryPreference ? (
                    <span className="apple-chip apple-chip-brand px-3 py-1">
                      {result.answer.categoryPreference}
                    </span>
                  ) : null}
                  <span className="apple-chip apple-chip-brand px-3 py-1">
                    거리 {distanceLabel(result.answer.distancePreference)}
                  </span>
                  {first?.graduationOutcome ? (
                    <span className="apple-chip apple-chip-brand px-3 py-1">
                      졸업 후 데이터 반영
                    </span>
                  ) : null}
                </div>
                <CompareButton
                  schools={compareSchools}
                  navigateOnAdd
                  className="w-fit"
                >
                  상위 학교 비교
                </CompareButton>
              </div>
            </div>
          </div>

          <div className="mt-6 max-w-3xl">
            <p className="apple-eyebrow">{status}</p>
            <h1 className="apple-title mt-2 max-w-2xl text-3xl leading-tight sm:text-4xl">
              지금 조건에서 가장 잘 맞는 학교.
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>
                학교급 고등학교
              </Pill>
              <Pill>거리 {distanceLabel(result.answer.distancePreference)}</Pill>
            </div>
          </div>
        </div>
      </section>

      <section className="apple-shell py-8 lg:py-10">
        {result.persistence?.warning ? <PersistenceNotice /> : null}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
          <InsightPanel title="내 조건 요약">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {criteria.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-[#e8e8ed]"
                >
                  <p className="text-[11px] font-extrabold text-[#86868b]">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-extrabold leading-5 text-[#1d1d1f]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </InsightPanel>

          <InsightPanel title="적용한 추천 기준">
            <div className="space-y-2">
              {(adjustmentNotes.length
                ? adjustmentNotes
                : ["입학 가능 조건, 학교 유형, 통학 거리, 공식 지표를 함께 비교했습니다."]
              ).map((note) => (
                <div
                  key={note}
                  className="flex gap-2 rounded-2xl bg-[var(--brand-primary-soft)] px-3 py-2.5 text-sm font-bold leading-5 text-[#1d1d1f]"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-none text-[var(--brand-primary)]"
                    aria-hidden
                  />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </InsightPanel>

          <InsightPanel title="이전 추천 결과">
            {previousResults.length ? (
              <div className="space-y-2">
                {previousResults.map((item) => (
                  <Link
                    key={item.id}
                    href={`/results/${item.id}`}
                    className="apple-row-hover block rounded-2xl bg-white/70 px-3 py-2.5 ring-1 ring-[#e8e8ed]"
                  >
                    <p className="text-[11px] font-extrabold text-[#86868b]">
                      {formatSavedDate(item.createdAt)}
                    </p>
                    <p className="mt-1 truncate text-sm font-extrabold text-[#1d1d1f]">
                      {item.recommendations[0]?.school.name ?? "추천 결과"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold leading-6 text-[#6e6e73]">
                다음 설문부터 최근 결과가 이곳에 저장됩니다.
              </p>
            )}
          </InsightPanel>
        </div>

        <QuickAdjustPanel
          result={result}
          onAdjusted={(nextResult) => {
            saveLatestSurveyResult(nextResult);
            setResult(nextResult);
            setSavedResults(getSavedSurveyResults());
            router.push(`/results/${nextResult.id}`);
          }}
        />

        <RankDifferencePanel
          answer={result.answer}
          recommendations={topThree}
        />

        <div className="mt-6 grid items-stretch gap-5 lg:grid-cols-[1.08fr_1fr_1fr]">
          {topThree.map((recommendation, index) => (
            <SchoolCard
              key={recommendation.school.id}
              school={recommendation.school}
              distanceKm={recommendation.distanceKm}
              reasons={[
                getHumanRecommendationReason(recommendation, result.answer),
              ]}
              conclusion={getRecommendationConclusion(recommendation, result.answer)}
              caution={recommendation.caution}
              evidence={recommendation.evidence}
              graduationOutcome={recommendation.graduationOutcome}
              score={recommendation.score}
              semanticScore={recommendation.semanticScore}
              distanceScore={recommendation.distanceScore}
              confidence={recommendation.confidence}
              dimensionScores={recommendation.dimensionScores}
              featured={index === 0}
              rankLabel={index === 0 ? "1위 추천" : `${recommendation.rank}위 후보`}
            />
          ))}
        </div>

        {expandedRecommendations.length ? (
          <section className="mt-8">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="apple-eyebrow">더 넓게 보기</p>
                <h2 className="mt-2 text-xl font-extrabold tracking-normal text-[#1d1d1f]">
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
                  reasons={[
                    getHumanRecommendationReason(recommendation, result.answer),
                  ]}
                  conclusion={getRecommendationConclusion(recommendation, result.answer)}
                  caution={recommendation.caution}
                  evidence={recommendation.evidence}
                  graduationOutcome={recommendation.graduationOutcome}
                  score={recommendation.score}
                  semanticScore={recommendation.semanticScore}
                  distanceScore={recommendation.distanceScore}
                  confidence={recommendation.confidence}
                  dimensionScores={recommendation.dimensionScores}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="apple-panel mt-8 overflow-hidden">
          <div className="grid grid-cols-[64px_1fr_96px] border-b border-[var(--line)] bg-white/48 px-4 py-3 text-xs font-extrabold text-[#86868b] sm:grid-cols-[80px_1fr_140px]">
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
              <span className="font-extrabold text-[#1d1d1f]">
                #{recommendation.rank}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <SchoolEmblem
                    school={recommendation.school}
                    size={28}
                    className="rounded-lg"
                  />
                  <span className="block min-w-0 truncate font-extrabold text-[#1d1d1f]">
                    {recommendation.school.name}
                  </span>
                </span>
                <span className="mt-1 flex items-start gap-2 text-sm font-semibold text-[#6e6e73]">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-none text-[#34c759]"
                    aria-hidden
                  />
                  <span className="line-clamp-2">
                    {getShortSchoolLine(recommendation.school)}
                  </span>
                </span>
              </span>
              <span className="text-right text-sm font-extrabold text-[#6e6e73] sm:text-left">
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

function ResultLoadingShell({ status }: { status: string }) {
  return (
    <div className="apple-page">
      <div className="apple-shell grid min-h-[68vh] place-items-center py-12">
        <div className="apple-panel w-full max-w-lg p-6">
          <p className="apple-eyebrow">추천 결과</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-normal text-[#1d1d1f]">
            {status}
          </h1>
          <div className="mt-6 grid gap-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[#e8e8ed] bg-white/70 p-4"
              >
                <div className="h-3 w-24 animate-pulse rounded-full bg-[#e8e8ed]" />
                <div className="mt-3 h-5 w-2/3 animate-pulse rounded-full bg-[#dfe8e1]" />
                <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-[#f1f1f4]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersistenceNotice() {
  return (
    <div className="apple-panel mb-5 border-[rgba(255,159,10,0.24)] bg-[#fffaf0] p-4">
      <p className="text-sm font-extrabold text-[#9a5b00]">
        서버 저장 상태 확인 필요
      </p>
      <p className="mt-1 text-sm font-semibold leading-6 text-[#6e6e73]">
        결과는 이 브라우저에 보관되어 바로 사용할 수 있습니다. 다른 기기에서도 이어 보려면 서버 저장 설정을 확인해야 합니다.
      </p>
    </div>
  );
}

const categoryOptions = [
  ["any", "아직 미정"],
  ["일반고", "일반고"],
  ["특성화고", "특성화고"],
  ["자율형 사립고", "자율형 사립고"],
  ["외국어고", "외국어고"],
  ["영재학교", "영재학교"],
  ["과학고", "과학고"],
  ["예술고", "예술고"],
  ["체육고", "체육고"],
  ["마이스터고", "마이스터고"],
];

const genderTypeOptions = [
  ["any", "상관없음"],
  ["coed-separated", "공학"],
  ["coed-class-separated", "공학 분반"],
  ["single-gender", "남학교 또는 여학교"],
];

const careerOptions = [
  ["undecided", "진로 미정"],
  ["college", "대학 진학"],
  ["science", "과학·공학·연구"],
  ["global", "외국어·국제"],
  ["practical", "실습·취업·기술"],
  ["arts-sports", "예술·체육"],
];

const distanceOptions = [
  ["near", "가까운 통학"],
  ["balanced", "통학·적합도 균형"],
  ["not-important", "거리 상관없음"],
];

const commuteTimeOptions = [
  ["very-near", "10분 이내"],
  ["near", "10-20분"],
  ["balanced", "20-30분"],
  ["far-ok", "40-50분"],
  ["any", "상관없음"],
];

const commuteMethodOptions = [
  ["transit", "대중교통"],
  ["walk", "도보"],
  ["bike", "자전거"],
  ["car", "차량"],
  ["any", "미정"],
];

function QuickAdjustPanel({
  result,
  onAdjusted,
}: {
  result: StoredSurveyResponse;
  onAdjusted: (result: StoredSurveyResponse) => void;
}) {
  const answer = result.answer;
  const raw = answer.rawResponses ?? {};
  const [category, setCategory] = useState(
    typeof raw.categoryPreference === "string" ? raw.categoryPreference : "any",
  );
  const [genderType, setGenderType] = useState(() => {
    if (typeof raw.genderPreference === "string") {
      return raw.genderPreference;
    }

    return answer.genderPreference === "coed"
      ? "coed-separated"
      : answer.genderPreference ?? "any";
  });
  const [career, setCareer] = useState(
    typeof raw.careerDirection === "string" ? raw.careerDirection : "undecided",
  );
  const [distance, setDistance] =
    useState<SurveyAnswer["distancePreference"]>(answer.distancePreference);
  const [commuteTime, setCommuteTime] = useState(
    typeof raw.commuteTime === "string"
      ? raw.commuteTime
      : defaultCommuteTime(distance),
  );
  const [commuteMethod, setCommuteMethod] = useState(
    typeof raw.commuteMethod === "string" ? raw.commuteMethod : "transit",
  );
  const [nationwideExpansion, setNationwideExpansion] = useState(
    raw.nationwideExpansion === true,
  );
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAdjustedSurvey() {
    setIsSubmitting(true);
    setStatus("새 조건으로 계산 중");

    const nextCommuteTime = distance === "not-important" ? "any" : commuteTime;
    const nextResponses: SurveyResponseMap = {
      ...raw,
      ...distanceResponseValues(distance),
      categoryPreference: category,
      genderPreference: genderType,
      careerDirection: career,
      studentGender: raw.studentGender ?? answer.studentGender,
      commuteTime: nextCommuteTime,
      commuteMethod,
      nationwideExpansion,
    };
    const storedLocation = getStoredUserLocation();
    const location =
      typeof answer.lat === "number" && typeof answer.lng === "number"
        ? { lat: answer.lat, lng: answer.lng }
        : storedLocation
          ? { lat: storedLocation.lat, lng: storedLocation.lng }
        : undefined;

    if (!location) {
      setStatus("저장된 기준 위치가 없어 위치를 다시 선택해야 합니다.");
      setIsSubmitting(false);
      return;
    }

    const nextAnswer = deriveSurveyAnswer(nextResponses, location);

    try {
      const response = await fetch("/api/survey-responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextAnswer),
      });
      const data = (await response.json()) as StoredSurveyResponse & {
        message?: string;
      };

      if (!response.ok || !Array.isArray(data.recommendations)) {
        throw new Error(data.message ?? "추천을 다시 계산하지 못했습니다.");
      }

      onAdjusted(data);
      setStatus("새 추천 결과로 이동했습니다.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "추천을 다시 계산하지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="apple-panel mt-6 p-4 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-sm font-extrabold text-[var(--brand-primary)]">
            조건 빠르게 조정
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <QuickSelect
              label="학교 유형"
              value={category}
              options={categoryOptions}
              onChange={setCategory}
            />
            <QuickSelect
              label="통학 기준"
              value={distance}
              options={distanceOptions}
              onChange={(value) => {
                const nextDistance = value as SurveyAnswer["distancePreference"];
                setDistance(nextDistance);
                setCommuteTime(defaultCommuteTime(nextDistance));
              }}
            />
            <QuickSelect
              label="통학 시간"
              value={commuteTime}
              options={commuteTimeOptions}
              onChange={setCommuteTime}
            />
            <QuickSelect
              label="통학 방식"
              value={commuteMethod}
              options={commuteMethodOptions}
              onChange={setCommuteMethod}
            />
            <QuickCheckbox
              label="전국 확대"
              checked={nationwideExpansion}
              onChange={() => setNationwideExpansion((current) => !current)}
            />
            <QuickSelect
              label="성별 유형"
              value={genderType}
              options={genderTypeOptions}
              onChange={setGenderType}
            />
            <QuickSelect
              label="진로 방향"
              value={career}
              options={careerOptions}
              onChange={setCareer}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:w-48">
          <button
            type="button"
            onClick={submitAdjustedSurvey}
            disabled={isSubmitting}
            className="apple-button-primary h-11 px-4 text-sm"
          >
            {isSubmitting ? "계산 중" : "추천 다시 계산"}
          </button>
          {status ? (
            <p className="text-xs font-bold leading-5 text-[#86868b]">
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RankDifferencePanel({
  answer,
  recommendations,
}: {
  answer: SurveyAnswer;
  recommendations: StoredSurveyResponse["recommendations"];
}) {
  if (recommendations.length < 2) {
    return null;
  }

  const first = recommendations[0];

  return (
    <section className="apple-panel mt-6 p-4 sm:p-5">
      <p className="text-sm font-extrabold text-[var(--brand-primary)]">
        순위 차이
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {recommendations.map((recommendation) => (
          <div
            key={recommendation.school.id}
            className="rounded-2xl bg-white/70 p-3 ring-1 ring-[#e8e8ed]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <SchoolEmblem
                school={recommendation.school}
                size={28}
                className="rounded-lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-[var(--brand-primary)]">
                  {recommendation.rank}위
                </p>
                <p className="truncate text-sm font-extrabold text-[#1d1d1f]">
                  {recommendation.school.name}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#6e6e73]">
              {getRankDifferenceReason(recommendation, first, answer)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#6e6e73]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="apple-field mt-1 h-11 w-full px-3 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuickCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold text-[#6e6e73]">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "mt-1 flex h-11 w-full items-center gap-2 rounded-[14px] px-3 text-left text-sm font-extrabold ring-1 transition",
          checked
            ? "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] ring-[rgba(70,138,87,0.28)]"
            : "bg-white text-[#1d1d1f] ring-[#d2d2d7] hover:bg-[var(--brand-primary-soft)]",
        )}
        aria-pressed={checked}
      >
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded-md border",
            checked
              ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
              : "border-[#d2d2d7] bg-white text-transparent",
          )}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
        포함
      </button>
    </label>
  );
}

function distanceResponseValues(
  value: SurveyAnswer["distancePreference"],
): Pick<SurveyResponseMap, "commuteImportance" | "commuteTime"> {
  if (value === "near") {
    return {
      commuteImportance: 5,
      commuteTime: "near",
    };
  }

  if (value === "not-important") {
    return {
      commuteImportance: 1,
      commuteTime: "any",
    };
  }

  return {
    commuteImportance: 3,
    commuteTime: "balanced",
  };
}

function defaultCommuteTime(value: SurveyAnswer["distancePreference"]) {
  if (value === "near") {
    return "near";
  }

  if (value === "not-important") {
    return "any";
  }

  return "balanced";
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-[#e8e8ed]">
      <div className="text-[11px] font-extrabold text-[#86868b]">{label}</div>
      <div className="mt-1 text-base font-extrabold tracking-normal text-[#1d1d1f]">
        {value}
      </div>
    </div>
  );
}

function InsightPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="apple-panel p-4 sm:p-5">
      <h2 className="text-sm font-extrabold text-[var(--brand-primary)]">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function formatScore(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value)}점`;
}

function formatConfidence(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
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

function formatSavedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "저장된 결과";
  }

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
