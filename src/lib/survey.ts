import { schoolSelectionSurvey } from "@/data/surveys";
import type { CleanSurvey, SurveyQuestion } from "@/data/surveys";
import type { SchoolMetricKey, SurveyAnswer } from "@/lib/types";

export type SurveyResponseValue = string | string[] | number;
export type SurveyResponseMap = Record<string, SurveyResponseValue | undefined>;

export function getDefaultSurveyResponses(
  survey: CleanSurvey = schoolSelectionSurvey,
): SurveyResponseMap {
  return Object.fromEntries(
    survey.questions.flatMap((question) => {
      if (question.type === "section") {
        return [];
      }

      if (question.type === "multi") {
        return [[question.id, []]];
      }

      return [];
    }),
  );
}

export function deriveSurveyAnswer(
  responses: SurveyResponseMap,
  location?: { lat: number; lng: number },
  survey: CleanSurvey = schoolSelectionSurvey,
): SurveyAnswer {
  const priorityScores = getPriorityScores(responses, survey);
  const priorities = Object.entries(priorityScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([metric]) => metric as SchoolMetricKey);

  return {
    distancePreference: deriveDistancePreference(responses),
    priorities,
    preferredTags: derivePreferredTags(responses),
    studentGender: normalizeStudentGender(responses.studentGender),
    genderPreference: normalizeGenderPreference(responses.genderPreference),
    categoryPreference: deriveCategoryPreference(responses),
    rawResponses: compactSurveyResponses(responses),
    ...location,
  };
}

export function getVisibleSurveyQuestions(
  survey: CleanSurvey,
) {
  return survey.questions;
}

export function getChoiceLabel(questionId: string, value: SurveyResponseValue) {
  const question = schoolSelectionSurvey.questions.find(
    (item) => item.id === questionId,
  );

  if (!question?.choices || Array.isArray(value)) {
    return String(value);
  }

  return (
    question.choices.find((choice) => choice.value === value)?.label ??
    String(value)
  );
}

function getPriorityScores(responses: SurveyResponseMap, survey: CleanSurvey) {
  const scores: Record<SchoolMetricKey, number> = {
    academics: 0,
    activities: 0,
    environment: 0,
    meal: 0,
    reviews: 0,
    stability: 0,
  };

  getVisibleSurveyQuestions(survey).forEach((question) => {
    if (question.type !== "scale" || !question.weightTargets) {
      return;
    }

    const score = normalizeScaleValue(question, responses[question.id]);

    question.weightTargets.forEach((target) => {
      if (target === "distance") {
        return;
      }

      scores[target] += score;
    });
  });

  return scores;
}

function normalizeScaleValue(
  question: SurveyQuestion,
  value: SurveyResponseValue | undefined,
) {
  const min = question.min ?? 1;
  const max = question.max ?? 5;
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 3;
  }

  return Math.min(max, Math.max(min, numeric));
}

function deriveDistancePreference(responses: SurveyResponseMap) {
  const importance = Number(responses.commuteImportance ?? 3);
  const commuteTime = String(responses.commuteTime ?? "balanced");
  const transitionConcerns = toStringArray(responses.transitionConcern);

  if (commuteTime === "any" || importance <= 2) {
    return "not-important";
  }

  if (
    commuteTime === "very-near" ||
    commuteTime === "near" ||
    importance >= 4 ||
    transitionConcerns.includes("commute")
  ) {
    return "near";
  }

  return "balanced";
}

function derivePreferredTags(responses: SurveyResponseMap) {
  const tags = new Set<string>();
  const category = String(responses.categoryPreference ?? "");
  const careerDirection = String(responses.careerDirection ?? "");
  const transitionConcerns = toStringArray(responses.transitionConcern);
  const activityPreference = toStringArray(responses.activityPreference);

  if (category === "영재학교" || category === "과학고") {
    if (category === "영재학교") {
      tags.add("영재");
    }
    tags.add("과학");
    tags.add("연구");
  }

  if (category === "외국어고") {
    tags.add("외국어");
    tags.add("국제");
  }

  if (category === "특성화고" || category === "마이스터고") {
    tags.add("실습");
    tags.add("취업");
  }

  if (category === "예술고" || category === "체육고") {
    tags.add("예술");
    tags.add("체육");
  }

  if (category === "일반고") {
    tags.add("진학");
  }

  if (careerDirection === "college") {
    tags.add("진학");
    tags.add("학업");
  }

  if (careerDirection === "science") {
    tags.add("영재");
    tags.add("과학");
    tags.add("연구");
    tags.add("프로젝트");
  }

  if (careerDirection === "global") {
    tags.add("외국어");
    tags.add("국제");
  }

  if (careerDirection === "practical") {
    tags.add("실습");
    tags.add("취업");
    tags.add("진로");
  }

  if (careerDirection === "arts-sports") {
    tags.add("예술");
    tags.add("체육");
    tags.add("활동");
  }

  if (transitionConcerns.includes("study")) {
    tags.add("학습지원");
    tags.add("학업");
  }

  if (transitionConcerns.includes("friends")) {
    tags.add("상담");
    tags.add("생활지도");
  }

  if (transitionConcerns.includes("care")) {
    tags.add("생활지도");
    tags.add("상담");
  }

  if (transitionConcerns.includes("commute")) {
    tags.add("통학");
  }

  if (transitionConcerns.includes("activity")) {
    tags.add("동아리");
    tags.add("활동");
  }

  if (activityPreference.includes("club")) {
    tags.add("동아리");
  }

  if (activityPreference.includes("project")) {
    tags.add("프로젝트");
    tags.add("발표");
  }

  if (activityPreference.includes("reading")) {
    tags.add("독서");
    tags.add("도서관");
  }

  if (activityPreference.includes("career")) {
    tags.add("진로");
  }

  if (activityPreference.includes("arts-sports")) {
    tags.add("예술");
    tags.add("체육");
  }

  if (activityPreference.includes("community")) {
    tags.add("봉사");
    tags.add("학생자치");
  }

  if (Number(responses.learningSupportNeed ?? 3) >= 4) {
    tags.add("학습지원");
    tags.add("진학");
  }

  if (Number(responses.relationshipSafety ?? 3) >= 4) {
    tags.add("상담");
    tags.add("생활지도");
  }

  if (Number(responses.schoolLife ?? 3) >= 4) {
    tags.add("동아리");
  }

  if (Number(responses.facilityMeal ?? 3) >= 4) {
    tags.add("급식");
  }

  return Array.from(tags).slice(0, 8);
}

function deriveCategoryPreference(responses: SurveyResponseMap) {
  const explicit = normalizeTextPreference(responses.categoryPreference);

  if (explicit) {
    return explicit;
  }

  const careerDirection = String(responses.careerDirection ?? "");

  if (careerDirection === "science") {
    return "과학고";
  }

  if (careerDirection === "global") {
    return "외국어고";
  }

  if (careerDirection === "practical") {
    return "특성화고";
  }

  return undefined;
}

function normalizeGenderPreference(value: SurveyResponseValue | undefined) {
  if (value === "single-gender" || value === "any") {
    return value;
  }

  if (
    value === "coed" ||
    value === "coed-separated" ||
    value === "coed-class-separated" ||
    value === "coed-mixed"
  ) {
    return "coed";
  }

  return "any";
}

function normalizeStudentGender(value: SurveyResponseValue | undefined) {
  if (value === "male" || value === "female") {
    return value;
  }

  return undefined;
}

function normalizeTextPreference(value: SurveyResponseValue | undefined) {
  if (typeof value !== "string" || value === "any" || value === "other") {
    return undefined;
  }

  return value;
}

function toStringArray(value: SurveyResponseValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function compactSurveyResponses(responses: SurveyResponseMap) {
  return Object.fromEntries(
    Object.entries(responses).filter((entry): entry is [string, SurveyResponseValue] => {
      const [, value] = entry;
      return value !== undefined;
    }),
  );
}
