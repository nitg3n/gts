"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  GraduationCap,
  MessageSquarePlus,
  MessageSquareText,
  School,
  Star,
} from "lucide-react";
import type { SchoolReview } from "@/lib/types";
import { cn } from "@/lib/utils";

const ratingLabels: Array<{
  key: keyof SchoolReview["ratings"];
  label: string;
  hint: string;
}> = [
  { key: "atmosphere", label: "분위기", hint: "생활 분위기" },
  { key: "exams", label: "시험", hint: "평가 부담" },
  { key: "meals", label: "급식", hint: "식사 만족" },
  { key: "activities", label: "활동", hint: "동아리·행사" },
  { key: "facilities", label: "시설", hint: "공간과 환경" },
];

const defaultRatings: SchoolReview["ratings"] = {
  atmosphere: 4,
  exams: 4,
  meals: 4,
  activities: 4,
  facilities: 4,
};

type ReviewFilter = "all" | SchoolReview["relation"];

export function ReviewsPanel({
  schoolId,
  initialReviews,
}: {
  schoolId: string;
  initialReviews: SchoolReview[];
}) {
  const [reviews, setReviews] = useState<SchoolReview[]>(initialReviews);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [authorName, setAuthorName] = useState("익명 학생");
  const [relation, setRelation] = useState<SchoolReview["relation"]>("current");
  const [enrolledYear, setEnrolledYear] = useState(new Date().getFullYear());
  const [graduatedYear, setGraduatedYear] = useState<number | undefined>();
  const [ratings, setRatings] =
    useState<SchoolReview["ratings"]>(defaultRatings);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleReviews = useMemo(() => {
    if (filter === "all") {
      return reviews;
    }

    return reviews.filter((review) => review.relation === filter);
  }, [filter, reviews]);

  const summary = useMemo(() => buildReviewSummary(reviews), [reviews]);

  async function submitReview() {
    const trimmedBody = body.trim();

    if (trimmedBody.length < 12) {
      setStatus("리뷰는 최소 12자 이상 작성해주세요.");
      return;
    }

    setIsSubmitting(true);
    setStatus("리뷰를 저장하는 중입니다.");

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schoolId,
        authorName: authorName.trim() || "익명 학생",
        relation,
        enrolledYear,
        graduatedYear: relation === "graduate" ? graduatedYear : undefined,
        ratings,
        body: trimmedBody,
      }),
    });

    const data = (await response.json()) as {
      review?: SchoolReview;
      message?: string;
    };

    setIsSubmitting(false);

    if (!response.ok || !data.review) {
      setStatus(data.message ?? "리뷰 저장에 실패했습니다.");
      return;
    }

    setStatus("리뷰가 바로 공개되었습니다.");
    setReviews((current) => [data.review!, ...current]);
    setBody("");
    setRatings(defaultRatings);
    setFilter("all");
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="apple-eyebrow">학교 생활 리뷰</p>
          <h2 className="apple-title mt-2 text-3xl">재학생·졸업생 이야기</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#6e6e73]">
            학교의 분위기, 시험, 활동, 급식처럼 실제 생활에서 느껴지는 부분을
            함께 확인합니다.
          </p>
        </div>
        {summary ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-white/78 px-4 py-2 text-sm font-extrabold text-[#1d1d1f] ring-1 ring-[var(--line)]">
            <Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" aria-hidden />
            {summary.average.toFixed(1)}
            <span className="text-[#86868b]">리뷰 {reviews.length}개</span>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {summary ? (
            <ReviewSummaryCard summary={summary} />
          ) : (
            <EmptyReviewIntro />
          )}

          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              전체 {reviews.length}
            </FilterButton>
            <FilterButton
              active={filter === "current"}
              onClick={() => setFilter("current")}
            >
              재학생 {summary?.currentCount ?? 0}
            </FilterButton>
            <FilterButton
              active={filter === "graduate"}
              onClick={() => setFilter("graduate")}
            >
              졸업생 {summary?.graduateCount ?? 0}
            </FilterButton>
          </div>

          <div className="grid gap-3">
            {visibleReviews.length ? (
              visibleReviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            ) : (
              <div className="apple-panel p-6 text-sm font-semibold leading-6 text-[#6e6e73]">
                이 조건의 리뷰는 아직 없습니다.
              </div>
            )}
          </div>
        </div>

        <aside className="apple-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-extrabold text-[#1d1d1f]">
                <MessageSquarePlus
                  className="h-5 w-5 text-[var(--brand-primary)]"
                  aria-hidden
                />
                리뷰 작성
              </div>
              <p className="mt-1 text-xs font-bold leading-5 text-[#86868b]">
                공개 가능한 경험만 적어주세요.
              </p>
            </div>
            <span className="rounded-full bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--brand-primary)]">
              바로 공개
            </span>
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e8e8ed] bg-white/68 p-4">
            <label className="block">
              <span className="text-xs font-extrabold text-[#6e6e73]">
                이름 또는 별명
              </span>
              <input
                value={authorName}
                onChange={(event) => setAuthorName(event.target.value)}
                className="apple-field mt-1 h-10 w-full px-4 text-sm"
                aria-label="작성자 이름"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2 rounded-full bg-[#f5f5f7] p-1">
              <SegmentButton
                active={relation === "current"}
                onClick={() => setRelation("current")}
              >
                재학생
              </SegmentButton>
              <SegmentButton
                active={relation === "graduate"}
                onClick={() => setRelation("graduate")}
              >
                졸업생
              </SegmentButton>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs font-extrabold text-[#6e6e73]">
                  입학 연도
                </span>
                <input
                  type="number"
                  value={enrolledYear}
                  onChange={(event) => setEnrolledYear(Number(event.target.value))}
                  className="apple-field mt-1 h-10 w-full px-3 text-sm"
                />
              </label>
              {relation === "graduate" ? (
                <label>
                  <span className="text-xs font-extrabold text-[#6e6e73]">
                    졸업 연도
                  </span>
                  <input
                    type="number"
                    value={graduatedYear ?? ""}
                    onChange={(event) =>
                      setGraduatedYear(
                        event.target.value ? Number(event.target.value) : undefined,
                      )
                    }
                    className="apple-field mt-1 h-10 w-full px-3 text-sm"
                  />
                </label>
              ) : (
                <div className="flex items-center rounded-2xl bg-[var(--brand-primary-soft)] px-3 text-xs font-bold leading-5 text-[var(--brand-primary-dark)]">
                  현재 재학 기준
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[20px] border border-[#e8e8ed] bg-white/68 p-4">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#1d1d1f]">
                  항목별 평가
                </p>
                <p className="mt-1 text-xs font-bold text-[#86868b]">
                  1점 낮음, 5점 높음
                </p>
              </div>
              <span className="text-sm font-extrabold text-[var(--brand-primary)]">
                평균 {getRatingAverageFromRatings(ratings).toFixed(1)}
              </span>
            </div>
            {ratingLabels.map((rating) => (
              <RatingSlider
                key={rating.key}
                label={rating.label}
                hint={rating.hint}
                value={ratings[rating.key]}
                onChange={(value) =>
                  setRatings((current) => ({
                    ...current,
                    [rating.key]: value,
                  }))
                }
              />
            ))}
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-extrabold text-[#6e6e73]">
              리뷰 내용
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="학교 분위기, 시험 준비, 급식, 동아리, 시설처럼 직접 겪은 점을 적어주세요."
              className="mt-1 min-h-36 w-full resize-y rounded-[20px] border border-[#d2d2d7] bg-white/90 p-3 text-sm font-semibold leading-6 outline-none transition placeholder:text-[#a1a1a6] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--brand-primary-ring)]"
            />
          </label>
          <button
            type="button"
            onClick={submitReview}
            disabled={isSubmitting}
            className="apple-button-primary mt-3 h-11 w-full text-sm"
          >
            {isSubmitting ? "공개 중" : "리뷰 공개"}
          </button>
          <p className="mt-3 text-xs font-bold leading-5 text-[#86868b]">
            {status || "제출한 리뷰와 평점은 바로 공개됩니다."}
          </p>
        </aside>
      </div>
    </section>
  );
}

function ReviewSummaryCard({
  summary,
}: {
  summary: ReviewSummary;
}) {
  return (
    <div className="apple-panel p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          icon={<Star className="h-4 w-4 fill-[#ff9f0a] text-[#ff9f0a]" />}
          label="평균 만족도"
          value={summary.average.toFixed(1)}
        />
        <SummaryMetric
          icon={<School className="h-4 w-4 text-[var(--brand-primary)]" />}
          label="재학생"
          value={`${summary.currentCount}개`}
        />
        <SummaryMetric
          icon={<GraduationCap className="h-4 w-4 text-[var(--brand-primary)]" />}
          label="졸업생"
          value={`${summary.graduateCount}개`}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="rounded-2xl bg-[var(--brand-primary-soft)] p-4">
          <p className="text-xs font-extrabold text-[var(--brand-primary)]">
            가장 좋은 평가
          </p>
          <p className="mt-2 text-lg font-extrabold text-[#1d1d1f]">
            {summary.best.label}
          </p>
          <p className="mt-1 text-sm font-bold text-[#6e6e73]">
            평균 {summary.best.average.toFixed(1)}
          </p>
        </div>
        <div className="grid gap-2">
          {summary.categoryAverages.map((rating) => (
            <div key={rating.key}>
              <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="text-[#6e6e73]">{rating.label}</span>
                <span className="text-[#1d1d1f]">{rating.average.toFixed(1)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#eef1ec]">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]"
                  style={{ width: `${(rating.average / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: SchoolReview }) {
  const average = getReviewAverage(review);

  return (
    <article className="apple-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-[#1d1d1f]">
              {review.authorName}
            </span>
            <span className="rounded-full bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--brand-primary)]">
              {review.relation === "current" ? "재학생" : "졸업생"}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-[#86868b]">
            {reviewYearLabel(review)} · {formatDate(review.createdAt)}
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-[#fff7e8] px-3 py-1 text-sm font-extrabold text-[#1d1d1f]">
          <Star className="h-3.5 w-3.5 fill-[#ff9f0a] text-[#ff9f0a]" aria-hidden />
          {average.toFixed(1)}
        </div>
      </div>

      <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-[#4f4f55]">
        {review.body}
      </p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {ratingLabels.map((rating) => (
          <span
            key={rating.key}
            className="rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[11px] font-extrabold text-[#6e6e73]"
          >
            {rating.label} {review.ratings[rating.key]}
          </span>
        ))}
      </div>
    </article>
  );
}

function EmptyReviewIntro() {
  return (
    <div className="apple-panel p-6">
      <div className="flex items-start gap-3">
        <div className="apple-icon-bubble h-10 w-10 shrink-0">
          <MessageSquareText className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-[#1d1d1f]">
            아직 공개된 리뷰가 없습니다.
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#6e6e73]">
            이 학교를 알고 있다면 분위기, 시험, 급식, 활동처럼 선택에 도움이
            되는 경험을 남겨주세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e8e8ed] bg-white/70 p-4">
      <div className="flex items-center gap-2 text-xs font-extrabold text-[#86868b]">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-extrabold text-[#1d1d1f]">{value}</div>
    </div>
  );
}

function RatingSlider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="border-t border-[#f1f1f4] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-[#1d1d1f]">{label}</div>
          <div className="text-xs font-bold text-[#86868b]">{hint}</div>
        </div>
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-[var(--brand-primary-soft)] px-2 text-sm font-extrabold text-[var(--brand-primary)]">
          {value}
        </span>
      </div>
      <div className="mt-2">
        <input
          type="range"
          min={1}
          max={5}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full accent-[var(--brand-primary)]"
          aria-label={`${label} 점수`}
        />
        <div className="mt-1 flex justify-between text-[10px] font-bold text-[#a1a1a6]">
          <span>1</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
}

function SegmentButton({
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
        "h-9 rounded-full text-sm font-extrabold transition",
        active
          ? "bg-white text-[var(--brand-primary)] shadow-[0_4px_12px_rgba(29,29,31,0.06)] ring-1 ring-[rgba(70,138,87,0.18)]"
          : "text-[#6e6e73] hover:bg-white/70",
      )}
    >
      {children}
    </button>
  );
}

function FilterButton({
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
        "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-extrabold transition",
        active
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white"
          : "border-[#e8e8ed] bg-white/80 text-[#6e6e73] hover:bg-[var(--brand-primary-soft)]",
      )}
    >
      {children}
    </button>
  );
}

type ReviewSummary = {
  average: number;
  currentCount: number;
  graduateCount: number;
  best: {
    label: string;
    average: number;
  };
  categoryAverages: Array<{
    key: keyof SchoolReview["ratings"];
    label: string;
    average: number;
  }>;
};

function buildReviewSummary(reviews: SchoolReview[]): ReviewSummary | undefined {
  if (!reviews.length) {
    return undefined;
  }

  const categoryAverages = ratingLabels.map((rating) => ({
    key: rating.key,
    label: rating.label,
    average: getRatingAverage(reviews, rating.key),
  }));
  const best = [...categoryAverages].sort((a, b) => b.average - a.average)[0];

  return {
    average:
      reviews.reduce((sum, review) => sum + getReviewAverage(review), 0) /
      reviews.length,
    currentCount: reviews.filter((review) => review.relation === "current").length,
    graduateCount: reviews.filter((review) => review.relation === "graduate").length,
    best,
    categoryAverages,
  };
}

function getReviewAverage(review: SchoolReview) {
  const values = Object.values(review.ratings);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRatingAverageFromRatings(ratings: SchoolReview["ratings"]) {
  const values = Object.values(ratings);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRatingAverage(
  reviews: SchoolReview[],
  key: keyof SchoolReview["ratings"],
) {
  return (
    reviews.reduce((sum, review) => sum + review.ratings[key], 0) /
    reviews.length
  );
}

function reviewYearLabel(review: SchoolReview) {
  if (review.relation === "graduate") {
    return `${review.enrolledYear} 입학${
      review.graduatedYear ? ` · ${review.graduatedYear} 졸업` : ""
    }`;
  }

  return `${review.enrolledYear} 입학`;
}

function formatDate(value: string) {
  return value.slice(0, 10).replaceAll("-", ".");
}
