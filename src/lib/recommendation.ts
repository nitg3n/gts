import { z } from "zod";
import { filterSchools, SEOUL_CENTER } from "@/lib/schools";
import type {
  Recommendation,
  School,
  SchoolMetricKey,
  SurveyAnswer,
} from "@/lib/types";
import { getPublicFactItems, getPublicFactValue } from "@/lib/public-facts";
import { distanceKm } from "@/lib/utils";

export const surveyAnswerSchema = z.object({
  level: z.enum(["middle", "high", "all"]).default("all"),
  studentStage: z.enum(["elementary", "middle"]).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  distancePreference: z
    .enum(["near", "balanced", "not-important"])
    .default("balanced"),
  priorities: z
    .array(
      z.enum([
        "academics",
        "activities",
        "environment",
        "meal",
        "reviews",
        "stability",
      ]),
    )
    .default(["academics", "activities", "environment"]),
  preferredTags: z.array(z.string()).default([]),
  genderPreference: z.enum(["single-gender", "coed", "any"]).optional(),
  categoryPreference: z.string().optional(),
  rawResponses: z
    .record(z.string(), z.union([z.string(), z.number(), z.array(z.string())]))
    .optional(),
});

type WeightMap = Record<SchoolMetricKey | "distance", number>;

const defaultWeights: WeightMap = {
  distance: 0.25,
  academics: 0.22,
  activities: 0.18,
  environment: 0.14,
  meal: 0.07,
  reviews: 0.08,
  stability: 0.06,
};

export function rankSchools(
  answer: SurveyAnswer,
  candidates = filterSchools(answer.level),
): Recommendation[] {
  const origin =
    typeof answer.lat === "number" && typeof answer.lng === "number"
      ? { lat: answer.lat, lng: answer.lng }
      : SEOUL_CENTER;
  const weights = normalizeWeights(deriveWeights(answer));

  return candidates
    .filter((school) => answer.level === "all" || school.level === answer.level)
    .map((school) => {
      const km = distanceKm(origin, school);
      const distanceScore = scoreDistance(km, answer.distancePreference);
      const priorityScore = scorePriorityFit(school, answer, weights);
      const tagScore = scoreTags(school, answer.preferredTags);
      const preferenceScore = scorePreferenceFit(school, answer);
      const weightedScore =
        distanceScore * weights.distance +
        priorityScore * (1 - weights.distance);

      return {
        school,
        rank: 0,
        distanceKm: km,
        score: clamp(
          Math.round(weightedScore * 0.74 + tagScore * 0.14 + preferenceScore * 0.12),
        ),
        reasons: buildReasons(school, km, answer),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

function deriveWeights(answer: SurveyAnswer): WeightMap {
  const weights = { ...defaultWeights };

  if (answer.distancePreference === "near") {
    weights.distance += 0.18;
    weights.academics -= 0.06;
    weights.activities -= 0.05;
    weights.environment -= 0.04;
  }

  if (answer.distancePreference === "not-important") {
    weights.distance = 0.05;
    weights.academics += 0.07;
    weights.activities += 0.06;
    weights.environment += 0.04;
    weights.reviews += 0.03;
  }

  answer.priorities.forEach((priority, index) => {
    weights[priority] += index === 0 ? 0.1 : 0.06;
  });

  return weights;
}

function normalizeWeights(weights: WeightMap): WeightMap {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value / total]),
  ) as WeightMap;
}

function scoreDistance(km: number, preference: SurveyAnswer["distancePreference"]) {
  const penalty = preference === "near" ? 12 : preference === "balanced" ? 7 : 2;
  return clamp(100 - km * penalty);
}

function scoreTags(school: School, preferredTags: string[]) {
  if (preferredTags.length === 0) {
    return 70;
  }

  const matches = preferredTags.filter((tag) => school.tags.includes(tag)).length;
  return clamp(52 + matches * 24);
}

function scorePreferenceFit(school: School, answer: SurveyAnswer) {
  let score = 70;

  if (answer.categoryPreference) {
    score += school.category.includes(answer.categoryPreference) ? 18 : -8;
  }

  if (answer.genderPreference === "coed") {
    score += school.gender === "coed" ? 12 : -4;
  }

  if (answer.genderPreference === "single-gender") {
    score += school.gender !== "coed" ? 12 : -4;
  }

  return clamp(score);
}

function scorePriorityFit(
  school: School,
  answer: SurveyAnswer,
  weights: WeightMap,
) {
  const priorities = answer.priorities.length
    ? answer.priorities
    : (["academics", "activities", "environment"] satisfies SchoolMetricKey[]);
  const totalWeight = priorities.reduce(
    (sum, priority) => sum + weights[priority],
    0,
  );

  if (totalWeight <= 0) {
    return 70;
  }

  return priorities.reduce(
    (sum, priority) =>
      sum + scoreSchoolSignal(school, priority) * (weights[priority] / totalWeight),
    0,
  );
}

function scoreSchoolSignal(school: School, priority: SchoolMetricKey) {
  if (priority === "activities") {
    const clubs = getPublicFactValue(school, "clubs");
    if (clubs) {
      return clamp(55 + clubs * 1.1);
    }

    return hasAnyTag(school, ["동아리", "활동", "실습", "프로젝트"]) ? 72 : 62;
  }

  if (priority === "environment") {
    const students = getPublicFactValue(school, "students");
    const classes = getPublicFactValue(school, "classes");

    if (students && classes) {
      const studentsPerClass = students / classes;
      return clamp(98 - studentsPerClass);
    }

    return 68;
  }

  if (priority === "stability") {
    const students = getPublicFactValue(school, "students");
    const teachers = getPublicFactValue(school, "teachers");

    if (students && teachers) {
      const studentsPerTeacher = students / teachers;
      return clamp(100 - studentsPerTeacher * 2.2);
    }

    return 68;
  }

  if (priority === "academics") {
    if (school.level === "high" && /과학|외국어|국제|마이스터|특성화/.test(school.category)) {
      return 76;
    }

    return school.level === "high" ? 70 : 66;
  }

  if (priority === "meal") {
    return hasAnyTag(school, ["급식"]) ? 70 : 60;
  }

  if (priority === "reviews") {
    return 60;
  }

  return 65;
}

function hasAnyTag(school: School, tags: string[]) {
  return tags.some((tag) => school.tags.some((schoolTag) => schoolTag.includes(tag)));
}

function buildReasons(
  school: School,
  km: number,
  answer: SurveyAnswer,
) {
  const reasons: string[] = [];

  if (
    answer.categoryPreference &&
    school.category.includes(answer.categoryPreference)
  ) {
    reasons.unshift(`${answer.categoryPreference} 선호와 일치합니다.`);
  }

  if (answer.genderPreference === "coed" && school.gender === "coed") {
    reasons.push("공학 선호를 반영했습니다.");
  }

  if (answer.genderPreference === "single-gender" && school.gender !== "coed") {
    reasons.push("남고·여고 선호를 반영했습니다.");
  }

  if (answer.distancePreference === "near" && km < 5) {
    reasons.unshift("가까운 통학 조건을 강하게 반영했습니다.");
  }

  const matchedTag = answer.preferredTags.find((tag) => school.tags.includes(tag));
  if (matchedTag) {
    reasons.push(`${matchedTag} 관심사와 연결됩니다.`);
  }

  const publicFacts = getPublicFactItems(school);
  const clubFact = publicFacts.find((fact) => fact.key === "clubs");

  if (
    clubFact &&
    answer.preferredTags.some((tag) => tag.includes("동아리") || tag.includes("활동"))
  ) {
    reasons.push(`학교 공시에서 ${clubFact.label} ${clubFact.value}가 확인됩니다.`);
  } else if (publicFacts.length) {
    reasons.push(
      `학교 공시에서 ${publicFacts
        .slice(0, 2)
        .map((fact) => `${fact.shortLabel} ${fact.value}`)
        .join(", ")}가 확인됩니다.`,
    );
  }

  if (school.highlights[0]) {
    reasons.push(school.highlights[0]);
  }

  return [...new Set(reasons)].slice(0, 3);
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
