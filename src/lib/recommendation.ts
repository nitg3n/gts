import { z } from "zod";
import { filterSchools, SEOUL_CENTER } from "@/lib/schools";
import type {
  Recommendation,
  RecommendationEvidence,
  School,
  SchoolMetricKey,
  StudentGender,
  SchoolReview,
  SurveyAnswer,
} from "@/lib/types";
import {
  findGraduationOutcomeForSchool,
  type GraduationOutcomeIndex,
  type GraduationOutcomeSummary,
} from "@/lib/graduation-outcomes";
import { getPublicFactItems, getPublicFactValue } from "@/lib/public-facts";
import { distanceKm } from "@/lib/utils";

export const surveyAnswerSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  studentGender: z.enum(["male", "female"]).optional(),
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
  | "collegeOutcome"
  | "careerOutcome"
  | "globalOutcome"
  | "learningSupport"
  | "care"
  | "relationshipSafety"
  | "stability"
  | "activity"
  | "lifeEnjoyment"
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
  dimensionScores?: Recommendation["dimensionScores"];
};

type SemanticProfile = Record<SemanticKey, number>;
type RawResponseValue = NonNullable<SurveyAnswer["rawResponses"]>[string];
type RankSchoolsContext = {
  graduationOutcomes?: GraduationOutcomeIndex;
  reviews?: SchoolReview[];
};

type ReviewSummary = {
  count: number;
  confidence: number;
  atmosphere: number;
  exams: number;
  meals: number;
  activities: number;
  facilities: number;
  body: string;
};

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
  context: RankSchoolsContext = {},
): Recommendation[] {
  const schoolCandidates = candidates ?? filterSchools("high");
  const origin =
    typeof answer.lat === "number" && typeof answer.lng === "number"
      ? { lat: answer.lat, lng: answer.lng }
      : SEOUL_CENTER;
  const weights = normalizeWeights(deriveWeights(answer));

  return schoolCandidates
    .filter((school) => school.level === "high")
    .filter((school) => matchesHardConstraints(school, answer))
    .map((school) => {
      const km = distanceKm(origin, school);
      const distanceScore = scoreDistance(km, answer.distancePreference);
      const scoreWeights = getScoreWeights(answer.distancePreference);
      const semanticFit = scoreSemanticFit(school, answer, km, context);
      const priorityScore = scorePriorityFit(school, answer, weights);
      const tagScore = scoreTags(school, answer.preferredTags);
      const preferenceScore = scorePreferenceFit(school, answer);
      const reviewSummary = summarizeReviewsForSchool(school, context.reviews);
      const graduationOutcome = context.graduationOutcomes
        ? findGraduationOutcomeForSchool(school, context.graduationOutcomes)
        : undefined;
      const evidence = buildEvidence(
        school,
        km,
        answer,
        semanticFit,
        graduationOutcome,
        reviewSummary,
      );
      const confidence = calculateConfidence(school, graduationOutcome, reviewSummary);
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
        confidence,
        dimensionScores: semanticFit.dimensionScores,
        evidence,
        graduationOutcome,
        reasons: buildReasons(school, km, answer, semanticFit, evidence),
        caution: buildCaution(km, answer, semanticFit.score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

export function schoolMatchesRecommendationConstraints(
  school: School,
  answer: SurveyAnswer,
) {
  return matchesHardConstraints(school, answer);
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

function matchesHardConstraints(school: School, answer: SurveyAnswer) {
  if (!matchesStudentGenderEligibility(school, answer.studentGender)) {
    return false;
  }

  if (answer.genderPreference === "coed" && school.gender !== "coed") {
    return false;
  }

  if (
    answer.genderPreference === "single-gender" &&
    !matchesSingleGenderPreference(school, answer.studentGender)
  ) {
    return false;
  }

  const explicitCategoryPreference = getExplicitCategoryPreference(answer);

  if (
    explicitCategoryPreference &&
    !categoryMatchesPreference(school.category, explicitCategoryPreference)
  ) {
    return false;
  }

  return true;
}

function matchesStudentGenderEligibility(
  school: School,
  studentGender: StudentGender | undefined,
) {
  if (studentGender === "male") {
    return school.gender !== "girls";
  }

  if (studentGender === "female") {
    return school.gender !== "boys";
  }

  return true;
}

function matchesSingleGenderPreference(
  school: School,
  studentGender: StudentGender | undefined,
) {
  if (studentGender === "male") {
    return school.gender === "boys";
  }

  if (studentGender === "female") {
    return school.gender === "girls";
  }

  return school.gender !== "coed";
}

function getExplicitCategoryPreference(answer: SurveyAnswer) {
  const rawPreference = answer.rawResponses?.categoryPreference;

  if (typeof rawPreference === "string") {
    return isOpenCategoryPreference(rawPreference) ? undefined : rawPreference;
  }

  if (!answer.rawResponses && answer.categoryPreference) {
    return isOpenCategoryPreference(answer.categoryPreference)
      ? undefined
      : answer.categoryPreference;
  }

  return undefined;
}

function isOpenCategoryPreference(value: string) {
  return value === "any" || value === "other";
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
    if (
      school.level === "high" &&
      /영재|과학|외국어|국제|마이스터|특성화/.test(school.category)
    ) {
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
  context: RankSchoolsContext,
): SemanticFit {
  const signals = deriveSemanticSignals(answer);

  if (!signals.length) {
    return {
      score: 70,
      matches: [],
      dimensionScores: {},
    };
  }

  const profile = getSchoolSemanticProfile(school, km, context);
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
    dimensionScores: {
      academic_climate: Math.round(profile.academic),
      college_outcome: Math.round(profile.collegeOutcome),
      career_outcome: Math.round(profile.careerOutcome),
      global_outcome: Math.round(profile.globalOutcome),
      learning_support: Math.round(profile.learningSupport),
      science_fit: Math.round(profile.science),
      practical_fit: Math.round(profile.practical),
      arts_sports_fit: Math.round(profile.artsSports),
      project_fit: Math.round(profile.project),
      activity_variety: Math.round(profile.activity),
      reading_library: Math.round(profile.reading),
      relationship_safety: Math.round(profile.relationshipSafety),
      life_enjoyment: Math.round(profile.lifeEnjoyment),
      facility_meal: Math.round(profile.mealFacility),
      commute_fit: Math.round(profile.commuteEase),
      reputation: Math.round(profile.stability),
    },
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
      add("learningSupport", 0.45, "학습 지원");
    }
    if (priority === "activities") {
      add("activity", weight, "학교 활동");
      add("club", 0.7, "동아리 선택지");
      add("lifeEnjoyment", 0.35, "학교생활 만족");
    }
    if (priority === "environment") {
      add("stability", weight, "안정적인 환경");
      add("relationshipSafety", 0.9, "관계 안정");
      add("care", 0.55, "생활 케어");
    }
    if (priority === "meal") {
      add("mealFacility", weight, "시설·급식");
    }
    if (priority === "reviews") {
      add("lifeEnjoyment", 0.8, "학교 생활 만족도");
      add("relationshipSafety", 0.45, "학생 체감 분위기");
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
    add("collegeOutcome", 2.7, "대학 진학 성과");
    add("academic", 2.2, "진학 중심");
    add("learningSupport", 0.9, "진학·학습 지원");
    add("reading", 0.8, "자료 탐색");
  }
  if (careerDirection === "science") {
    add("science", 2.6, "과학·탐구");
    add("project", 1.5, "프로젝트형 활동");
    add("collegeOutcome", 0.85, "심화 진학 성과");
    add("academic", 1, "심화 학습");
  }
  if (careerDirection === "global") {
    add("globalOutcome", 2.7, "국제·해외 진학 성과");
    add("global", 2.6, "외국어·국제");
    add("project", 0.8, "발표·탐구 활동");
  }
  if (careerDirection === "practical") {
    add("careerOutcome", 2.6, "취업·전문 진로 성과");
    add("practical", 2.6, "실습·진로");
    add("career", 1.6, "진로 연결");
    add("project", 1, "프로젝트형 활동");
  }
  if (careerDirection === "arts-sports") {
    add("artsSports", 2.6, "예체능 활동");
    add("activity", 1.3, "활동 중심 생활");
  }

  stringArrayResponse(responses.transitionConcern).forEach((concern) => {
    if (concern === "study") {
      add("academic", 1.4, "학습 적응");
      add("learningSupport", 1.15, "학습 케어");
    }
    if (concern === "friends") {
      add("relationshipSafety", 1.55, "관계 적응");
      add("care", 0.75, "생활 케어");
      add("stability", 0.8, "안정적인 분위기");
    }
    if (concern === "care") {
      add("relationshipSafety", 1.35, "생활지도 안정감");
      add("learningSupport", 0.85, "상담·지원");
      add("care", 0.85, "생활 케어");
      add("stability", 1, "안정적인 운영");
    }
    if (concern === "commute") {
      add("commuteEase", 1.8, "통학 부담");
    }
    if (concern === "activity") {
      add("activity", 1.5, "활동 선택지");
      add("club", 1, "동아리 선택지");
      add("lifeEnjoyment", 0.8, "학교생활 만족");
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
      add("careerOutcome", 1.6, "진로 결과");
      add("career", 1.3, "진로 탐색");
    }
    if (activity === "arts-sports") {
      add("artsSports", 1.8, "예체능 활동");
      add("activity", 0.8, "학교 활동");
    }
    if (activity === "community") {
      add("relationshipSafety", 1.2, "관계와 공동체");
      add("care", 0.7, "관계와 공동체");
      add("activity", 1, "학생 참여");
      add("lifeEnjoyment", 0.7, "학교생활 만족");
    }
  });

  addScaleSignal(responses.studyAtmosphere, add, [
    ["academic", 0.9, "학업 분위기"],
    ["collegeOutcome", 0.35, "진학 기반"],
    ["stability", 0.35, "차분한 환경"],
  ]);
  addScaleSignal(responses.learningSupportNeed, add, [
    ["learningSupport", 0.95, "학습 케어"],
    ["academic", 0.45, "학습 지원"],
    ["career", 0.3, "진로 상담"],
  ]);
  addScaleSignal(responses.schoolLife, add, [
    ["lifeEnjoyment", 0.95, "학교생활 만족"],
    ["activity", 0.9, "학교 활동"],
    ["club", 0.5, "동아리 선택지"],
  ]);
  addScaleSignal(responses.relationshipSafety, add, [
    ["relationshipSafety", 1, "관계 안정"],
    ["care", 0.35, "생활 케어"],
    ["stability", 0.5, "안정적인 분위기"],
  ]);
  addScaleSignal(responses.schoolReputation, add, [
    ["stability", 0.65, "학교 신뢰도"],
    ["collegeOutcome", 0.55, "진학 결과"],
    ["academic", 0.25, "진학 기반"],
  ]);
  addScaleSignal(responses.facilityMeal, add, [
    ["mealFacility", 0.95, "시설·급식"],
  ]);
  addScaleSignal(responses.commuteImportance, add, [
    ["commuteEase", 0.85, "통학 부담"],
  ]);

  return [...signals.values()].sort((a, b) => b.weight - a.weight);
}

function getSchoolSemanticProfile(
  school: School,
  km: number,
  context: RankSchoolsContext,
): SemanticProfile {
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
  const reviewSummary = summarizeReviewsForSchool(school, context.reviews);
  const graduationOutcome = context.graduationOutcomes
    ? findGraduationOutcomeForSchool(school, context.graduationOutcomes)
    : undefined;
  const collegeOutcomeScore = scoreGraduationOutcome(
    graduationOutcome?.fourYearRate,
    graduationOutcome,
  );
  const advancementOutcomeScore = scoreGraduationOutcome(
    graduationOutcome?.advancementRate,
    graduationOutcome,
  );
  const employmentOutcomeScore = scoreGraduationOutcome(
    Math.max(
      graduationOutcome?.employmentRate ?? 0,
      graduationOutcome?.juniorCollegeRate ?? 0,
    ),
    graduationOutcome,
  );
  const globalOutcomeScore = scoreGraduationOutcome(
    graduationOutcome?.overseasRate,
    graduationOutcome,
    3,
  );
  const reviewAcademicScore = reviewSummary
    ? clamp(50 + (reviewSummary.exams - 3) * 9)
    : undefined;
  const reviewCareScore = reviewSummary
    ? clamp(50 + (reviewSummary.atmosphere - 3) * 11)
    : undefined;
  const reviewActivityScore = reviewSummary
    ? clamp(50 + (reviewSummary.activities - 3) * 11)
    : undefined;
  const reviewMealFacilityScore = reviewSummary
    ? clamp(
        50 +
          (((reviewSummary.meals + reviewSummary.facilities) / 2) - 3) * 11,
      )
    : undefined;
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
  const academicTextScore = boost(
    school.metrics.academics,
    text,
    [/학업|학습|진학|심화|수업|영재|과학고|외국어|국제/],
    14,
  );
  const collegeOutcome = blendEvidence([
    [collegeOutcomeScore, 0.58],
    [advancementOutcomeScore, 0.24],
    [academicTextScore, 0.18],
    [reviewAcademicScore, reviewSummary ? reviewSummary.confidence * 0.08 : 0],
  ]);
  const globalTextScore = boost(
    /외국어|국제|어학|글로벌/.test(text) ? 80 : 44,
    text,
    [/외국어|국제|어학|글로벌/],
    18,
  );
  const globalOutcome = blendEvidence([
    [globalTextScore, 0.72],
    [globalOutcomeScore, 0.28],
  ]);
  const practicalTextScore = boost(
    /특성화|마이스터|실습|취업|산학|로봇|공업|상업|디자인|관광|정보|기술/.test(text)
      ? 82
      : 44,
    text,
    [/특성화|마이스터|실습|취업|산학|로봇|공업|상업|디자인|관광|정보|기술/],
    16,
  );
  const careerOutcome = blendEvidence([
    [employmentOutcomeScore, 0.52],
    [practicalTextScore, 0.28],
    [
      boost(
        Math.max(school.metrics.academics, school.metrics.activities),
        text,
        [/진로|진학|취업|산학|전공|포트폴리오/],
        13,
      ),
      0.2,
    ],
  ]);
  const learningSupport = blendEvidence([
    [studentTeacherScore, 0.34],
    [
      boost(
        Math.max(school.metrics.academics, school.metrics.stability),
        text,
        [/상담|학습지원|진학지도|진로|멘토|방과후|개별|생활지도/],
        12,
      ),
      0.36,
    ],
    [reviewAcademicScore, reviewSummary ? reviewSummary.confidence * 0.15 : 0],
    [reviewCareScore, reviewSummary ? reviewSummary.confidence * 0.15 : 0],
  ]);
  const relationshipSafety = blendEvidence([
    [
      boost(
        Math.max(school.metrics.environment, school.metrics.stability),
        text,
        [/상담|생활지도|분위기|케어|관계|안정|소통|학생자치/],
        12,
      ),
      0.55,
    ],
    [reviewCareScore, reviewSummary ? reviewSummary.confidence * 0.35 : 0],
    [studentTeacherScore, 0.1],
  ]);
  const lifeEnjoyment = blendEvidence([
    [boost(school.metrics.activities, text, [/활동|동아리|자율|운동장|실습|축제|체육대회|행사/], 12), 0.48],
    [reviewActivityScore, reviewSummary ? reviewSummary.confidence * 0.28 : 0],
    [reviewCareScore, reviewSummary ? reviewSummary.confidence * 0.14 : 0],
    [reviewMealFacilityScore, reviewSummary ? reviewSummary.confidence * 0.1 : 0],
  ]);

  return {
    academic: blendEvidence([
      [academicTextScore, 0.42],
      [collegeOutcome, 0.32],
      [learningSupport, 0.16],
      [reviewAcademicScore, reviewSummary ? reviewSummary.confidence * 0.1 : 0],
    ]),
    collegeOutcome,
    science: boost(
      /영재|과학|연구|ai|로봇|공학/.test(text) ? 78 : 46,
      text,
      [/영재|과학고|과학|연구|탐구|ai|로봇|공학/],
      16,
    ),
    global: globalOutcome,
    globalOutcome,
    practical: blendEvidence([
      [practicalTextScore, 0.58],
      [careerOutcome, 0.42],
    ]),
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
    club: blendEvidence([
      [boost(clubsScore, text, [/동아리|자율활동|학생자치|활동 선택/], 12), 0.82],
      [reviewActivityScore, reviewSummary ? reviewSummary.confidence * 0.18 : 0],
    ]),
    reading: boost(booksScore, text, [/독서|도서관|자료|책/], 14),
    career: blendEvidence([
      [boost(
        Math.max(school.metrics.academics, school.metrics.activities),
        text,
        [/진로|진학|취업|산학|전공|포트폴리오/],
        13,
      ), 0.5],
      [maxDefined(collegeOutcome, careerOutcome), 0.5],
    ]),
    careerOutcome,
    learningSupport,
    care: blendEvidence([
      [relationshipSafety, 0.72],
      [learningSupport, 0.28],
    ]),
    relationshipSafety,
    stability: clamp(
      blendEvidence([
        [school.metrics.stability, 0.35],
        [school.metrics.environment, 0.2],
        [studentTeacherScore, 0.25],
        [graduationOutcome?.outcomeStability, graduationOutcome ? 0.2 : 0],
      ]),
    ),
    activity: blendEvidence([
      [boost(school.metrics.activities, text, [/활동|동아리|자율|운동장|실습/], 12), 0.78],
      [reviewActivityScore, reviewSummary ? reviewSummary.confidence * 0.22 : 0],
    ]),
    lifeEnjoyment,
    mealFacility: blendEvidence([
      [boost(
        school.metrics.meal,
        text,
        [/급식|시설|운동장|도서관|공간/],
        12,
      ), 0.72],
      [reviewMealFacilityScore, reviewSummary ? reviewSummary.confidence * 0.28 : 0],
    ]),
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
    add("globalOutcome", weight * 0.7, "국제·해외 진학 성과");
  }
  if (/특성화|마이스터|실습|취업|진로|로봇|공업|상업|디자인|관광|정보|기술/.test(normalized)) {
    add("practical", weight, "실습·진로");
    add("careerOutcome", weight * 0.75, "취업·전문 진로 성과");
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
    add("collegeOutcome", weight * 0.65, "진학 성과");
  }
  if (/상담|생활지도|분위기|안정/.test(normalized)) {
    add("care", weight, "생활 케어");
    add("relationshipSafety", weight * 0.75, "관계 안정");
    add("learningSupport", weight * 0.45, "상담·지원");
  }
  if (/급식|시설|공간/.test(normalized)) {
    add("mealFacility", weight, "시설·급식");
  }
  if (/통학|교통|접근/.test(normalized)) {
    add("commuteEase", weight, "통학 부담");
  }
}

function blendEvidence(entries: Array<[number | undefined, number]>) {
  const usable = entries.filter(
    (entry): entry is [number, number] =>
      typeof entry[0] === "number" && Number.isFinite(entry[0]) && entry[1] > 0,
  );
  const totalWeight = usable.reduce((sum, [, weight]) => sum + weight, 0);

  if (totalWeight <= 0) {
    return 66;
  }

  return clamp(
    usable.reduce((sum, [value, weight]) => sum + value * weight, 0) /
      totalWeight,
  );
}

function scoreGraduationOutcome(
  value: number | undefined,
  outcome: GraduationOutcomeSummary | undefined,
  multiplier = 1,
) {
  if (!outcome || typeof value !== "number") {
    return undefined;
  }

  const sampleAdjusted = value * outcome.confidence;
  return clamp(45 + sampleAdjusted * multiplier * 0.55);
}

function maxDefined(...values: Array<number | undefined>) {
  const defined = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );

  return defined.length ? Math.max(...defined) : undefined;
}

function summarizeReviewsForSchool(
  school: School,
  reviews: SchoolReview[] | undefined,
): ReviewSummary | undefined {
  const schoolReviews = (reviews ?? []).filter(
    (review) => review.schoolId === school.id && review.status === "approved",
  );

  if (!schoolReviews.length) {
    return undefined;
  }

  const totals = schoolReviews.reduce(
    (acc, review) => {
      acc.atmosphere += review.ratings.atmosphere;
      acc.exams += review.ratings.exams;
      acc.meals += review.ratings.meals;
      acc.activities += review.ratings.activities;
      acc.facilities += review.ratings.facilities;
      acc.body.push(review.body);
      return acc;
    },
    {
      atmosphere: 0,
      exams: 0,
      meals: 0,
      activities: 0,
      facilities: 0,
      body: [] as string[],
    },
  );
  const count = schoolReviews.length;

  return {
    count,
    confidence: Math.min(1, Math.log10(count + 1) / 1.5),
    atmosphere: totals.atmosphere / count,
    exams: totals.exams / count,
    meals: totals.meals / count,
    activities: totals.activities / count,
    facilities: totals.facilities / count,
    body: totals.body.join(" "),
  };
}

function buildEvidence(
  school: School,
  km: number,
  answer: SurveyAnswer,
  semanticFit: SemanticFit,
  graduationOutcome: GraduationOutcomeSummary | undefined,
  reviewSummary: ReviewSummary | undefined,
): RecommendationEvidence[] {
  const evidence: RecommendationEvidence[] = [];
  const publicFacts = getPublicFactItems(school);
  const explicitCategoryPreference = getExplicitCategoryPreference(answer);

  evidence.push({
    dimension: "commute_fit",
    label: "선택 위치 기준 거리",
    source: "kakao",
    value: `${km.toFixed(1)}km`,
    confidence: 0.86,
  });

  if (explicitCategoryPreference) {
    evidence.push({
      dimension: "category_fit",
      label: "희망 고등학교 유형",
      source: "derived",
      value: categoryMatchesPreference(school.category, explicitCategoryPreference)
        ? "일치"
        : "부분 참고",
      confidence: 0.74,
    });
  }

  if (answer.genderPreference && answer.genderPreference !== "any") {
    const genderMatched =
      answer.genderPreference === "coed"
        ? school.gender === "coed"
        : school.gender !== "coed";

    evidence.push({
      dimension: "gender_fit",
      label: "선호 학교 성별 유형",
      source: "derived",
      value: genderMatched ? "일치" : "부분 참고",
      confidence: 0.7,
    });
  }

  publicFacts.slice(0, 4).forEach((fact) => {
    const dimension =
      fact.key === "clubs"
        ? "activity_variety"
        : fact.key === "libraryBooks"
          ? "reading_library"
          : fact.key === "studentsPerTeacher"
            ? "learning_support"
            : fact.key === "studentsPerClass"
              ? "relationship_safety"
              : "reputation";

    evidence.push({
      dimension,
      label: fact.label,
      source: "schoolinfo",
      value: fact.value,
      confidence: 0.92,
    });
  });

  if (graduationOutcome) {
    evidence.push(
      {
        dimension: "college_outcome",
        label: `최근 ${graduationOutcome.years.length}년 4년제 진학률`,
        source: "kess",
        value: `${graduationOutcome.fourYearRate.toFixed(1)}%`,
        confidence: graduationOutcome.confidence,
      },
      {
        dimension: "career_outcome",
        label: `최근 ${graduationOutcome.years.length}년 취업·전문 진로 비율`,
        source: "kess",
        value: `${Math.max(
          graduationOutcome.employmentRate,
          graduationOutcome.juniorCollegeRate,
        ).toFixed(1)}%`,
        confidence: graduationOutcome.confidence,
      },
    );

    if (graduationOutcome.overseasRate > 0) {
      evidence.push({
        dimension: "global_outcome",
        label: "해외 진학 비율",
        source: "kess",
        value: `${graduationOutcome.overseasRate.toFixed(1)}%`,
        confidence: graduationOutcome.confidence,
      });
    }
  }

  if (reviewSummary) {
    evidence.push({
      dimension: "life_enjoyment",
      label: `승인 리뷰 ${reviewSummary.count}건 평균`,
      source: "review",
      value: (
        (reviewSummary.atmosphere +
          reviewSummary.activities +
          reviewSummary.meals +
          reviewSummary.facilities) /
        4
      ).toFixed(1),
      confidence: reviewSummary.confidence,
    });
  }

  semanticFit.matches.slice(0, 2).forEach((match) => {
    evidence.push({
      dimension: semanticKeyToEvidenceDimension(match.key),
      label: match.label,
      source: "derived",
      value: Math.round(match.score),
      confidence: 0.62,
    });
  });

  return limitEvidence(evidence);
}

function limitEvidence(evidence: RecommendationEvidence[]) {
  return evidence
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        evidencePriority(a.item) - evidencePriority(b.item) ||
        a.index - b.index,
    )
    .slice(0, 8)
    .map(({ item }) => item);
}

function evidencePriority(evidence: RecommendationEvidence) {
  if (evidence.source === "kess") {
    return 0;
  }

  if (evidence.source === "review") {
    return 1;
  }

  if (evidence.dimension === "commute_fit") {
    return 2;
  }

  if (evidence.dimension === "category_fit" || evidence.dimension === "gender_fit") {
    return 3;
  }

  if (evidence.source === "schoolinfo") {
    return 4;
  }

  return 5;
}

function calculateConfidence(
  school: School,
  graduationOutcome: GraduationOutcomeSummary | undefined,
  reviewSummary: ReviewSummary | undefined,
) {
  const officialCoverage =
    school.source === "kakao-neis" ? 0.48 : school.source === "kakao" ? 0.22 : 0.18;
  const factCoverage = Math.min(getPublicFactItems(school).length / 5, 1) * 0.18;
  const outcomeCoverage = (graduationOutcome?.confidence ?? 0) * 0.18;
  const reviewCoverage = (reviewSummary?.confidence ?? 0) * 0.1;
  const identityCoverage = school.externalIds?.neisSchoolCode ? 0.06 : 0.03;

  return Math.min(
    1,
    officialCoverage + factCoverage + outcomeCoverage + reviewCoverage + identityCoverage,
  );
}

function semanticKeyToEvidenceDimension(
  key: SemanticKey,
): RecommendationEvidence["dimension"] {
  const map: Record<SemanticKey, RecommendationEvidence["dimension"]> = {
    academic: "academic_climate",
    science: "science_fit",
    global: "global_outcome",
    practical: "practical_fit",
    artsSports: "arts_sports_fit",
    project: "project_fit",
    club: "activity_variety",
    reading: "reading_library",
    career: "career_outcome",
    collegeOutcome: "college_outcome",
    careerOutcome: "career_outcome",
    globalOutcome: "global_outcome",
    learningSupport: "learning_support",
    care: "relationship_safety",
    relationshipSafety: "relationship_safety",
    stability: "reputation",
    activity: "activity_variety",
    lifeEnjoyment: "life_enjoyment",
    mealFacility: "facility_meal",
    commuteEase: "commute_fit",
  };

  return map[key];
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
  evidence: RecommendationEvidence[],
) {
  const reasons: string[] = [];
  const outcomeEvidence = evidence.find((item) => item.source === "kess");
  const reviewEvidence = evidence.find((item) => item.source === "review");

  if (semanticFit.matches.length) {
    reasons.push(
      `${semanticFit.matches
        .slice(0, 2)
        .map((match) => match.label)
        .join("·")} 조건이 잘 맞습니다.`,
    );
  }

  const explicitCategoryPreference = getExplicitCategoryPreference(answer);

  if (
    explicitCategoryPreference &&
    categoryMatchesPreference(school.category, explicitCategoryPreference)
  ) {
    reasons.unshift(`${explicitCategoryPreference} 선호와 일치합니다.`);
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

  if (outcomeEvidence?.value) {
    reasons.push(`${outcomeEvidence.label} ${outcomeEvidence.value}를 반영했습니다.`);
  }

  if (reviewEvidence) {
    reasons.push(`${reviewEvidence.label}을 체감 데이터로 함께 반영했습니다.`);
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
  const normalizedCategory = normalizeCategory(category);
  const normalizedPreference = normalizeCategory(preference);

  if (normalizedCategory.includes(normalizedPreference)) {
    return true;
  }

  const categoryMatchers: Array<[RegExp, RegExp]> = [
    [/일반고?$/, /일반/],
    [/자율형?사립고?|자사고/, /자율형?사립|자사|자율/],
    [/영재학교?|영재고?/, /영재/],
    [/외국어고?|외고/, /외국어|외고/],
    [/국제고?/, /국제/],
    [/과학고?/, /과학/],
    [/예술고?|예고/, /예술|예고/],
    [/체육고?|체고/, /체육|체고/],
    [/마이스터고?/, /마이스터/],
    [/특성화고?/, /특성화|공업|상업|디자인|관광|정보|기술|로봇/],
  ];

  return categoryMatchers.some(
    ([preferencePattern, categoryPattern]) =>
      preferencePattern.test(normalizedPreference) &&
      categoryPattern.test(normalizedCategory),
  );
}

function normalizeCategory(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
