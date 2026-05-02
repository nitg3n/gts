import { z } from "zod";
import { filterSchools, SEOUL_CENTER } from "@/lib/schools";
import type {
  Recommendation,
  School,
  SchoolMetricKey,
  SurveyAnswer,
} from "@/lib/types";
import { distanceKm, metricLabel } from "@/lib/utils";

export const surveyAnswerSchema = z.object({
  level: z.enum(["middle", "high", "all"]).default("all"),
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

export function rankSchools(answer: SurveyAnswer): Recommendation[] {
  const origin =
    typeof answer.lat === "number" && typeof answer.lng === "number"
      ? { lat: answer.lat, lng: answer.lng }
      : SEOUL_CENTER;
  const weights = normalizeWeights(deriveWeights(answer));

  return filterSchools(answer.level)
    .map((school) => {
      const km = distanceKm(origin, school);
      const distanceScore = scoreDistance(km, answer.distancePreference);
      const tagScore = scoreTags(school, answer.preferredTags);
      const weightedScore =
        distanceScore * weights.distance +
        school.metrics.academics * weights.academics +
        school.metrics.activities * weights.activities +
        school.metrics.environment * weights.environment +
        school.metrics.meal * weights.meal +
        school.metrics.reviews * weights.reviews +
        school.metrics.stability * weights.stability;

      return {
        school,
        rank: 0,
        distanceKm: km,
        score: clamp(Math.round(weightedScore * 0.9 + tagScore * 0.1)),
        reasons: buildReasons(school, km, answer, weights),
        caution:
          school.metrics.reviews < 80
            ? "리뷰 데이터가 더 쌓이면 추천 신뢰도가 높아집니다."
            : undefined,
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
  return clamp(55 + matches * 18);
}

function buildReasons(
  school: School,
  km: number,
  answer: SurveyAnswer,
  weights: WeightMap,
) {
  const topMetrics = (Object.entries(school.metrics) as [
    SchoolMetricKey,
    number,
  ][])
    .sort((a, b) => b[1] * weights[b[0]] - a[1] * weights[a[0]])
    .slice(0, 2)
    .map(([metric]) => metricLabel(metric));

  const reasons = [
    `${topMetrics.join("·")} 지표가 설문 우선순위와 잘 맞습니다.`,
    school.highlights[0],
  ];

  if (answer.distancePreference === "near" && km < 5) {
    reasons.unshift("가까운 통학 조건을 강하게 반영했습니다.");
  }

  const matchedTag = answer.preferredTags.find((tag) => school.tags.includes(tag));
  if (matchedTag) {
    reasons.push(`${matchedTag} 관심사와 연결됩니다.`);
  }

  return reasons.slice(0, 3);
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
