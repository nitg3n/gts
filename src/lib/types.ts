export type SchoolLevel = "middle" | "high";

export type StudentStage = "elementary" | "middle";

export type SchoolGender = "coed" | "boys" | "girls";

export type SchoolDataSource = "seed" | "kakao" | "kakao-neis";

export type SchoolMetricKey =
  | "academics"
  | "activities"
  | "environment"
  | "meal"
  | "reviews"
  | "stability";

export type SchoolMetrics = Record<SchoolMetricKey, number>;

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
  level: SchoolLevel | "all";
  studentStage?: StudentStage;
  lat?: number;
  lng?: number;
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
  distanceKm?: number;
  reasons: string[];
  caution?: string;
};

export type StoredSurveyResponse = {
  id: string;
  answer: SurveyAnswer;
  createdAt: string;
  recommendations: Recommendation[];
  source?: SchoolDataSource;
};

export type ReviewStatus = "pending" | "approved" | "rejected";

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
