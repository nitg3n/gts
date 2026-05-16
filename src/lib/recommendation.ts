import { z } from "zod";
import { filterSchools, SEOUL_CENTER } from "@/lib/schools";
import type {
  Recommendation,
  School,
  SchoolLevel,
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
type SemanticKey =
  | "academic"
  | "science"
  | "global"
  | "practical"
  | "artsSports"
  | "project"
  | "club"
  | "reading"
  | "career"
  | "care"
  | "stability"
  | "activity"
  | "mealFacility"
  | "commuteEase";

type SemanticSignal = {
  key: SemanticKey;
  label: string;
  weight: number;
};

type SemanticMatch = {
  key: SemanticKey;
  label: string;
  score: number;
  weight: number;
};

type SemanticFit = {
  score: number;
  matches: SemanticMatch[];
};

type SemanticProfile = Record<SemanticKey, number>;
type RawResponseValue = NonNullable<SurveyAnswer["rawResponses"]>[string];

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
  candidates?: School[],
): Recommendation[] {
  const targetLevel = resolveRecommendationLevel(answer);
  const schoolCandidates = candidates ?? filterSchools(targetLevel);
  const origin =
    typeof answer.lat === "number" && typeof answer.lng === "number"
      ? { lat: answer.lat, lng: answer.lng }
      : SEOUL_CENTER;
  const weights = normalizeWeights(deriveWeights(answer));

  return schoolCandidates
    .filter((school) => targetLevel === "all" || school.level === targetLevel)
    .map((school) => {
      const km = distanceKm(origin, school);
      const distanceScore = scoreDistance(km, answer.distancePreference);
      const scoreWeights = getScoreWeights(answer.distancePreference);
      const semanticFit = scoreSemanticFit(school, answer, km);
      const priorityScore = scorePriorityFit(school, answer, weights);
      const tagScore = scoreTags(school, answer.preferredTags);
      const preferenceScore = scorePreferenceFit(school, answer);
      const matchType = resolveMatchType(
        km,
        answer,
        semanticFit.score,
        distanceScore,
      );
      const weightedScore =
        semanticFit.score * scoreWeights.semantic +
        distanceScore * scoreWeights.distance +
        priorityScore * scoreWeights.priority +
        preferenceScore * scoreWeights.preference;

      return {
        school,
        rank: 0,
        distanceKm: km,
        score: clamp(
          Math.round(weightedScore * 0.9 + tagScore * 0.1),
        ),
        matchType,
        semanticScore: Math.round(semanticFit.score),
        distanceScore: Math.round(distanceScore),
        reasons: buildReasons(school, km, answer, semanticFit),
        caution: buildCaution(km, answer, semanticFit.score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

export function resolveRecommendationLevel(
  answer: Pick<SurveyAnswer, "level" | "studentStage">,
): SchoolLevel | "all" {
  if (answer.studentStage === "elementary") {
    return "middle";
  }

  if (answer.studentStage === "middle") {
    return "high";
  }

  return answer.level;
}

export function normalizeSurveyAnswerForRecommendation(
  answer: SurveyAnswer,
): SurveyAnswer {
  const level = resolveRecommendationLevel(answer);

  return {
    ...answer,
    level,
    rawResponses: answer.rawResponses
      ? {
          ...answer.rawResponses,
          targetLevel: level,
        }
      : answer.rawResponses,
  };
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

function getScoreWeights(preference: SurveyAnswer["distancePreference"]) {
  if (preference === "near") {
    return {
      semantic: 0.42,
      distance: 0.32,
      priority: 0.14,
      preference: 0.12,
    };
  }

  if (preference === "not-important") {
    return {
      semantic: 0.64,
      distance: 0.05,
      priority: 0.17,
      preference: 0.14,
    };
  }

  return {
    semantic: 0.52,
    distance: 0.2,
    priority: 0.16,
    preference: 0.12,
  };
}

function scoreDistance(km: number, preference: SurveyAnswer["distancePreference"]) {
  const penalty = preference === "near" ? 12 : preference === "balanced" ? 7 : 2;
  return clamp(100 - km * penalty);
}

function resolveMatchType(
  km: number,
  answer: SurveyAnswer,
  semanticScore: number,
  distanceScore: number,
): Recommendation["matchType"] {
  if (isExpandedMatch(km, answer, semanticScore, distanceScore)) {
    return "expanded";
  }

  const nearbyKm =
    answer.distancePreference === "near"
      ? 3
      : answer.distancePreference === "balanced"
        ? 6
        : 8;

  return km <= nearbyKm ? "nearby" : "balanced";
}

function isExpandedMatch(
  km: number,
  answer: SurveyAnswer,
  semanticScore: number,
  distanceScore: number,
) {
  const distanceThreshold =
    answer.distancePreference === "near"
      ? 5
      : answer.distancePreference === "balanced"
        ? 7
        : 10;
  const semanticThreshold =
    answer.distancePreference === "near"
      ? 86
      : answer.distancePreference === "balanced"
        ? 76
        : 72;

  return (
    km >= distanceThreshold &&
    semanticScore >= semanticThreshold &&
    semanticScore >= distanceScore + 8
  );
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
    score += categoryMatchesPreference(school.category, answer.categoryPreference)
      ? 18
      : -8;
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
    const studentsPerClass = getPublicFactValue(school, "studentsPerClass");
    if (studentsPerClass) {
      return clamp(98 - studentsPerClass);
    }

    return 68;
  }

  if (priority === "stability") {
    const studentsPerTeacher = getPublicFactValue(school, "studentsPerTeacher");
    if (studentsPerTeacher) {
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

function scoreSemanticFit(
  school: School,
  answer: SurveyAnswer,
  km: number,
): SemanticFit {
  const signals = deriveSemanticSignals(answer);

  if (!signals.length) {
    return {
      score: 70,
      matches: [],
    };
  }

  const profile = getSchoolSemanticProfile(school, km);
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score =
    signals.reduce(
      (sum, signal) => sum + profile[signal.key] * signal.weight,
      0,
    ) / totalWeight;
  const matches = signals
    .map((signal) => ({
      ...signal,
      score: profile[signal.key],
    }))
    .filter((match) => match.score >= 66)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3);

  return {
    score: clamp(score),
    matches,
  };
}

function deriveSemanticSignals(answer: SurveyAnswer): SemanticSignal[] {
  const signals = new Map<SemanticKey, SemanticSignal>();
  const responses = answer.rawResponses ?? {};

  const add = (key: SemanticKey, weight: number, label: string) => {
    const existing = signals.get(key);

    if (existing) {
      signals.set(key, {
        ...existing,
        weight: Math.min(existing.weight + weight, 7),
      });
      return;
    }

    signals.set(key, { key, label, weight });
  };

  answer.priorities.forEach((priority, index) => {
    const weight = index === 0 ? 1.4 : 1;

    if (priority === "academics") {
      add("academic", weight, "학업 분위기");
    }
    if (priority === "activities") {
      add("activity", weight, "학교 활동");
      add("club", 0.7, "동아리 선택지");
    }
    if (priority === "environment") {
      add("stability", weight, "안정적인 환경");
      add("care", 0.8, "생활 케어");
    }
    if (priority === "meal") {
      add("mealFacility", weight, "시설·급식");
    }
    if (priority === "reviews") {
      add("stability", 0.8, "학교 생활 만족도");
    }
    if (priority === "stability") {
      add("stability", weight, "안정적인 운영");
    }
  });

  answer.preferredTags.forEach((tag) => addSignalsFromText(tag, 0.9, add));

  const category = answer.categoryPreference ?? "";
  addSignalsFromText(category, 1.8, add);

  const careerDirection = stringResponse(responses.careerDirection);
  if (careerDirection === "college") {
    add("academic", 2.2, "진학 중심");
    add("reading", 0.8, "자료 탐색");
  }
  if (careerDirection === "science") {
    add("science", 2.6, "과학·탐구");
    add("project", 1.5, "프로젝트형 활동");
    add("academic", 1, "심화 학습");
  }
  if (careerDirection === "global") {
    add("global", 2.6, "외국어·국제");
    add("project", 0.8, "발표·탐구 활동");
  }
  if (careerDirection === "practical") {
    add("practical", 2.6, "실습·진로");
    add("career", 1.6, "진로 연결");
    add("project", 1, "프로젝트형 활동");
  }
  if (careerDirection === "arts-sports") {
    add("artsSports", 2.6, "예체능 활동");
    add("activity", 1.3, "활동 중심 생활");
  }

  const middleEnvironment = stringResponse(responses.middleEnvironmentPreference);
  if (middleEnvironment === "study") {
    add("academic", 1.8, "학습 분위기");
    add("stability", 0.9, "차분한 환경");
  }
  if (middleEnvironment === "activity") {
    add("activity", 1.8, "활동 중심 생활");
    add("club", 1.2, "동아리 선택지");
  }
  if (middleEnvironment === "care") {
    add("care", 1.8, "세심한 생활 케어");
    add("stability", 1.1, "안정적인 환경");
  }
  if (middleEnvironment === "near") {
    add("commuteEase", 1.5, "통학 부담");
  }

  stringArrayResponse(responses.transitionConcern).forEach((concern) => {
    if (concern === "study") {
      add("academic", 1.4, "학습 적응");
      add("care", 0.8, "학습 케어");
    }
    if (concern === "friends") {
      add("care", 1.4, "관계 적응");
      add("stability", 0.8, "안정적인 분위기");
    }
    if (concern === "care") {
      add("care", 1.7, "생활 케어");
      add("stability", 1, "안정적인 운영");
    }
    if (concern === "commute") {
      add("commuteEase", 1.8, "통학 부담");
    }
    if (concern === "activity") {
      add("activity", 1.5, "활동 선택지");
      add("club", 1, "동아리 선택지");
    }
  });

  stringArrayResponse(responses.activityPreference).forEach((activity) => {
    if (activity === "club") {
      add("club", 1.8, "동아리 선택지");
      add("activity", 0.9, "학교 활동");
    }
    if (activity === "project") {
      add("project", 1.9, "프로젝트형 활동");
    }
    if (activity === "reading") {
      add("reading", 1.7, "독서·도서관");
      add("academic", 0.7, "학습 탐색");
    }
    if (activity === "career") {
      add("career", 1.8, "진로 탐색");
    }
    if (activity === "arts-sports") {
      add("artsSports", 1.8, "예체능 활동");
      add("activity", 0.8, "학교 활동");
    }
    if (activity === "community") {
      add("care", 1.1, "관계와 공동체");
      add("activity", 1, "학생 참여");
    }
  });

  addScaleSignal(responses.studyAtmosphere, add, [
    ["academic", 0.9, "학업 분위기"],
    ["stability", 0.35, "차분한 환경"],
  ]);
  addScaleSignal(responses.learningSupportNeed, add, [
    ["care", 0.8, "학습 케어"],
    ["academic", 0.45, "학습 지원"],
  ]);
  addScaleSignal(responses.schoolLife, add, [
    ["activity", 0.9, "학교 활동"],
    ["club", 0.5, "동아리 선택지"],
  ]);
  addScaleSignal(responses.relationshipSafety, add, [
    ["care", 0.9, "관계 안정"],
    ["stability", 0.5, "안정적인 분위기"],
  ]);
  addScaleSignal(responses.schoolReputation, add, [
    ["stability", 0.65, "학교 신뢰도"],
    ["academic", 0.45, "진학 기반"],
  ]);
  addScaleSignal(responses.facilityMeal, add, [
    ["mealFacility", 0.95, "시설·급식"],
  ]);
  addScaleSignal(responses.commuteImportance, add, [
    ["commuteEase", 0.85, "통학 부담"],
  ]);

  return [...signals.values()].sort((a, b) => b.weight - a.weight);
}

function getSchoolSemanticProfile(school: School, km: number): SemanticProfile {
  const text = normalizeText(
    [
      school.name,
      school.category,
      school.district,
      school.tags.join(" "),
      school.highlights.join(" "),
      school.description,
      school.facts.commuteNote,
    ].join(" "),
  );
  const clubs = getPublicFactValue(school, "clubs");
  const libraryBooks = getPublicFactValue(school, "libraryBooks");
  const studentsPerTeacher = getPublicFactValue(school, "studentsPerTeacher");
  const clubsScore =
    clubs && clubs > 0
      ? clamp(58 + clubs * 0.95)
      : school.metrics.activities;
  const booksScore =
    libraryBooks && libraryBooks > 0
      ? clamp(56 + libraryBooks / 700)
      : school.metrics.academics;
  const studentTeacherScore =
    studentsPerTeacher && studentsPerTeacher > 0
      ? clamp(104 - studentsPerTeacher * 2.3)
      : school.metrics.stability;

  return {
    academic: boost(
      school.metrics.academics,
      text,
      [/학업|학습|진학|심화|수업|과학고|외국어|국제/],
      14,
    ),
    science: boost(
      /과학|연구|ai|로봇|공학/.test(text) ? 78 : 46,
      text,
      [/과학고|과학|연구|탐구|ai|로봇|공학/],
      16,
    ),
    global: boost(
      /외국어|국제|어학|글로벌/.test(text) ? 80 : 44,
      text,
      [/외국어|국제|어학|글로벌/],
      18,
    ),
    practical: boost(
      /특성화|마이스터|실습|취업|산학|로봇|공업|상업|디자인|관광|정보/.test(text)
        ? 82
        : 44,
      text,
      [/특성화|마이스터|실습|취업|산학|로봇|공업|상업|디자인|관광|정보/],
      16,
    ),
    artsSports: boost(
      /예술|체육|운동|음악|미술/.test(text) ? 78 : 43,
      text,
      [/예술|체육|운동|음악|미술/],
      16,
    ),
    project: boost(
      Math.max(school.metrics.activities, school.metrics.academics - 4),
      text,
      [/프로젝트|발표|탐구|연구|실습|포트폴리오/],
      13,
    ),
    club: boost(clubsScore, text, [/동아리|자율활동|학생자치|활동 선택/], 12),
    reading: boost(booksScore, text, [/독서|도서관|자료|책/], 14),
    career: boost(
      Math.max(school.metrics.academics, school.metrics.activities),
      text,
      [/진로|진학|취업|산학|전공|포트폴리오/],
      13,
    ),
    care: boost(
      Math.max(school.metrics.environment, school.metrics.stability),
      text,
      [/상담|생활지도|분위기|케어|관계|안정/],
      12,
    ),
    stability: clamp(
      (school.metrics.stability * 0.5 +
        school.metrics.environment * 0.25 +
        studentTeacherScore * 0.25),
    ),
    activity: boost(school.metrics.activities, text, [/활동|동아리|자율|운동장|실습/], 12),
    mealFacility: boost(
      school.metrics.meal,
      text,
      [/급식|시설|운동장|도서관|공간/],
      12,
    ),
    commuteEase: boost(
      scoreDistance(km, "balanced"),
      text,
      [/통학|교통|역|버스|접근|생활권/],
      10,
    ),
  };
}

function addSignalsFromText(
  text: string,
  weight: number,
  add: (key: SemanticKey, weight: number, label: string) => void,
) {
  const normalized = normalizeText(text);

  if (/과학|연구|탐구|ai|로봇/.test(normalized)) {
    add("science", weight, "과학·탐구");
  }
  if (/외국어|국제|어학|글로벌/.test(normalized)) {
    add("global", weight, "외국어·국제");
  }
  if (/특성화|마이스터|실습|취업|진로|로봇|공업|상업|디자인|관광|정보/.test(normalized)) {
    add("practical", weight, "실습·진로");
  }
  if (/예술|체육|운동/.test(normalized)) {
    add("artsSports", weight, "예체능 활동");
  }
  if (/프로젝트|발표/.test(normalized)) {
    add("project", weight, "프로젝트형 활동");
  }
  if (/동아리|활동/.test(normalized)) {
    add("club", weight, "동아리 선택지");
  }
  if (/독서|도서관/.test(normalized)) {
    add("reading", weight, "독서·도서관");
  }
  if (/학업|학습|진학|심화/.test(normalized)) {
    add("academic", weight, "학업 분위기");
  }
  if (/상담|생활지도|분위기|안정/.test(normalized)) {
    add("care", weight, "생활 케어");
  }
  if (/급식|시설|공간/.test(normalized)) {
    add("mealFacility", weight, "시설·급식");
  }
  if (/통학|교통|접근/.test(normalized)) {
    add("commuteEase", weight, "통학 부담");
  }
}

function addScaleSignal(
  value: RawResponseValue | undefined,
  add: (key: SemanticKey, weight: number, label: string) => void,
  targets: Array<[SemanticKey, number, string]>,
) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric < 4) {
    return;
  }

  targets.forEach(([key, weight, label]) => {
    add(key, (numeric - 3) * weight, label);
  });
}

function boost(
  base: number,
  text: string,
  patterns: RegExp[],
  amount: number,
) {
  const hits = patterns.filter((pattern) => pattern.test(text)).length;
  return clamp(base + hits * amount);
}

function normalizeText(text: string) {
  return text.toLowerCase();
}

function stringResponse(value: RawResponseValue | undefined) {
  return typeof value === "string" ? value : "";
}

function stringArrayResponse(
  value: RawResponseValue | undefined,
) {
  return Array.isArray(value) ? value : [];
}

function buildReasons(
  school: School,
  km: number,
  answer: SurveyAnswer,
  semanticFit: SemanticFit,
) {
  const reasons: string[] = [];

  if (semanticFit.matches.length) {
    reasons.push(
      `${semanticFit.matches
        .slice(0, 2)
        .map((match) => match.label)
        .join("·")} 조건이 잘 맞습니다.`,
    );
  }

  if (
    answer.categoryPreference &&
    categoryMatchesPreference(school.category, answer.categoryPreference)
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

  if (
    answer.distancePreference !== "near" &&
    km >= 8 &&
    semanticFit.score >= 78
  ) {
    reasons.push("거리는 있지만 응답과 맞는 조건이 강합니다.");
  }

  if (isExpandedMatch(km, answer, semanticFit.score, scoreDistance(km, answer.distancePreference))) {
    reasons.push("통학권을 넓히면 함께 검토할 만합니다.");
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
    reasons.push(`${clubFact.label} ${clubFact.value}를 함께 볼 수 있습니다.`);
  } else if (publicFacts.length) {
    reasons.push(
      `${publicFacts
        .slice(0, 2)
        .map((fact) => `${fact.shortLabel} ${fact.value}`)
        .join(", ")}를 함께 볼 수 있습니다.`,
    );
  }

  if (school.highlights[0]) {
    reasons.push(school.highlights[0]);
  }

  return [...new Set(reasons)].slice(0, 3);
}

function buildCaution(
  km: number,
  answer: SurveyAnswer,
  semanticScore: number,
) {
  if (answer.distancePreference === "near" && km >= 5) {
    return "가까운 통학을 원한 응답과는 거리가 다소 있습니다.";
  }

  if (km >= 8 && semanticScore >= 78) {
    return "통학 거리는 길 수 있어 실제 이동 시간을 확인해보세요.";
  }

  return undefined;
}

function categoryMatchesPreference(category: string, preference: string) {
  if (category.includes(preference)) {
    return true;
  }

  if (/외국어|국제/.test(preference)) {
    return /외국어|국제/.test(category);
  }
  if (/특성화|마이스터|공업|상업|디자인|관광|정보|로봇/.test(preference)) {
    return /특성화|마이스터|공업|상업|디자인|관광|정보|로봇/.test(category);
  }
  if (/예술|체육/.test(preference)) {
    return /예술|체육/.test(category);
  }
  if (/과학/.test(preference)) {
    return /과학/.test(category);
  }
  if (/일반/.test(preference)) {
    return /일반/.test(category);
  }

  return false;
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
