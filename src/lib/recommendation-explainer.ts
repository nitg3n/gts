import { getChoiceLabel } from "@/lib/survey";
import type {
  Recommendation,
  School,
  SchoolMetricKey,
  StudentGender,
  SurveyAnswer,
} from "@/lib/types";

type CriteriaItem = {
  label: string;
  value: string;
};

const priorityLabels: Record<SchoolMetricKey, string> = {
  academics: "면학 분위기",
  activities: "학교 활동",
  environment: "생활 분위기",
  meal: "시설·급식",
  reviews: "재학생 리뷰",
  stability: "관리·안정감",
};

const studentGenderLabels: Record<StudentGender, string> = {
  male: "남자",
  female: "여자",
};

const careerLabels: Record<string, string> = {
  undecided: "진로 미정",
  college: "대학 진학",
  science: "과학·공학·연구",
  global: "외국어·국제",
  practical: "실습·취업·기술",
  "arts-sports": "예술·체육",
};

const activityLabels: Record<string, string> = {
  club: "동아리",
  project: "프로젝트·발표",
  reading: "독서·도서관",
  career: "진로 체험",
  "arts-sports": "예술·체육",
  community: "봉사·학생자치",
};

export function getRecommendationCriteria(answer: SurveyAnswer): CriteriaItem[] {
  const raw = answer.rawResponses ?? {};
  const items: CriteriaItem[] = [];

  if (answer.studentGender) {
    items.push({
      label: "법적 성별",
      value: studentGenderLabels[answer.studentGender],
    });
  }

  items.push({
    label: "고등학교 유형",
    value: getCategoryLabel(answer),
  });

  items.push({
    label: "통학 기준",
    value: getDistancePreferenceLabel(answer.distancePreference),
  });

  const careerDirection = stringValue(raw.careerDirection);
  if (careerDirection) {
    items.push({
      label: "진로 방향",
      value: careerLabels[careerDirection] ?? getChoiceLabel("careerDirection", careerDirection),
    });
  }

  const activities = arrayValue(raw.activityPreference)
    .map((activity) => activityLabels[activity] ?? getChoiceLabel("activityPreference", activity))
    .slice(0, 3);

  if (activities.length) {
    items.push({
      label: "관심 활동",
      value: activities.join(", "),
    });
  }

  if (answer.priorities.length) {
    items.push({
      label: "중요 지표",
      value: answer.priorities
        .slice(0, 3)
        .map((priority) => priorityLabels[priority])
        .join(", "),
    });
  }

  return items;
}

export function getRecommendationAdjustmentNotes(answer: SurveyAnswer) {
  const notes: string[] = [];

  if (answer.studentGender === "male") {
    notes.push("남학생이 입학할 수 없는 여고는 추천 후보에서 제외했습니다.");
  }

  if (answer.studentGender === "female") {
    notes.push("여학생이 입학할 수 없는 남고는 추천 후보에서 제외했습니다.");
  }

  if (answer.genderPreference === "coed") {
    notes.push("공학 선호는 남녀공학 학교를 우선하는 기준으로 반영했습니다.");
  }

  if (answer.genderPreference === "single-gender") {
    notes.push("단성 학교 선호는 성별 조건에 맞는 남고 또는 여고를 우선하는 기준으로 반영했습니다.");
  }

  const explicitCategoryPreference = stringValue(answer.rawResponses?.categoryPreference);
  if (
    explicitCategoryPreference &&
    explicitCategoryPreference !== "any" &&
    explicitCategoryPreference !== "other"
  ) {
    notes.push(`${explicitCategoryPreference} 선호는 해당 계열 학교를 강하게 우선하는 조건으로 적용했습니다.`);
  }

  if (answer.distancePreference === "near") {
    notes.push("가까운 통학을 원한 경우 먼 학교는 적합도가 높아도 후순위로 조정했습니다.");
  }

  if (answer.distancePreference === "not-important") {
    notes.push("거리가 상관없다는 응답은 전국 후보까지 넓게 보는 기준으로 적용했습니다.");
  }

  return notes.slice(0, 4);
}

export function getRecommendationConclusion(
  recommendation: Recommendation,
  answer: SurveyAnswer,
) {
  const school = recommendation.school;
  const career = stringValue(answer.rawResponses?.careerDirection);
  const activity = arrayValue(answer.rawResponses?.activityPreference)[0];
  const km = recommendation.distanceKm;
  const category = recommendation.graduationOutcome?.specialPurposeType ?? school.category;

  if (career === "science" || /과학|영재/.test(category)) {
    return "과학·탐구 성향과 학업 분위기를 함께 보기 좋은 후보입니다.";
  }

  if (career === "global" || /외국어|국제/.test(category)) {
    return "외국어·국제 진로를 고려할 때 방향성이 맞는 후보입니다.";
  }

  if (career === "practical" || /특성화|마이스터/.test(category)) {
    return "실습·취업·전문 진로를 중시할 때 적합한 후보입니다.";
  }

  if (career === "arts-sports" || /예술|체육/.test(category)) {
    return "예술·체육 활동을 우선할 때 살펴볼 만한 후보입니다.";
  }

  if (activity === "club" && school.facts.clubs > 0) {
    return "동아리와 교내 활동 선택지를 보기 좋은 후보입니다.";
  }

  if (answer.distancePreference === "near" && typeof km === "number" && km <= 5) {
    return "통학 부담을 줄이면서 기본 지표도 함께 볼 수 있습니다.";
  }

  if (answer.distancePreference === "not-important") {
    return "거리보다 조건 적합도를 우선해 볼 수 있는 후보입니다.";
  }

  return "학교 유형, 지표, 통학 조건이 균형 있게 맞는 후보입니다.";
}

export function getHumanRecommendationReason(
  recommendation: Recommendation,
  answer: SurveyAnswer,
) {
  const category = recommendation.graduationOutcome?.specialPurposeType ?? recommendation.school.category;
  const career = stringValue(answer.rawResponses?.careerDirection);
  const explicitCategoryPreference = getExplicitCategoryPreference(answer);
  const strongestEvidence = getStrongestEvidenceLabel(recommendation);
  const base =
    explicitCategoryPreference
      ? `${explicitCategoryPreference} 선호와 ${category} 계열이 맞습니다`
      : career && career !== "undecided"
        ? `${careerLabels[career] ?? "진로"} 방향과 학교 성격이 맞습니다`
        : recommendation.reasons[0]?.replace(/[.。]$/, "") ??
          "설문 응답과 학교 조건이 맞습니다";
  const support = strongestEvidence
    ? ` ${strongestEvidence}도 함께 확인했습니다.`
    : ".";

  return `${base}.${support}`;
}

export function getRankDifferenceReason(
  recommendation: Recommendation,
  first: Recommendation | undefined,
  answer: SurveyAnswer,
) {
  if (!first || recommendation.school.id === first.school.id) {
    return "입학 조건, 학교 유형, 설문 응답, 통학 조건의 균형이 가장 좋습니다.";
  }

  const scoreGap = Math.max(0, Math.round(first.score - recommendation.score));
  const distanceGap =
    typeof recommendation.distanceKm === "number" &&
    typeof first.distanceKm === "number"
      ? recommendation.distanceKm - first.distanceKm
      : undefined;
  const semanticGap =
    typeof recommendation.semanticScore === "number" &&
    typeof first.semanticScore === "number"
      ? first.semanticScore - recommendation.semanticScore
      : undefined;

  if (answer.distancePreference === "near" && distanceGap && distanceGap > 8) {
    return `1순위보다 ${distanceGap.toFixed(1)}km 더 멀어 통학 기준에서 밀렸습니다.`;
  }

  if (semanticGap && semanticGap >= 6) {
    return `1순위가 설문 조건에 ${Math.round(semanticGap)}점 더 잘 맞았습니다.`;
  }

  if (distanceGap && Math.abs(distanceGap) >= 5) {
    return distanceGap > 0
      ? "학교 성격은 맞지만 통학 거리에서 1순위보다 불리합니다."
      : "통학은 더 유리하지만 설문 조건에서 1순위가 앞섰습니다.";
  }

  if (recommendation.graduationOutcome && first.graduationOutcome) {
    return "졸업 후 흐름은 비슷하지만 설문 조건 조합에서 1순위가 앞섰습니다.";
  }

  return `${scoreGap}점 차이의 유사 후보입니다. 상세 페이지에서 생활 조건을 비교해 보세요.`;
}

export function getShortSchoolLine(school: School) {
  const tags = school.tags.slice(0, 2).join("·");
  const publicLine = tags ? `${tags} 성격` : school.category;

  return `${publicLine}을 중심으로 볼 수 있는 ${school.district}의 ${school.category}입니다.`;
}

function getStrongestEvidenceLabel(recommendation: Recommendation) {
  const evidence = recommendation.evidence?.find(
    (item) =>
      item.source === "kess" ||
      item.dimension === "academic_climate" ||
      item.dimension === "activity_variety" ||
      item.dimension === "learning_support",
  );

  if (evidence?.label) {
    return evidence.label.replace(/\s+/g, " ");
  }

  const firstReason = recommendation.reasons[0];
  if (!firstReason) {
    return undefined;
  }

  return firstReason.replace(/[.。]$/, "");
}

function getCategoryLabel(answer: SurveyAnswer) {
  const raw = stringValue(answer.rawResponses?.categoryPreference);

  if (!raw || raw === "any") {
    return "아직 미정";
  }

  if (raw === "other") {
    return "기타";
  }

  return getChoiceLabel("categoryPreference", raw);
}

function getExplicitCategoryPreference(answer: SurveyAnswer) {
  const raw = stringValue(answer.rawResponses?.categoryPreference);

  if (raw && raw !== "any" && raw !== "other") {
    return raw;
  }

  if (!answer.rawResponses && answer.categoryPreference) {
    return answer.categoryPreference;
  }

  return undefined;
}

function getDistancePreferenceLabel(
  value: SurveyAnswer["distancePreference"],
) {
  if (value === "near") {
    return "가까운 통학 우선";
  }

  if (value === "not-important") {
    return "거리 제한 거의 없음";
  }

  return "통학과 적합도 균형";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
