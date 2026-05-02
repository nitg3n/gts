import type { SchoolLevel, SchoolMetricKey, StudentStage } from "@/lib/types";

export type SurveyQuestionType = "hidden" | "section" | "single" | "multi" | "scale";

export type SurveyChoice = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  title: string;
  description?: string;
  required?: boolean;
  choices?: SurveyChoice[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  defaultValue?: string | string[] | number;
  weightTargets?: Array<SchoolMetricKey | "distance">;
  visibleForStages?: StudentStage[];
};

export type CleanSurvey = {
  id: string;
  title: string;
  description: string;
  audience: string;
  defaultTargetLevel: SchoolLevel | "all";
  sourceExampleFiles: string[];
  questions: SurveyQuestion[];
};

export const highSchoolSelectionSurvey: CleanSurvey = {
  id: "school-selection-v2",
  title: "학교 선택 기준 설문",
  description:
    "초등학생은 중학교, 중학생은 고등학교 추천으로 자동 전환됩니다. 답변은 추천 가중치와 선호 조건으로 변환됩니다.",
  audience: "중학교 또는 고등학교 진학을 고민하는 학생",
  defaultTargetLevel: "high",
  sourceExampleFiles: ["examples/survery_for_middle_school.json"],
  questions: [
    {
      id: "studentStage",
      type: "hidden",
      title: "현재 학교급",
      defaultValue: "middle",
    },
    {
      id: "targetLevel",
      type: "hidden",
      title: "추천 대상 학교급",
      defaultValue: "high",
    },
    {
      id: "elementaryGrade",
      type: "single",
      title: "현재 초등학교 학년은?",
      required: true,
      defaultValue: "6",
      visibleForStages: ["elementary"],
      choices: [
        { id: "elementary-grade-1", label: "1학년", value: "1" },
        { id: "elementary-grade-2", label: "2학년", value: "2" },
        { id: "elementary-grade-3", label: "3학년", value: "3" },
        { id: "elementary-grade-4", label: "4학년", value: "4" },
        { id: "elementary-grade-5", label: "5학년", value: "5" },
        { id: "elementary-grade-6", label: "6학년", value: "6" },
      ],
    },
    {
      id: "middleGrade",
      type: "single",
      title: "현재 중학교 학년은?",
      required: true,
      defaultValue: "2",
      visibleForStages: ["middle"],
      choices: [
        { id: "middle-grade-1", label: "1학년", value: "1" },
        { id: "middle-grade-2", label: "2학년", value: "2" },
        { id: "middle-grade-3", label: "3학년", value: "3" },
      ],
    },
    {
      id: "genderPreference",
      type: "single",
      title: "선호하는 학교 성별 유형은?",
      required: true,
      defaultValue: "any",
      choices: [
        {
          id: "gender-any",
          label: "상관없다",
          value: "any",
        },
        {
          id: "gender-single",
          label: "남학교 또는 여학교",
          value: "single-gender",
        },
        {
          id: "gender-coed-separated",
          label: "공학",
          value: "coed-separated",
        },
        {
          id: "gender-coed-mixed",
          label: "공학(남녀 합반)",
          value: "coed-mixed",
        },
      ],
    },
    {
      id: "categoryPreference",
      type: "single",
      title: "희망하는 고등학교 유형은?",
      required: true,
      defaultValue: "any",
      visibleForStages: ["middle"],
      choices: [
        { id: "category-undecided", label: "아직 모르겠다", value: "any" },
        { id: "category-general", label: "일반고", value: "일반고" },
        { id: "category-vocational", label: "특성화고", value: "특성화고" },
        { id: "category-autonomous", label: "자율형 사립고", value: "자율형 사립고" },
        { id: "category-language", label: "외국어고", value: "외국어고" },
        { id: "category-science", label: "과학고", value: "과학고" },
        { id: "category-arts", label: "예술고", value: "예술고" },
        { id: "category-sports", label: "체육고", value: "체육고" },
        { id: "category-meister", label: "마이스터고", value: "마이스터고" },
        { id: "category-other", label: "기타", value: "other" },
      ],
    },
    {
      id: "middleEnvironmentPreference",
      type: "single",
      title: "중학교를 고를 때 가장 보고 싶은 분위기는?",
      required: true,
      defaultValue: "balanced",
      visibleForStages: ["elementary"],
      choices: [
        { id: "middle-env-balanced", label: "학업과 생활의 균형", value: "balanced" },
        { id: "middle-env-study", label: "공부하는 분위기", value: "study" },
        { id: "middle-env-activity", label: "활동과 동아리", value: "activity" },
        { id: "middle-env-care", label: "생활지도와 상담", value: "care" },
        { id: "middle-env-near", label: "가까운 통학", value: "near" },
      ],
    },
    {
      id: "selectionWeightSection",
      type: "section",
      title: "학교 선택에 영향을 주는 요소",
      description: "각 항목이 내 학교 선택에서 얼마나 중요한지 1-5점으로 표시합니다.",
    },
    {
      id: "studyAtmosphere",
      type: "scale",
      title: "면학 분위기",
      description: "공부하는 분위기와 학습 지원",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["academics"],
    },
    {
      id: "schoolLife",
      type: "scale",
      title: "학교 생활의 즐거움",
      description: "동아리, 축제, 체육대회, 교내 활동",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["activities", "reviews"],
    },
    {
      id: "commuteImportance",
      type: "scale",
      title: "통학 거리",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["distance"],
    },
    {
      id: "friendsInfluence",
      type: "scale",
      title: "친한 친구들의 진학 여부",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["environment", "reviews"],
    },
    {
      id: "schoolReputation",
      type: "scale",
      title: "학교에 대한 주변 인식",
      description: "입시 결과, 학교 평판, 주변 추천",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["reviews", "academics"],
    },
    {
      id: "facilityMeal",
      type: "scale",
      title: "학교 시설 및 급식의 질",
      required: true,
      min: 1,
      max: 5,
      minLabel: "중요하지 않다",
      maxLabel: "매우 중요하다",
      weightTargets: ["environment", "meal"],
    },
    {
      id: "commuteTime",
      type: "single",
      title: "등하교 시간은 어느 정도까지 가능한가요?",
      required: true,
      defaultValue: "balanced",
      choices: [
        { id: "commute-10", label: "10분 이내", value: "very-near" },
        { id: "commute-20", label: "10-20분", value: "near" },
        { id: "commute-30", label: "20-30분", value: "balanced" },
        { id: "commute-50", label: "40-50분", value: "far-ok" },
        { id: "commute-any", label: "상관없음", value: "any" },
      ],
    },
  ],
};

export const schoolExperienceSurvey: CleanSurvey = {
  id: "school-experience-v1",
  title: "입학 후 학교 경험 설문",
  description:
    "고등학생 대상 Google Form 원본을 리뷰/만족도 수집용으로 정제한 보조 설문입니다.",
  audience: "현재 재학생 또는 졸업생",
  defaultTargetLevel: "high",
  sourceExampleFiles: ["examples/survery_for_high_school.json"],
  questions: [
    {
      id: "studentGrade",
      type: "single",
      title: "본인의 학년은?",
      required: true,
      choices: [
        { id: "grade-1", label: "1학년", value: "1" },
        { id: "grade-2", label: "2학년", value: "2" },
        { id: "grade-3", label: "3학년", value: "3" },
      ],
    },
    {
      id: "satisfiedAfterAdmission",
      type: "multi",
      title: "실제 입학 후 가장 만족하는 것을 모두 고르면?",
      required: true,
      choices: [
        { id: "satisfied-meal", label: "급식의 질과 학교 시설", value: "meal-facility" },
        { id: "satisfied-study", label: "공부하기 좋은 학습 분위기", value: "study" },
        { id: "satisfied-friends", label: "좋은 친구들과 반 분위기", value: "friends" },
        { id: "satisfied-activity", label: "다양한 교내 활동", value: "activities" },
        { id: "satisfied-events", label: "축제, 체육대회 등 행사", value: "events" },
        { id: "satisfied-other", label: "기타", value: "other" },
      ],
    },
    {
      id: "recommendSchool",
      type: "single",
      title: "후배들에게 우리 학교를 추천하고 싶나요?",
      required: true,
      choices: [
        { id: "recommend-yes", label: "예", value: "yes" },
        { id: "recommend-no", label: "아니오", value: "no" },
      ],
    },
    {
      id: "chooseAgain",
      type: "single",
      title: "다시 선택해도 현재 학교를 선택할 것인가요?",
      required: true,
      choices: [
        { id: "again-yes", label: "예", value: "yes" },
        { id: "again-no", label: "아니오", value: "no" },
      ],
    },
  ],
};

export const schoolSelectionSurvey = highSchoolSelectionSurvey;
export const selectionSurveys = [highSchoolSelectionSurvey];
export const surveys = [highSchoolSelectionSurvey, schoolExperienceSurvey];
