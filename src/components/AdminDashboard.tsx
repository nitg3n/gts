"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ClipboardList,
  Plus,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { CleanSurvey, SurveyQuestion, SurveyQuestionType } from "@/data/surveys";
import type { PublicRuntimeConfig, SchoolReview } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminTab = "surveys" | "reviews";

const questionTypes: Array<{ label: string; value: SurveyQuestionType }> = [
  { label: "단일 선택", value: "single" },
  { label: "복수 선택", value: "multi" },
  { label: "척도", value: "scale" },
  { label: "섹션", value: "section" },
];

const metricTargets = [
  "academics",
  "activities",
  "environment",
  "meal",
  "reviews",
  "stability",
  "distance",
] as const;

export function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>("surveys");
  const [config, setConfig] = useState<PublicRuntimeConfig>();
  const [accessToken, setAccessToken] = useState<string>();
  const [reviews, setReviews] = useState<SchoolReview[]>([]);
  const [surveys, setSurveys] = useState<CleanSurvey[]>([]);
  const [activeSurveyId, setActiveSurveyId] = useState("");
  const [draftSurvey, setDraftSurvey] = useState<CleanSurvey>();
  const [status, setStatus] = useState("관리자 도구를 불러오는 중");
  const [surveyStatus, setSurveyStatus] = useState("");

  const authHeaders = useCallback(
    () =>
      accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    [accessToken],
  );

  const loadReviews = useCallback(async () => {
    const response = await fetch("/api/admin/reviews", {
      headers: authHeaders(),
    });
    const data = (await response.json()) as {
      reviews?: SchoolReview[];
      message?: string;
    };

    if (!response.ok || !data.reviews) {
      setStatus(data.message ?? "검수 목록을 불러오지 못했습니다.");
      return;
    }

    setReviews(data.reviews);
    setStatus(`리뷰 ${data.reviews.length}건`);
  }, [authHeaders]);

  const loadSurveys = useCallback(async () => {
    const response = await fetch("/api/admin/surveys", {
      headers: authHeaders(),
    });
    const data = (await response.json()) as {
      surveys?: CleanSurvey[];
      activeSurveyId?: string;
      message?: string;
    };

    if (!response.ok || !data.surveys) {
      setSurveyStatus(data.message ?? "설문 목록을 불러오지 못했습니다.");
      return;
    }

    const activeId = data.activeSurveyId ?? data.surveys[0]?.id ?? "";
    setSurveys(data.surveys);
    setActiveSurveyId(activeId);
    setDraftSurvey(
      data.surveys.find((survey) => survey.id === activeId) ?? data.surveys[0],
    );
    setSurveyStatus("설문을 편집할 수 있습니다.");
  }, [authHeaders]);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.json())
      .then(async (runtimeConfig: PublicRuntimeConfig) => {
        setConfig(runtimeConfig);
        const supabase = createBrowserSupabaseClient(runtimeConfig);
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        setAccessToken(token);

        await Promise.all([loadSurveys(), loadReviews()]);
      })
      .catch(() => {
        setStatus("관리자 설정을 불러오지 못했습니다.");
        setSurveyStatus("설문 설정을 불러오지 못했습니다.");
      });
  }, [loadReviews, loadSurveys]);

  const pendingCount = useMemo(
    () => reviews.filter((review) => review.status === "pending").length,
    [reviews],
  );

  async function saveSurvey() {
    if (!draftSurvey) {
      return;
    }

    setSurveyStatus("설문을 저장하는 중");
    const response = await fetch("/api/admin/surveys", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        survey: draftSurvey,
        activeSurveyId: draftSurvey.id,
      }),
    });
    const data = (await response.json()) as {
      survey?: CleanSurvey;
      surveys?: CleanSurvey[];
      activeSurveyId?: string;
      message?: string;
    };

    if (!response.ok || !data.survey) {
      setSurveyStatus(data.message ?? "설문 저장에 실패했습니다.");
      return;
    }

    setDraftSurvey(data.survey);
    setSurveys(data.surveys ?? [data.survey]);
    setActiveSurveyId(data.activeSurveyId ?? data.survey.id);
    setSurveyStatus("저장됐습니다. /survey 화면에 바로 반영됩니다.");
  }

  async function updateStatus(id: string, nextStatus: SchoolReview["status"]) {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ status: nextStatus }),
    });

    if (response.ok) {
      setReviews((current) =>
        current.map((review) =>
          review.id === id ? { ...review, status: nextStatus } : review,
        ),
      );
    }
  }

  return (
    <div className="apple-page">
      <section className="apple-section">
        <div className="apple-shell py-12 lg:py-16">
          <p className="apple-eyebrow flex items-center gap-2">
            <Shield className="h-4 w-4" aria-hidden />
            Admin
          </p>
          <h1 className="apple-title mt-3 text-5xl leading-[1.04] sm:text-6xl">
            설문·리뷰 관리
          </h1>
          <p className="apple-copy mt-4 max-w-2xl text-base">
            설문 구성과 공개 리뷰 상태를 관리합니다.
          </p>
        </div>
      </section>

      <section className="apple-shell grid gap-6 py-10 lg:grid-cols-[300px_1fr]">
        <aside className="apple-panel p-5 lg:sticky lg:top-24 lg:self-start">
          <div className="text-sm font-black text-[#86868b]">상태</div>
          <div className="mt-2 text-xl font-black text-[#1d1d1f]">
            {tab === "surveys" ? surveyStatus : status}
          </div>
          <div className="mt-6 divide-y divide-[#f1f1f4] rounded-2xl border border-[#e8e8ed] bg-white/60 text-sm">
            <AdminStatusLine
              label="Supabase"
              value={config?.hasSupabase ? "연결됨" : "로컬 모드"}
            />
            <AdminStatusLine label="활성 설문" value={activeSurveyId || "-"} />
            <AdminStatusLine label="검수 대기" value={`${pendingCount}건`} />
          </div>
          <div className="mt-6 grid gap-2">
            <TabButton
              active={tab === "surveys"}
              onClick={() => setTab("surveys")}
            >
              설문 관리
            </TabButton>
            <TabButton
              active={tab === "reviews"}
              onClick={() => setTab("reviews")}
            >
              리뷰 검수
            </TabButton>
          </div>
        </aside>

        {tab === "surveys" && draftSurvey ? (
          <SurveyEditor
            survey={draftSurvey}
            surveys={surveys}
            onSelect={(surveyId) => {
              const nextSurvey = surveys.find((survey) => survey.id === surveyId);
              if (nextSurvey) {
                setDraftSurvey(nextSurvey);
                setActiveSurveyId(surveyId);
              }
            }}
            onChange={setDraftSurvey}
            onSave={saveSurvey}
            status={surveyStatus}
          />
        ) : null}

        {tab === "reviews" ? (
          <ReviewModeration reviews={reviews} onUpdateStatus={updateStatus} />
        ) : null}
      </section>
    </div>
  );
}

function SurveyEditor({
  survey,
  surveys,
  onSelect,
  onChange,
  onSave,
  status,
}: {
  survey: CleanSurvey;
  surveys: CleanSurvey[];
  onSelect: (surveyId: string) => void;
  onChange: (survey: CleanSurvey) => void;
  onSave: () => void;
  status: string;
}) {
  const [questionCounter, setQuestionCounter] = useState(1);

  function updateSurvey(patch: Partial<CleanSurvey>) {
    onChange({ ...survey, ...patch });
  }

  function updateQuestion(index: number, patch: Partial<SurveyQuestion>) {
    const questions = survey.questions.map((question, itemIndex) =>
      itemIndex === index ? { ...question, ...patch } : question,
    );
    updateSurvey({ questions });
  }

  function removeQuestion(index: number) {
    updateSurvey({
      questions: survey.questions.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function addQuestion(type: SurveyQuestionType) {
    const id = `q-new-${questionCounter}`;
    setQuestionCounter((current) => current + 1);
    const question: SurveyQuestion =
      type === "scale"
        ? {
            id,
            type,
            title: "새 척도 질문",
            min: 1,
            max: 5,
            minLabel: "낮음",
            maxLabel: "높음",
            defaultValue: 3,
            weightTargets: ["environment"],
          }
        : type === "section"
          ? {
              id,
              type,
              title: "새 섹션",
              description: "질문 묶음 설명",
            }
          : {
              id,
              type,
              title: "새 선택 질문",
              defaultValue: "option-1",
              choices: [
                { id: `${id}-1`, label: "선택지 1", value: "option-1" },
                { id: `${id}-2`, label: "선택지 2", value: "option-2" },
              ],
            };

    updateSurvey({ questions: [...survey.questions, question] });
  }

  return (
    <main className="space-y-5">
      <div className="apple-panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-lg font-black text-[#1d1d1f]">
            <ClipboardList className="h-5 w-5 text-[#468A57]" aria-hidden />
            설문 빌더
          </div>
          <select
            value={survey.id}
            onChange={(event) => onSelect(event.target.value)}
            className="apple-field h-10 px-4 text-sm"
          >
            {surveys.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-5 grid gap-3">
          <AdminInput
            label="설문 제목"
            value={survey.title}
            onChange={(value) => updateSurvey({ title: value })}
          />
          <AdminInput
            label="대상"
            value={survey.audience}
            onChange={(value) => updateSurvey({ audience: value })}
          />
          <label>
            <div className="mb-1 text-xs font-black text-[#6e6e73]">설명</div>
            <textarea
              value={survey.description}
              onChange={(event) =>
                updateSurvey({ description: event.target.value })
              }
              className="min-h-24 w-full rounded-2xl border border-[#d2d2d7] bg-white/90 p-3 text-sm font-semibold leading-6 outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-ring)]"
            />
          </label>
        </div>
      </div>

      <div className="apple-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-white/48 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-black text-[#1d1d1f]">
            질문 {survey.questions.length}개
          </div>
          <div className="flex flex-wrap gap-2">
            {questionTypes.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => addQuestion(item.value)}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-white px-3 text-xs font-black text-[#1d1d1f] ring-1 ring-[var(--line-strong)] transition hover:bg-[var(--brand-primary-soft)]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#f1f1f4]">
          {survey.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              question={question}
              onChange={(patch) => updateQuestion(index, patch)}
              onRemove={() => removeQuestion(index)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-[#6e6e73]">{status}</p>
        <button
          type="button"
          onClick={onSave}
          className="apple-button-primary h-11 gap-2 px-5 text-sm"
        >
          <Save className="h-4 w-4" aria-hidden />
          설문 저장
        </button>
      </div>
    </main>
  );
}

function QuestionEditor({
  question,
  onChange,
  onRemove,
}: {
  question: SurveyQuestion;
  onChange: (patch: Partial<SurveyQuestion>) => void;
  onRemove: () => void;
}) {
  const choiceText =
    question.choices?.map((choice) => choice.label).join("\n") ?? "";

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[160px_1fr_44px]">
      <select
        value={question.type}
        onChange={(event) =>
          onChange({ type: event.target.value as SurveyQuestionType })
        }
        className="apple-field h-10 px-3 text-sm"
      >
        {questionTypes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <div className="space-y-3">
        <AdminInput
          label="질문"
          value={question.title}
          onChange={(value) => onChange({ title: value })}
        />
        {question.type === "single" || question.type === "multi" ? (
          <label>
            <div className="mb-1 text-xs font-black text-[#6e6e73]">
              선택지, 한 줄에 하나
            </div>
            <textarea
              value={choiceText}
              onChange={(event) =>
                onChange({
                  choices: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((label, index) => ({
                      id: `${question.id}-choice-${index + 1}`,
                      label,
                      value: label,
                    })),
                })
              }
              className="min-h-24 w-full rounded-2xl border border-[#d2d2d7] bg-white/90 p-3 text-sm font-semibold leading-6 outline-none transition focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-ring)]"
            />
          </label>
        ) : null}
        {question.type === "scale" ? (
          <div>
            <div className="mb-2 text-xs font-black text-[#6e6e73]">
              추천 가중치
            </div>
            <div className="flex flex-wrap gap-2">
              {metricTargets.map((metric) => {
                const active = question.weightTargets?.includes(metric);
                return (
                  <button
                    key={metric}
                    type="button"
                    onClick={() =>
                      onChange({
                        weightTargets: active
                          ? question.weightTargets?.filter(
                              (item) => item !== metric,
                            )
                          : [...(question.weightTargets ?? []), metric],
                      })
                    }
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-black transition",
                      active
                        ? "bg-[var(--brand-primary)] text-white"
                        : "bg-white/72 text-[#6e6e73] ring-1 ring-[var(--line)] hover:bg-[var(--brand-primary-soft)]",
                    )}
                  >
                    {metric}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRemove}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/72 text-[#6e6e73] ring-1 ring-[var(--line)] transition hover:bg-[#ff3b30] hover:text-white"
        aria-label="질문 삭제"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function ReviewModeration({
  reviews,
  onUpdateStatus,
}: {
  reviews: SchoolReview[];
  onUpdateStatus: (id: string, status: SchoolReview["status"]) => void;
}) {
  return (
    <main className="apple-panel overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[1fr_120px_180px] border-b border-[var(--line)] bg-white/48 px-4 py-3 text-xs font-black text-[#86868b]">
        <span>리뷰</span>
        <span>상태</span>
        <span>검수</span>
      </div>
      {reviews.map((review) => (
        <div
          key={review.id}
          className="apple-row-hover grid min-w-[720px] grid-cols-[1fr_120px_180px] items-center border-b border-[#f1f1f4] px-4 py-4 last:border-b-0"
        >
          <div>
            <div className="font-black text-[#1d1d1f]">{review.authorName}</div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#6e6e73]">
              {review.body}
            </p>
          </div>
          <div className="text-sm font-black text-[#6e6e73]">{review.status}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onUpdateStatus(review.id, "approved")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759] text-white transition hover:brightness-95"
              aria-label="승인"
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus(review.id, "rejected")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d1f] text-white transition hover:bg-[#ff3b30]"
              aria-label="반려"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}

function TabButton({
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
        "h-11 rounded-full px-4 text-left text-sm font-black transition",
        active
          ? "bg-[#1d1d1f] text-white shadow-sm"
          : "bg-white/72 text-[#6e6e73] hover:bg-[var(--brand-primary-soft)] hover:text-[#1d1d1f]",
      )}
    >
      {children}
    </button>
  );
}

function AdminInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <div className="mb-1 text-xs font-black text-[#6e6e73]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="apple-field h-10 w-full px-4 text-sm"
      />
    </label>
  );
}

function AdminStatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="font-bold text-[#86868b]">{label}</span>
      <span className="truncate text-right font-black text-[#1d1d1f]">{value}</span>
    </div>
  );
}
