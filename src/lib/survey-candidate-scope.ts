import type {
  GraduationOutcomeIndex,
  GraduationOutcomeSummary,
} from "@/lib/graduation-outcomes";
import type { SurveyAnswer } from "@/lib/types";

export type SurveyCandidateScope = {
  nearbyRadiusKm: number;
  nearbyLimit: number;
  nationwideSummaryLimit: number;
  nationwideSchoolLimit: number;
};

export function getSurveyCandidateScope(
  distancePreference: SurveyAnswer["distancePreference"],
): SurveyCandidateScope {
  if (distancePreference === "near") {
    return {
      nearbyRadiusKm: 20,
      nearbyLimit: 45,
      nationwideSummaryLimit: 0,
      nationwideSchoolLimit: 0,
    };
  }

  if (distancePreference === "not-important") {
    return {
      nearbyRadiusKm: 20,
      nearbyLimit: 0,
      nationwideSummaryLimit: 240,
      nationwideSchoolLimit: 60,
    };
  }

  return {
    nearbyRadiusKm: 20,
    nearbyLimit: 45,
    nationwideSummaryLimit: 80,
    nationwideSchoolLimit: 24,
  };
}

export function selectNationwideGraduationCandidates(
  answer: SurveyAnswer,
  index: GraduationOutcomeIndex,
  limit: number,
) {
  if (limit <= 0 || index.all.length === 0) {
    return [];
  }

  return index.all
    .filter((summary) => matchesExplicitCategory(summary, answer))
    .map((summary) => ({
      summary,
      score: scoreNationwideCandidate(summary, answer),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ summary }) => summary);
}

function scoreNationwideCandidate(
  summary: GraduationOutcomeSummary,
  answer: SurveyAnswer,
) {
  const careerDirection =
    typeof answer.rawResponses?.careerDirection === "string"
      ? answer.rawResponses.careerDirection
      : "";
  const reputation =
    typeof answer.rawResponses?.schoolReputation === "number"
      ? answer.rawResponses.schoolReputation
      : 3;
  const activityPreference = Array.isArray(answer.rawResponses?.activityPreference)
    ? answer.rawResponses.activityPreference
    : [];
  const practicalRate = Math.max(
    summary.employmentRate,
    summary.juniorCollegeRate,
  );
  const schoolTypeText = normalizeText(
    `${summary.schoolName} ${summary.specialPurposeType ?? ""}`,
  );

  let score =
    summary.confidence * 18 +
    summary.outcomeStability * 0.18 +
    summary.advancementRate * 0.12;

  if (careerDirection === "college") {
    score += summary.fourYearRate * 1.8 + summary.advancementRate * 0.35;
  }

  if (careerDirection === "science") {
    score += summary.fourYearRate * 1.45 + summary.advancementRate * 0.3;
    score += /영재|과학|과학고/.test(schoolTypeText) ? 50 : 0;
  }

  if (careerDirection === "global") {
    score += summary.overseasRate * 12 + summary.fourYearRate * 1.1;
    score += /외국어|국제|외고/.test(schoolTypeText) ? 50 : 0;
  }

  if (careerDirection === "practical") {
    score += practicalRate * 1.65;
    score += /마이스터|특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(
      schoolTypeText,
    )
      ? 38
      : 0;
  }

  if (careerDirection === "arts-sports") {
    score += /예술|예고|체육|체고/.test(schoolTypeText) ? 56 : 0;
  }

  if (activityPreference.includes("career")) {
    score += practicalRate * 0.35;
  }

  if (reputation >= 4) {
    score += summary.fourYearRate * 0.45 + summary.outcomeStability * 0.25;
  }

  return score;
}

function matchesExplicitCategory(
  summary: GraduationOutcomeSummary,
  answer: SurveyAnswer,
) {
  const preference = getExplicitCategoryPreference(answer);

  if (!preference) {
    return true;
  }

  const normalizedPreference = normalizeText(preference);
  const normalizedName = normalizeText(summary.schoolName);
  const normalizedType = normalizeText(summary.specialPurposeType ?? "");
  const normalizedCategoryText = `${normalizedName} ${normalizedType}`;

  if (/일반고?$/.test(normalizedPreference)) {
    return !/영재|외국어|국제|예술|체육|마이스터|특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(
      normalizedCategoryText,
    ) && !isKnownGiftedSchoolName(summary.schoolName) && !isScienceHighSchoolName(summary.schoolName);
  }

  if (/자율형?사립|자사|자율/.test(normalizedPreference)) {
    return true;
  }

  if (/영재/.test(normalizedPreference)) {
    return /영재/.test(normalizedCategoryText) || isKnownGiftedSchoolName(summary.schoolName);
  }

  if (/외국어|외고/.test(normalizedPreference)) {
    return /외국어|외고/.test(normalizedCategoryText);
  }

  if (/국제/.test(normalizedPreference)) {
    return /국제/.test(normalizedCategoryText);
  }

  if (/과학/.test(normalizedPreference)) {
    return (
      /과학고/.test(normalizedType) ||
      isScienceHighSchoolName(summary.schoolName)
    );
  }

  if (/예술|예고/.test(normalizedPreference)) {
    return /예술|예고/.test(normalizedCategoryText);
  }

  if (/체육|체고/.test(normalizedPreference)) {
    return /체육|체고/.test(normalizedCategoryText);
  }

  if (/마이스터/.test(normalizedPreference)) {
    return /마이스터/.test(normalizedCategoryText);
  }

  if (/특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(normalizedPreference)) {
    return /특성화|공업|상업|디자인|관광|정보|기술|로봇/.test(normalizedCategoryText);
  }

  return true;
}

function getExplicitCategoryPreference(answer: SurveyAnswer) {
  const rawPreference = answer.rawResponses?.categoryPreference;

  if (typeof rawPreference === "string") {
    return rawPreference === "any" || rawPreference === "other"
      ? undefined
      : rawPreference;
  }

  return answer.rawResponses
    ? undefined
    : answer.categoryPreference;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function isKnownGiftedSchoolName(schoolName: string) {
  return /^(서울과학고등학교|경기과학고등학교|대구과학고등학교|대전과학고등학교|광주과학고등학교)$/.test(
    schoolName.replace(/\s+/g, ""),
  );
}

function isScienceHighSchoolName(schoolName: string) {
  return /^(강원|경남|경북|경산|경기북|대구일|대전동신|부산|부산일|세종|울산|인천|인천진산|전남|전북|제주|창원|충남|충북|한성)과학고등학교$/.test(
    schoolName.replace(/\s+/g, ""),
  );
}
