"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LocateFixed,
  MapPinned,
  Sparkles,
} from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { schoolSelectionSurvey } from "@/data/surveys";
import type {
  CleanSurvey,
  SurveyChoice,
  SurveyQuestion,
  SurveyStepId,
} from "@/data/surveys";
import {
  deriveSurveyAnswer,
  getDefaultSurveyResponses,
  getVisibleSurveyQuestions,
  type SurveyResponseMap,
  type SurveyResponseValue,
} from "@/lib/survey";
import { saveLatestSurveyResult } from "@/lib/latest-survey-result";
import type { StoredSurveyResponse } from "@/lib/types";
import {
  getStoredUserLocation,
  saveUserLocation,
  storedLocationLabel,
} from "@/lib/user-location";
import { cn } from "@/lib/utils";

type Location = { lat: number; lng: number };
type StepId = SurveyStepId | "location";
type SurveyStep = {
  id: StepId;
  eyebrow: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
};

const stepMeta: Record<StepId, Omit<SurveyStep, "id" | "questions">> = {
  profile: {
    eyebrow: "1단계",
    title: "현재 상황",
    description: "현재 학년과 고등학교 선택 기준을 확인합니다.",
  },
  fit: {
    eyebrow: "2단계",
    title: "학교 적합도",
    description: "학교 유형, 분위기, 관심 활동을 추천 조건으로 바꿉니다.",
  },
  priorities: {
    eyebrow: "3단계",
    title: "선택 기준",
    description: "중요한 항목일수록 추천 점수에서 더 크게 반영됩니다.",
  },
  commute: {
    eyebrow: "4단계",
    title: "통학 기준",
    description: "거리와 이동 시간을 얼마나 중요하게 볼지 정합니다.",
  },
  location: {
    eyebrow: "5단계",
    title: "추천 기준 위치",
    description: "지도를 움직여 비교하고 싶은 위치를 정합니다.",
  },
};

const submitStages = [
  {
    title: "응답 조건 확인 중",
    description: "성별, 학교 유형, 통학 기준처럼 반드시 반영해야 하는 조건을 먼저 정리합니다.",
  },
  {
    title: "후보 학교 탐색 중",
    description: "선택한 위치와 거리 기준에 맞춰 실제 학교 후보를 찾고 있습니다.",
  },
  {
    title: "학교 데이터 연결 중",
    description: "NEIS, 학교알리미, 졸업 후 데이터를 추천 기준에 맞게 대조합니다.",
  },
  {
    title: "추천 결과 정리 중",
    description: "가장 설명 가능한 1, 2, 3순위와 추가 후보를 정리하고 있습니다.",
  },
];

export function SurveyForm({
  onComplete,
  submitLabel = "추천 결과 보기",
}: {
  onComplete?: (responseId: string) => void;
  submitLabel?: string;
} = {}) {
  const router = useRouter();
  const [survey, setSurvey] = useState<CleanSurvey>(schoolSelectionSurvey);
  const [responses, setResponses] = useState<SurveyResponseMap>(() =>
    getDefaultSurveyResponses(schoolSelectionSurvey),
  );
  const [location, setLocation] = useState<Location>();
  const [draftLocation, setDraftLocation] = useState<Location>();
  const [draftAccuracy, setDraftAccuracy] = useState<number>();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitStageIndex, setSubmitStageIndex] = useState(0);
  const [locationSource, setLocationSource] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [touchedQuestions, setTouchedQuestions] = useState<Set<string>>(
    () => new Set(),
  );
  const targetLabel = "고등학교";
  const visibleQuestions = useMemo(
    () =>
      getVisibleSurveyQuestions(survey).filter(
        (question) => question.type !== "hidden" && question.type !== "section",
      ),
    [survey],
  );
  const steps = useMemo(
    () => buildSteps(visibleQuestions),
    [visibleQuestions],
  );
  const safeStepIndex = Math.min(stepIndex, steps.length - 1);
  const activeStep = steps[safeStepIndex];
  const answeredCount =
    visibleQuestions.filter((question) =>
      (!question.required && isAnswered(question, responses[question.id])) ||
      (touchedQuestions.has(question.id) &&
        isAnswered(question, responses[question.id])),
    ).length + (location ? 1 : 0);
  const totalCount = visibleQuestions.length + 1;
  const progress = Math.round((answeredCount / totalCount) * 100);

  useEffect(() => {
    fetch("/api/surveys/active")
      .then((response) => response.json())
      .then((data: { survey?: CleanSurvey }) => {
        if (!data.survey) {
          return;
        }

        setSurvey(data.survey);
        setResponses(getDefaultSurveyResponses(data.survey));
        setTouchedQuestions(new Set());
      })
      .catch(() => setStatus("기본 설문으로 진행합니다."));
  }, []);

  useEffect(() => {
    if (!submitting) {
      return;
    }

    const interval = window.setInterval(() => {
      setSubmitStageIndex((current) =>
        Math.min(current + 1, submitStages.length - 1),
      );
    }, 700);

    return () => window.clearInterval(interval);
  }, [submitting]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedLocation = getStoredUserLocation();

      if (!storedLocation) {
        return;
      }

      setLocation({ lat: storedLocation.lat, lng: storedLocation.lng });
      setLocationSource(storedLocationLabel(storedLocation));
      setStatus("선택한 위치를 추천에 반영합니다.");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function setResponse(questionId: string, value: SurveyResponseValue) {
    markQuestionTouched(questionId);
    setResponses((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function toggleMulti(questionId: string, value: string) {
    markQuestionTouched(questionId);
    setResponses((current) => {
      const currentValues = Array.isArray(current[questionId])
        ? (current[questionId] as string[])
        : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [questionId]: nextValues,
      };
    });
  }

  function markQuestionTouched(questionId: string) {
    setTouchedQuestions((current) => {
      const next = new Set(current);
      next.add(questionId);
      return next;
    });
  }

  function markStepTouched(step: SurveyStep | undefined) {
    if (!step?.questions.length) {
      return;
    }

    setTouchedQuestions((current) => {
      const next = new Set(current);
      step.questions.forEach((question) => next.add(question.id));
      return next;
    });
  }

  function captureLocation() {
    if (!navigator.geolocation) {
      setStatus("브라우저 위치 기능을 사용할 수 없습니다.");
      return;
    }

    setStatus("위치를 확인하는 중");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setDraftLocation(nextLocation);
        setDraftAccuracy(position.coords.accuracy);
        setStatus("지도에서 추천 기준 위치를 선택해주세요.");
      },
      () => setStatus("위치 권한을 허용해야 추천을 계산할 수 있습니다."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const confirmDraftLocation = useCallback(() => {
    if (!draftLocation) {
      captureLocation();
      return;
    }

    setLocation(draftLocation);
    saveUserLocation(draftLocation, draftAccuracy);
    setLocationSource("선택한 위치");
    setDraftLocation(undefined);
    setDraftAccuracy(undefined);
    setStatus("위치가 선택됐습니다.");
  }, [draftAccuracy, draftLocation]);

  async function submitSurvey() {
    const missingQuestion = findFirstUnansweredQuestion(
      visibleQuestions,
      responses,
    );

    if (missingQuestion) {
      markQuestionTouched(missingQuestion.id);
      setStepIndex(
        Math.max(
          0,
          steps.findIndex((step) =>
            step.questions.some((question) => question.id === missingQuestion.id),
          ),
        ),
      );
      setSubmitting(false);
      setStatus("필수 문항을 먼저 선택해주세요.");
      return;
    }

    if (!location) {
      setSubmitting(false);
      setStatus("추천을 계산하려면 먼저 위치를 선택해주세요.");
      captureLocation();
      return;
    }

    setSubmitting(true);
    setSubmitStageIndex(0);
    setStatus("추천 결과를 준비하는 중입니다.");

    const answer = deriveSurveyAnswer(responses, location, survey);

    try {
      setSubmitStageIndex(1);
      const response = await fetch("/api/survey-responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(answer),
      });
      setSubmitStageIndex(3);

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
        setStatus(data.message ?? "추천 계산에 실패했습니다.");
        setSubmitting(false);
        return;
      }

      saveLatestSurveyResult(data as StoredSurveyResponse);

      if (onComplete) {
        onComplete(data.id);
        setSubmitting(false);
        return;
      }

      router.push(`/results/${data.id}`);
    } catch {
      setStatus("추천 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  function moveStep(direction: -1 | 1) {
    markStepTouched(activeStep);
    setStepIndex(Math.min(Math.max(safeStepIndex + direction, 0), steps.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="apple-page">
      {submitting ? <SubmitProgressOverlay stageIndex={submitStageIndex} /> : null}
      <div className="apple-shell grid gap-8 py-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:py-12">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="apple-panel p-6">
            <p className="apple-eyebrow">학교 선택 설문</p>
            <h1 className="apple-title mt-3 text-3xl leading-tight">
              {survey.title}
            </h1>
            <p className="apple-copy mt-4 text-base">{survey.description}</p>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-extrabold text-[#86868b]">
                <span>완성도</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e8e8ed]">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">
              <InfoLine label="추천 대상" value={targetLabel} />
              <InfoLine label="질문" value={`${visibleQuestions.length}개`} />
              <InfoLine label="위치" value={location ? locationSource || "선택됨" : "필요"} />
            </div>

            <div className="mt-6 grid gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    markStepTouched(activeStep);
                    setStepIndex(index);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-3 py-3 text-left transition",
                    index === safeStepIndex
                      ? "bg-[var(--brand-primary)] text-white shadow-[0_14px_34px_rgba(70,138,87,0.24)]"
                      : "bg-white/68 text-[#6e6e73] ring-1 ring-[var(--line)] hover:bg-[var(--brand-primary-soft)] hover:text-[#1d1d1f]",
                  )}
                >
                  <span>
                    <span className="block text-xs font-extrabold opacity-70">
                      {step.eyebrow}
                    </span>
                    <span className="mt-0.5 block text-sm font-extrabold">
                      {step.title}
                    </span>
                  </span>
                  {index < safeStepIndex || (step.id === "location" && location) ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="apple-panel p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="apple-eyebrow">{activeStep.eyebrow}</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-normal text-[#1d1d1f]">
                  {activeStep.title}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#6e6e73]">
                  {activeStep.description}
                </p>
              </div>
              <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                {activeStep.id === "location" ? (
                  <MapPinned className="h-5 w-5" aria-hidden />
                ) : (
                  <Sparkles className="h-5 w-5" aria-hidden />
                )}
              </div>
            </div>
          </section>

          {activeStep.questions.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              value={responses[question.id]}
              onChange={(value) => setResponse(question.id, value)}
              onToggle={(value) => toggleMulti(question.id, value)}
            />
          ))}

          {activeStep.id === "location" ? (
            <LocationBlock
              draftLocation={draftLocation}
              location={location}
              locationSource={locationSource}
              onCapture={captureLocation}
              onConfirm={confirmDraftLocation}
              onDraftChange={setDraftLocation}
            />
          ) : null}

          <div className="apple-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-h-5 text-sm font-bold text-[#6e6e73]">{status}</p>
            <div className="flex gap-2">
              {safeStepIndex > 0 ? (
                <button
                  type="button"
                  onClick={() => moveStep(-1)}
                  className="apple-button-secondary h-12 gap-2 px-4 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  이전
                </button>
              ) : null}
              {safeStepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={() => moveStep(1)}
                  className="apple-button-primary h-12 gap-2 px-5 text-sm"
                >
                  다음
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submitSurvey}
                  disabled={submitting}
                  className="apple-button-primary h-12 gap-2 px-5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SubmitProgressOverlay({ stageIndex }: { stageIndex: number }) {
  const safeIndex = Math.min(Math.max(stageIndex, 0), submitStages.length - 1);
  const stage = submitStages[safeIndex];
  const progress = ((safeIndex + 1) / submitStages.length) * 100;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#f5f5f7]/82 px-4 backdrop-blur-xl">
      <div
        className="apple-panel w-full max-w-md p-6"
        role="status"
        aria-live="polite"
      >
        <p className="apple-eyebrow">추천 생성</p>
        <h2 className="mt-3 text-2xl font-extrabold tracking-normal text-[#1d1d1f]">
          {stage.title}
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#6e6e73]">
          {stage.description}
        </p>

        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#e8e8ed]">
          <div
            className="h-full rounded-full bg-[var(--brand-primary)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="mt-5 grid gap-2">
          {submitStages.map((item, index) => {
            const done = index <= safeIndex;

            return (
              <li
                key={item.title}
                className={cn(
                  "flex items-center gap-2 text-sm font-extrabold",
                  done ? "text-[var(--brand-primary)]" : "text-[#a1a1a6]",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[11px]",
                    done
                      ? "bg-[var(--brand-primary)] text-white"
                      : "bg-white text-[#a1a1a6] ring-1 ring-[#e8e8ed]",
                  )}
                >
                  {index + 1}
                </span>
                {item.title}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function buildSteps(questions: SurveyQuestion[]): SurveyStep[] {
  const questionSteps = (["profile", "fit", "priorities", "commute"] satisfies SurveyStepId[])
    .map((id) => ({
      id,
      ...stepMeta[id],
      questions: questions.filter((question) => getQuestionStep(question) === id),
    }))
    .filter((step) => step.questions.length > 0);

  return [
    ...questionSteps,
    {
      id: "location",
      ...stepMeta.location,
      questions: [],
    },
  ];
}

function getQuestionStep(question: SurveyQuestion): SurveyStepId {
  if (question.step) {
    return question.step;
  }

  if (question.id.toLowerCase().includes("commute")) {
    return "commute";
  }

  if (question.type === "scale") {
    return "priorities";
  }

  return "fit";
}

function isAnswered(question: SurveyQuestion, value: SurveyResponseValue | undefined) {
  if (!question.required) {
    return true;
  }

  if (question.type === "multi") {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === "checkbox") {
    return typeof value === "boolean";
  }

  return value !== undefined && value !== "";
}

function findFirstUnansweredQuestion(
  questions: SurveyQuestion[],
  responses: SurveyResponseMap,
) {
  return questions.find(
    (question) => question.required && !isAnswered(question, responses[question.id]),
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-bold text-[#86868b]">{label}</span>
      <span className="font-extrabold text-[#1d1d1f]">{value}</span>
    </div>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: SurveyQuestion;
  value: SurveyResponseValue | undefined;
  onChange: (value: SurveyResponseValue) => void;
  onToggle: (value: string) => void;
}) {
  return (
    <section className="apple-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#1d1d1f]">{question.title}</h2>
          {question.description ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-[#6e6e73]">
              {question.description}
            </p>
          ) : null}
        </div>
        {question.required ? (
          <span className="apple-chip apple-chip-brand px-3 py-1">필수</span>
        ) : null}
      </div>

      <div className="mt-5">
        {question.type === "single" && question.choices ? (
          <ChoiceGrid
            choices={question.choices}
            value={String(value ?? "")}
            onChange={onChange}
          />
        ) : null}

        {question.type === "multi" && question.choices ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {question.choices.map((choice) => {
              const active = Array.isArray(value) && value.includes(choice.value);

              return (
                <ChoiceButton
                  key={choice.id}
                  active={active}
                  hint={choice.hint}
                  onClick={() => onToggle(choice.value)}
                >
                  {choice.label}
                </ChoiceButton>
              );
            })}
          </div>
        ) : null}

        {question.type === "scale" ? (
          <ScaleInput
            question={question}
            value={typeof value === "number" ? value : undefined}
            onChange={onChange}
          />
        ) : null}

        {question.type === "checkbox" ? (
          <CheckboxInput
            checked={value === true}
            onChange={() => onChange(value === true ? false : true)}
          />
        ) : null}
      </div>
    </section>
  );
}

function CheckboxInput({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition",
        checked
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]"
          : "border-[var(--line-strong)] bg-white/78 hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)]",
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition",
          checked
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
            : "border-[#d2d2d7] bg-white text-transparent",
        )}
      >
        <Check className="h-4 w-4" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-extrabold text-[#1d1d1f]">
          전국 후보 포함
        </span>
        <span className="mt-1 block text-xs font-bold leading-5 text-[#6e6e73]">
          거주 예정 지역 밖의 학교까지 함께 비교합니다.
        </span>
      </span>
    </button>
  );
}

function ChoiceGrid({
  choices,
  value,
  onChange,
}: {
  choices: SurveyChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {choices.map((choice) => (
        <ChoiceButton
          key={choice.id}
          active={value === choice.value}
          hint={choice.hint}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </ChoiceButton>
      ))}
    </div>
  );
}

function ScaleInput({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestion;
  value?: number;
  onChange: (value: number) => void;
}) {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {values.map((scaleValue) => (
          <ScaleButton
            key={scaleValue}
            active={value === scaleValue}
            onClick={() => onChange(scaleValue)}
          >
            {scaleValue}
          </ScaleButton>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold text-[#86868b]">
        <span>{question.minLabel}</span>
        <span>{question.maxLabel}</span>
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  hint,
  onClick,
  children,
}: {
  active: boolean;
  hint?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-[58px] rounded-2xl border px-4 py-3 text-left text-sm font-extrabold transition",
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_rgba(70,138,87,0.18)]"
          : "border-[var(--line-strong)] bg-white/78 text-[#1d1d1f] hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)]",
      )}
    >
      <span className="block">{children}</span>
      {hint ? (
        <span
          className={cn(
            "mt-1 block text-xs font-bold leading-5",
            active ? "text-white/78" : "text-[#86868b]",
          )}
        >
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function ScaleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-full border text-sm font-extrabold transition",
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_rgba(70,138,87,0.18)]"
          : "border-[var(--line-strong)] bg-white/78 text-[#1d1d1f] hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)]",
      )}
    >
      {children}
    </button>
  );
}

function LocationBlock({
  draftLocation,
  location,
  locationSource,
  onCapture,
  onConfirm,
  onDraftChange,
}: {
  draftLocation?: Location;
  location?: Location;
  locationSource: string;
  onCapture: () => void;
  onConfirm: () => void;
  onDraftChange: (location: Location) => void;
}) {
  return (
    <section className="apple-panel p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="apple-eyebrow">위치</p>
          <h2 className="mt-2 text-xl font-extrabold text-[#1d1d1f]">
            추천 기준 위치
          </h2>
        </div>
        <button
          type="button"
          onClick={onCapture}
          className="apple-button-secondary h-10 gap-2 px-4 text-sm"
        >
          <LocateFixed className="h-4 w-4" aria-hidden />
          위치 선택
        </button>
      </div>

      {draftLocation ? (
        <div className="mt-5">
          <KakaoMap
            schools={[]}
            center={draftLocation}
            centerMarkerLabel="선택할 위치"
            className="min-h-[340px]"
            onCenterChange={onDraftChange}
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
      ) : location ? (
        <div className="mt-5">
          <KakaoMap
            schools={[]}
            center={location}
            centerMarkerLabel="추천 기준 위치"
            className="min-h-[340px]"
          />
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary-soft)] px-4 py-2 text-sm font-extrabold text-[var(--brand-primary-dark)]">
            <Check className="h-4 w-4" aria-hidden />
            {locationSource || "선택한 위치"}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid min-h-[240px] place-items-center rounded-[24px] border border-dashed border-[var(--line-strong)] bg-white/50 p-6 text-center">
          <div>
            <div className="apple-icon-bubble mx-auto h-12 w-12">
              <LocateFixed className="h-5 w-5" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-extrabold text-[#1d1d1f]">
              위치를 선택하면 추천 기준 지도가 표시됩니다.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
