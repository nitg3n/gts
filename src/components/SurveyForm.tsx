"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, LocateFixed } from "lucide-react";
import { KakaoMap } from "@/components/KakaoMap";
import { schoolSelectionSurvey } from "@/data/surveys";
import type { CleanSurvey, SurveyChoice, SurveyQuestion } from "@/data/surveys";
import {
  deriveSurveyAnswer,
  getDefaultSurveyResponses,
  getStudentStage,
  getVisibleSurveyQuestions,
  type SurveyResponseMap,
  type SurveyResponseValue,
} from "@/lib/survey";
import {
  getStoredUserLocation,
  saveUserLocation,
  storedLocationLabel,
} from "@/lib/user-location";
import { cn } from "@/lib/utils";

export function SurveyForm() {
  const router = useRouter();
  const [survey, setSurvey] = useState<CleanSurvey>(schoolSelectionSurvey);
  const [responses, setResponses] = useState<SurveyResponseMap>(() =>
    getDefaultSurveyResponses(schoolSelectionSurvey),
  );
  const [location, setLocation] = useState<{ lat: number; lng: number }>();
  const [draftLocation, setDraftLocation] = useState<{ lat: number; lng: number }>();
  const [draftAccuracy, setDraftAccuracy] = useState<number>();
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locationSource, setLocationSource] = useState("");
  const studentStage = getStudentStage(responses);
  const targetLabel = studentStage === "elementary" ? "중학교" : "고등학교";
  const visibleQuestions = getVisibleSurveyQuestions(survey, responses);
  const answerableQuestions = visibleQuestions.filter(
    (question) => question.type !== "hidden" && question.type !== "section",
  );

  useEffect(() => {
    fetch("/api/surveys/active")
      .then((response) => response.json())
      .then((data: { survey?: CleanSurvey }) => {
        if (!data.survey) {
          return;
        }

        setSurvey(data.survey);
        setResponses(getDefaultSurveyResponses(data.survey));
      })
      .catch(() => setStatus("기본 설문으로 진행합니다."));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedLocation = getStoredUserLocation();

      if (!storedLocation) {
        return;
      }

      setLocation({ lat: storedLocation.lat, lng: storedLocation.lng });
      setLocationSource(storedLocationLabel(storedLocation));
      setStatus("저장된 위치를 추천에 반영합니다.");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  function setResponse(questionId: string, value: SurveyResponseValue) {
    setResponses((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function setStudentStage(stage: "elementary" | "middle") {
    setResponses((current) => ({
      ...current,
      studentStage: stage,
      targetLevel: stage === "elementary" ? "middle" : "high",
    }));
    setStatus(
      stage === "elementary"
        ? "초등학생 기준 중학교 추천 설문입니다."
        : "중학생 기준 고등학교 추천 설문입니다.",
    );
  }

  function toggleMulti(questionId: string, value: string) {
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
    setStatus("위치가 저장됐습니다.");
  }, [draftAccuracy, draftLocation]);

  async function submitSurvey() {
    setSubmitting(true);
    setStatus("추천을 계산하는 중");

    if (!location) {
      setSubmitting(false);
      setStatus("추천을 계산하려면 먼저 위치를 저장해주세요.");
      captureLocation();
      return;
    }

    const answer = deriveSurveyAnswer(responses, location, survey);
    const response = await fetch("/api/survey-responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(answer),
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
    <div className="apple-page">
      <div className="apple-shell grid gap-8 py-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="apple-panel p-6">
            <p className="apple-eyebrow">Matching Survey</p>
            <h1 className="apple-title mt-3 text-4xl leading-tight">
              {survey.title}
            </h1>
            <p className="apple-copy mt-4 text-base">{survey.description}</p>

            <div className="mt-6 grid gap-3 border-t border-[var(--line)] pt-5">
              <InfoLine label="추천 대상" value={targetLabel} />
              <InfoLine label="질문" value={`${answerableQuestions.length}개`} />
              <InfoLine label="위치" value={location ? locationSource || "저장됨" : "필요"} />
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="apple-panel p-5 sm:p-6">
            <p className="apple-eyebrow">진학 단계</p>
            <h2 className="mt-2 text-xl font-black text-[#1d1d1f]">
              현재 학생은 어디에 있나요?
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StageButton
                active={studentStage === "elementary"}
                title="초등학생"
                description="중학교 추천"
                onClick={() => setStudentStage("elementary")}
              />
              <StageButton
                active={studentStage === "middle"}
                title="중학생"
                description="고등학교 추천"
                onClick={() => setStudentStage("middle")}
              />
            </div>
          </section>

          {visibleQuestions.map((question) => (
            <QuestionBlock
              key={question.id}
              question={question}
              value={responses[question.id]}
              onChange={(value) => setResponse(question.id, value)}
              onToggle={(value) => toggleMulti(question.id, value)}
            />
          ))}

          <section className="apple-panel p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="apple-eyebrow">Location</p>
                <h2 className="mt-2 text-xl font-black text-[#1d1d1f]">
                  추천 기준 위치
                </h2>
              </div>
              <button
                type="button"
                onClick={captureLocation}
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
                  onCenterChange={setDraftLocation}
                />
                <button
                  type="button"
                  onClick={confirmDraftLocation}
                  className="apple-button-primary mt-3 h-11 w-full gap-2 text-sm"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden />
                  위치 저장
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
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary-soft)] px-4 py-2 text-sm font-black text-[var(--brand-primary-dark)]">
                  <Check className="h-4 w-4" aria-hidden />
                  {locationSource || "저장된 위치"}
                </div>
              </div>
            ) : (
              <div className="mt-5 grid min-h-[240px] place-items-center rounded-[24px] border border-dashed border-[var(--line-strong)] bg-white/50 p-6 text-center">
                <div>
                  <div className="apple-icon-bubble mx-auto h-12 w-12">
                    <LocateFixed className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mt-4 text-sm font-black text-[#1d1d1f]">
                    위치를 저장하면 추천 기준 지도가 표시됩니다.
                  </p>
                </div>
              </div>
            )}
          </section>

          <div className="apple-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-[#6e6e73]">{status}</p>
            <button
              type="button"
              onClick={submitSurvey}
              disabled={submitting}
              className="apple-button-primary h-12 gap-2 px-5 text-sm disabled:cursor-not-allowed"
            >
              추천 결과 보기
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-bold text-[#86868b]">{label}</span>
      <span className="font-black text-[#1d1d1f]">{value}</span>
    </div>
  );
}

function StageButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[20px] border p-4 text-left transition",
        active
          ? "border-[rgba(70,138,87,0.42)] bg-[var(--brand-primary-soft)] shadow-sm"
          : "border-[var(--line)] bg-white/72 hover:border-[rgba(70,138,87,0.36)] hover:bg-white",
      )}
    >
      <span className="block text-base font-black text-[#1d1d1f]">{title}</span>
      <span className="mt-1 block text-sm font-bold text-[#6e6e73]">
        {description}
      </span>
    </button>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
  onToggle,
}: {
  question: SurveyQuestion;
  value: SurveyResponseValue;
  onChange: (value: SurveyResponseValue) => void;
  onToggle: (value: string) => void;
}) {
  if (question.type === "hidden") {
    return null;
  }

  if (question.type === "section") {
    return (
      <section className="apple-dark-panel p-6">
        <h2 className="text-2xl font-black">{question.title}</h2>
        {question.description ? (
          <p className="mt-2 text-sm font-semibold leading-6 text-white/72">
            {question.description}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="apple-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#1d1d1f]">{question.title}</h2>
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
          <div className="flex flex-wrap gap-2">
            {question.choices.map((choice) => {
              const active = Array.isArray(value) && value.includes(choice.value);

              return (
                <ChoiceButton
                  key={choice.id}
                  active={active}
                  onClick={() => onToggle(choice.value)}
                >
                  {choice.label}
                </ChoiceButton>
              );
            })}
          </div>
        ) : null}

        {question.type === "scale" ? (
          <ScaleInput question={question} value={Number(value)} onChange={onChange} />
        ) : null}
      </div>
    </section>
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
  value: number;
  onChange: (value: number) => void;
}) {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {values.map((scaleValue) => (
          <ChoiceButton
            key={scaleValue}
            active={value === scaleValue}
            onClick={() => onChange(scaleValue)}
          >
            {scaleValue}
          </ChoiceButton>
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
        "min-h-11 rounded-full border px-4 py-2 text-sm font-black transition",
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white shadow-[0_8px_20px_rgba(70,138,87,0.18)]"
          : "border-[var(--line-strong)] bg-white/78 text-[#1d1d1f] hover:border-[rgba(70,138,87,0.42)] hover:bg-[var(--brand-primary-soft)]",
      )}
    >
      {children}
    </button>
  );
}
