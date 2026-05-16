import type { SchoolLevel, SchoolMetricKey, StudentStage } from "@/lib/types";

export type SurveyQuestionType = "hidden" | "section" | "single" | "multi" | "scale";

export type SurveyStepId = "profile" | "fit" | "priorities" | "commute";

export type SurveyChoice = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  step?: SurveyStepId;
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
  id: "school-selection-v3",
  title: "학교 선택 기준 설문",
  description:
    "현재 학년과 선택 기준을 바탕으로 초등학생에게는 중학교, 중학생에게는 고등학교를 추천합니다.",
  audience: "중학교 또는 고등학교 진학을 고민하는 학생",
  defaultTargetLevel: "high",
  sourceExampleFiles: ["examples/survery_for_middle_school.json"],
  questions: [
    {
      id: "studentStage",
      type: "hidden",
      step: "profile",
      title: "현재 학교급",
      defaultValue: "middle",
    },
    {
      id: "targetLevel",
      type: "hidden",
      step: "profile",
      title: "추천 대상 학교급",
      defaultValue: "high",
    },
    {
      id: "elementaryGrade",
      type: "single",
      step: "profile",
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
      step: "profile",
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
      step: "fit",
      title: "선호하는 학교 성별 유형은?",
      required: true,
      defaultValue: "any",
      choices: [
        { id: "gender-any", label: "상관없다", value: "any" },
        {
          id: "gender-single",
          label: "남학교 또는 여학교",
          value: "single-gender",
          hint: "남중, 여중, 남고, 여고를 더 우선합니다.",
        },
        {
          id: "gender-coed-separated",
          label: "공학",
          value: "coed-separated",
          hint: "남녀공학 학교를 더 우선합니다.",
        },
        {
          id: "gender-coed-class-separated",
          label: "공학 분반",
          value: "coed-class-separated",
          hint: "공학 중에서도 남녀 분반 선호로 기록합니다.",
        },
      ],
    },
    {
      id: "categoryPreference",
      type: "single",
      step: "fit",
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
      id: "careerDirection",
      type: "single",
      step: "fit",
      title: "현재 가장 가까운 진로 방향은?",
      required: true,
      defaultValue: "undecided",
      visibleForStages: ["middle"],
      choices: [
        { id: "career-undecided", label: "아직 정하지 못했다", value: "undecided" },
        { id: "career-college", label: "대학 진학 중심", value: "college" },
        { id: "career-science", label: "과학, 공학, 연구", value: "science" },
        { id: "career-global", label: "외국어, 국제", value: "global" },
        { id: "career-practical", label: "실습, 취업, 기술", value: "practical" },
        { id: "career-arts", label: "예술, 체육", value: "arts-sports" },
      ],
    },
    {
      id: "middleEnvironmentPreference",
      type: "single",
      step: "fit",
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
      id: "transitionConcern",
      type: "multi",
      step: "fit",
      title: "새 학교에서 걱정되는 점은?",
      description: "여러 개를 고를 수 있습니다.",
      required: true,
      defaultValue: [],
      choices: [
        { id: "concern-study", label: "수업 난이도", value: "study" },
        { id: "concern-friends", label: "친구 관계", value: "friends" },
        { id: "concern-rules", label: "생활지도", value: "care" },
        { id: "concern-commute", label: "통학", value: "commute" },
        { id: "concern-activity", label: "활동 적응", value: "activity" },
      ],
    },
    {
      id: "activityPreference",
      type: "multi",
      step: "fit",
      title: "학교에서 해보고 싶은 활동은?",
      description: "관심 활동은 추천 이유와 학교 태그에 반영됩니다.",
      required: true,
      defaultValue: [],
      choices: [
        { id: "activity-club", label: "동아리", value: "club" },
        { id: "activity-project", label: "프로젝트, 발표", value: "project" },
        { id: "activity-reading", label: "독서, 도서관", value: "reading" },
        { id: "activity-career", label: "진로 체험", value: "career" },
        { id: "activity-arts", label: "예술, 체육", value: "arts-sports" },
        { id: "activity-volunteer", label: "봉사, 학생자치", value: "community" },
      ],
    },
    {
      id: "studyAtmosphere",
      type: "scale",
      step: "priorities",
      title: "면학 분위기",
      description: "공부하는 분위기와 학습 지원",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["academics"],
    },
    {
      id: "learningSupportNeed",
      type: "scale",
      step: "priorities",
      title: "학습 관리와 진로 지원",
      description: "상담, 진학 정보, 진로 탐색 프로그램",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["academics", "stability"],
    },
    {
      id: "schoolLife",
      type: "scale",
      step: "priorities",
      title: "학교 생활의 즐거움",
      description: "동아리, 축제, 체육대회, 교내 활동",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["activities", "reviews"],
    },
    {
      id: "relationshipSafety",
      type: "scale",
      step: "priorities",
      title: "친구 관계와 생활 분위기",
      description: "편안한 관계, 생활지도, 상담 분위기",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["environment", "stability", "reviews"],
    },
    {
      id: "schoolReputation",
      type: "scale",
      step: "priorities",
      title: "학교에 대한 주변 인식",
      description: "진학 결과, 평판, 주변 추천",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["reviews", "academics"],
    },
    {
      id: "facilityMeal",
      type: "scale",
      step: "priorities",
      title: "시설과 급식",
      required: true,
      min: 1,
      max: 5,
      minLabel: "낮음",
      maxLabel: "높음",
      defaultValue: 3,
      weightTargets: ["environment", "meal"],
    },
    {
      id: "commuteImportance",
      type: "scale",
      step: "commute",
      title: "통학 거리",
      required: true,
      min: 1,
      max: 5,
      minLabel: "상관없음",
      maxLabel: "매우 중요",
      defaultValue: 3,
      weightTargets: ["distance"],
    },
    {
      id: "commuteTime",
      type: "single",
      step: "commute",
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
    {
      id: "commuteMethod",
      type: "single",
      step: "commute",
      title: "주로 어떤 방식으로 통학할 예정인가요?",
      required: true,
      defaultValue: "any",
      choices: [
        { id: "commute-method-any", label: "아직 모름", value: "any" },
        { id: "commute-method-walk", label: "도보", value: "walk" },
        { id: "commute-method-transit", label: "대중교통", value: "transit" },
        { id: "commute-method-car", label: "보호자 차량", value: "car" },
        { id: "commute-method-bike", label: "자전거, 킥보드", value: "bike" },
      ],
    },
  ],
};

export const schoolExperienceSurvey: CleanSurvey = {
  id: "school-experience-v1",
  title: "입학 후 학교 경험 설문",
  description:
    "현재 재학생과 졸업생의 경험을 리뷰와 만족도로 정리하기 위한 보조 설문입니다.",
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
