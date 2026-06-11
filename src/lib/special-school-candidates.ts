import type { SurveyAnswer } from "@/lib/types";

const giftedSchoolNames = [
  "서울과학고등학교",
  "경기과학고등학교",
  "대구과학고등학교",
  "대전과학고등학교",
  "광주과학고등학교",
  "한국과학영재학교",
  "세종과학예술영재학교",
  "인천과학예술영재학교",
];

const scienceHighSchoolNames = [
  "강원과학고등학교",
  "경남과학고등학교",
  "경북과학고등학교",
  "경산과학고등학교",
  "경기북과학고등학교",
  "대구일과학고등학교",
  "대전동신과학고등학교",
  "부산과학고등학교",
  "부산일과학고등학교",
  "세종과학고등학교",
  "울산과학고등학교",
  "인천과학고등학교",
  "인천진산과학고등학교",
  "전남과학고등학교",
  "전북과학고등학교",
  "제주과학고등학교",
  "창원과학고등학교",
  "충남과학고등학교",
  "충북과학고등학교",
  "한성과학고등학교",
];

const internationalHighSchoolNames = [
  "고양국제고등학교",
  "동탄국제고등학교",
  "부산국제고등학교",
  "서울국제고등학교",
  "세종국제고등학교",
  "인천국제고등학교",
  "청심국제고등학교",
];

export function getSpecialSchoolCandidateNames(answer: SurveyAnswer) {
  const preference = getExplicitCategoryPreference(answer);

  if (!preference) {
    return [];
  }

  const normalized = preference.replace(/\s+/g, "");

  if (/영재/.test(normalized)) {
    return giftedSchoolNames;
  }

  if (/과학/.test(normalized)) {
    return scienceHighSchoolNames;
  }

  if (/국제/.test(normalized)) {
    return internationalHighSchoolNames;
  }

  return [];
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
