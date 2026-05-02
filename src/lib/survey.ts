import { schoolSelectionSurvey } from "@/data/surveys";
import type { CleanSurvey, SurveyQuestion } from "@/data/surveys";
import type { SchoolLevel, SchoolMetricKey, StudentStage, SurveyAnswer } from "@/lib/types";

export type SurveyResponseValue = string | string[] | number;
export type SurveyResponseMap = Record<string, SurveyResponseValue>;

export function getDefaultSurveyResponses(
  survey: CleanSurvey = schoolSelectionSurvey,
): SurveyResponseMap {
  return Object.fromEntries(
    survey.questions.flatMap((question) => {
      if (question.type === "section") {
        return [];
      }

      if (question.type === "scale") {
        return [[question.id, question.defaultValue ?? 3]];
      }

      if (question.type === "multi") {
        return [[question.id, question.defaultValue ?? []]];
      }

      return [[question.id, question.defaultValue ?? question.choices?.[0]?.value ?? ""]];
    }),
  );
}

export function deriveSurveyAnswer(
  responses: SurveyResponseMap,
  location?: { lat: number; lng: number },
  survey: CleanSurvey = schoolSelectionSurvey,
): SurveyAnswer {
  const studentStage = getStudentStage(responses);
  const priorityScores = getPriorityScores(responses, survey);
  const priorities = Object.entries(priorityScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([metric]) => metric as SchoolMetricKey);

  return {
    level: getTargetLevelForStage(studentStage, responses, survey),
    studentStage,
    distancePreference: deriveDistancePreference(responses),
    priorities,
    preferredTags: derivePreferredTags(responses),
    genderPreference: normalizeGenderPreference(responses.genderPreference),
    categoryPreference: normalizeTextPreference(responses.categoryPreference),
    rawResponses: responses,
    ...location,
  };
}

export function getStudentStage(responses: SurveyResponseMap): StudentStage {
  return responses.studentStage === "elementary" ? "elementary" : "middle";
}

export function getTargetLevelForStage(
  studentStage: StudentStage,
  responses: SurveyResponseMap,
  survey: CleanSurvey,
): SchoolLevel | "all" {
  if (studentStage === "elementary") {
    return "middle";
  }

  return normalizeLevel(responses.targetLevel, survey);
}

export function getVisibleSurveyQuestions(
  survey: CleanSurvey,
  responses: SurveyResponseMap,
) {
  const studentStage = getStudentStage(responses);

  return survey.questions.filter((question) => {
    if (!question.visibleForStages) {
      return true;
    }

    return question.visibleForStages.includes(studentStage);
  });
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

  getVisibleSurveyQuestions(survey, responses).forEach((question) => {
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

function normalizeScaleValue(question: SurveyQuestion, value: SurveyResponseValue) {
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

  if (commuteTime === "any" || importance <= 2) {
    return "not-important";
  }

  if (
    commuteTime === "very-near" ||
    commuteTime === "near" ||
    importance >= 4
  ) {
    return "near";
  }

  return "balanced";
}

function derivePreferredTags(responses: SurveyResponseMap) {
  const tags = new Set<string>();
  const category = String(responses.categoryPreference ?? "");
  const middleEnvironment = String(responses.middleEnvironmentPreference ?? "");

  if (category === "과학고") {
    tags.add("과학");
    tags.add("연구");
  }

  if (category === "특성화고" || category === "마이스터고") {
    tags.add("실습");
    tags.add("취업");
  }

  if (category === "일반고") {
    tags.add("진학");
  }

  if (middleEnvironment === "study") {
    tags.add("학업");
  }

  if (middleEnvironment === "activity") {
    tags.add("동아리");
  }

  if (middleEnvironment === "care") {
    tags.add("상담");
    tags.add("생활지도");
  }

  if (middleEnvironment === "near") {
    tags.add("통학");
  }

  if (Number(responses.schoolLife ?? 3) >= 4) {
    tags.add("동아리");
  }

  if (Number(responses.facilityMeal ?? 3) >= 4) {
    tags.add("급식");
  }

  return Array.from(tags).slice(0, 5);
}

function normalizeLevel(
  value: SurveyResponseValue | undefined,
  survey: CleanSurvey,
) {
  return value === "middle" || value === "high" || value === "all"
    ? value
    : survey.defaultTargetLevel;
}

function normalizeGenderPreference(value: SurveyResponseValue | undefined) {
  if (value === "single-gender" || value === "any") {
    return value;
  }

  if (value === "coed" || value === "coed-separated" || value === "coed-mixed") {
    return "coed";
  }

  return "any";
}

function normalizeTextPreference(value: SurveyResponseValue | undefined) {
  if (typeof value !== "string" || value === "any" || value === "other") {
    return undefined;
  }

  return value;
}
