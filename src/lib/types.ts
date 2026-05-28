import type { GraduationOutcomeSummary } from "@/lib/graduation-outcomes";

export type SchoolLevel = "middle" | "high";

export type SchoolGender = "coed" | "boys" | "girls";

export type StudentGender = "male" | "female";

export type SchoolDataSource = "seed" | "kakao" | "kakao-neis";

export type SchoolMetricKey =
  | "academics"
  | "activities"
  | "environment"
  | "meal"
  | "reviews"
  | "stability";

export type SchoolMetrics = Record<SchoolMetricKey, number>;

export type SchoolDisclosureDetails = {
  year: number;
  instruction?: {
    schoolDays?: number;
    weeklyClassHours?: number;
  };
  library?: {
    totalUsers?: number;
    weeklyAverageUsers?: number;
  };
  meals?: {
    targetStudents?: number;
    servedStudents?: number;
    cooks?: number;
    nutritionStaff?: number;
    cookingAssistants?: number;
    supplyRate?: number;
  };
  activities?: {
    creativeClubs?: number;
    studentClubs?: number;
    creativeParticipants?: number;
    studentParticipants?: number;
    creativeBudget?: number;
    studentClubBudget?: number;
  };
  counseling?: {
    weeClass?: boolean;
    internalSpecialist?: boolean;
    externalSpecialist?: boolean;
    counselingTeachers?: number;
    externalSpecialists?: number;
  };
  afterSchool?: {
    programs?: number;
    registeredStudents?: number;
    participatingStudents?: number;
    specialClasses?: number;
    eveningClasses?: number;
  };
  scholarships?: {
    recipients?: number;
    amount?: number;
  };
};

export type SemanticDimension =
  | "category_fit"
  | "gender_fit"
  | "commute_fit"
  | "academic_climate"
  | "college_outcome"
  | "career_outcome"
  | "global_outcome"
  | "learning_support"
  | "science_fit"
  | "practical_fit"
  | "arts_sports_fit"
  | "project_fit"
  | "activity_variety"
  | "reading_library"
  | "relationship_safety"
  | "life_enjoyment"
  | "facility_meal"
  | "reputation";

export type RecommendationEvidence = {
  dimension: SemanticDimension;
  label: string;
  source:
    | "neis"
    | "schoolinfo"
    | "kess"
    | "review"
    | "kakao"
    | "derived";
  value?: string | number;
  confidence: number;
};

export type School = {
  id: string;
  name: string;
  level: SchoolLevel;
  category: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  gender: SchoolGender;
  founded: number;
  phone: string;
  website: string;
  tags: string[];
  description: string;
  highlights: string[];
  metrics: SchoolMetrics;
  source?: SchoolDataSource;
  externalIds?: {
    kakaoPlaceId?: string;
    neisSchoolCode?: string;
    neisOfficeCode?: string;
  };
  dataUpdatedAt?: string;
  disclosure?: SchoolDisclosureDetails;
  facts: {
    students: number;
    classes: number;
    teachers: number;
    clubs: number;
    libraryBooks: number;
    mealSatisfaction: number;
    commuteNote: string;
  };
};

export type SurveyAnswer = {
  lat?: number;
  lng?: number;
  studentGender?: StudentGender;
  distancePreference: "near" | "balanced" | "not-important";
  priorities: SchoolMetricKey[];
  preferredTags: string[];
  genderPreference?: "single-gender" | "coed" | "any";
  categoryPreference?: string;
  rawResponses?: Record<string, string | string[] | number>;
};

export type Recommendation = {
  school: School;
  rank: number;
  score: number;
  matchType?: "nearby" | "balanced" | "expanded";
  semanticScore?: number;
  distanceScore?: number;
  confidence?: number;
  distanceKm?: number;
  dimensionScores?: Partial<Record<SemanticDimension, number>>;
  evidence?: RecommendationEvidence[];
  graduationOutcome?: GraduationOutcomeSummary;
  reasons: string[];
  caution?: string;
};

export type StoredSurveyResponse = {
  id: string;
  answer: SurveyAnswer;
  createdAt: string;
  recommendations: Recommendation[];
  source?: SchoolDataSource;
  persistence?: PersistenceState;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

export type PersistenceState = {
  enabled: boolean;
  persisted: boolean;
  mode: "database" | "memory";
  warning?: string;
};

export type SchoolReview = {
  id: string;
  schoolId: string;
  authorId: string;
  authorName: string;
  relation: "current" | "graduate";
  enrolledYear: number;
  graduatedYear?: number;
  ratings: {
    atmosphere: number;
    exams: number;
    meals: number;
    activities: number;
    facilities: number;
  };
  body: string;
  status: ReviewStatus;
  createdAt: string;
};
