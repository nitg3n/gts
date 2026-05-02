import { rankSchools, surveyAnswerSchema } from "@/lib/recommendation";
import type {
  SchoolReview,
  StoredSurveyResponse,
  SurveyAnswer,
} from "@/lib/types";

type GtsStore = {
  surveyResponses: Map<string, StoredSurveyResponse>;
  reviews: SchoolReview[];
};

declare global {
  // eslint-disable-next-line no-var
  var __gtsStore: GtsStore | undefined;
}

const initialReviews: SchoolReview[] = [
  {
    id: "review-1",
    schoolId: "eunkwang-girls-high",
    authorId: "seed",
    authorName: "졸업생 2024",
    relation: "graduate",
    enrolledYear: 2021,
    graduatedYear: 2024,
    ratings: {
      atmosphere: 5,
      exams: 4,
      meals: 5,
      activities: 4,
      facilities: 4,
    },
    body: "상담이 꾸준하고 분위기가 차분한 편이라 진로 고민을 말하기 좋았습니다.",
    status: "approved",
    createdAt: new Date("2026-04-08T09:00:00.000Z").toISOString(),
  },
  {
    id: "review-2",
    schoolId: "seoul-robot-high",
    authorId: "seed",
    authorName: "재학생 2026",
    relation: "current",
    enrolledYear: 2024,
    ratings: {
      atmosphere: 4,
      exams: 3,
      meals: 4,
      activities: 5,
      facilities: 5,
    },
    body: "전공 실습 시간이 많고 프로젝트를 실제로 만들어보는 기회가 많습니다.",
    status: "approved",
    createdAt: new Date("2026-04-18T11:00:00.000Z").toISOString(),
  },
  {
    id: "review-3",
    schoolId: "daechi-middle",
    authorId: "seed",
    authorName: "재학생 2025",
    relation: "current",
    enrolledYear: 2025,
    ratings: {
      atmosphere: 4,
      exams: 4,
      meals: 3,
      activities: 3,
      facilities: 4,
    },
    body: "학업 분위기가 잡혀 있고 통학이 편합니다. 동아리는 더 다양해지면 좋겠습니다.",
    status: "pending",
    createdAt: new Date("2026-04-28T12:30:00.000Z").toISOString(),
  },
];

export function getStore() {
  if (!globalThis.__gtsStore) {
    globalThis.__gtsStore = {
      surveyResponses: new Map(),
      reviews: [...initialReviews],
    };
  }

  return globalThis.__gtsStore;
}

export function saveSurveyAnswer(rawAnswer: unknown) {
  const answer = surveyAnswerSchema.parse(rawAnswer) as SurveyAnswer;
  const id = createId("response");
  const stored: StoredSurveyResponse = {
    id,
    answer,
    createdAt: new Date().toISOString(),
    recommendations: rankSchools(answer),
  };

  getStore().surveyResponses.set(id, stored);

  return stored;
}

export function getSurveyResult(id: string) {
  const stored = getStore().surveyResponses.get(id);

  if (stored) {
    return stored;
  }

  const fallback = surveyAnswerSchema.parse({
    level: "all",
    distancePreference: "balanced",
    priorities: ["activities", "environment", "academics"],
    preferredTags: ["동아리", "상담"],
  }) as SurveyAnswer;

  return {
    id: "demo",
    answer: fallback,
    createdAt: new Date().toISOString(),
    recommendations: rankSchools(fallback),
  };
}

export function listReviews(schoolId?: string, status?: SchoolReview["status"]) {
  return getStore().reviews.filter((review) => {
    if (schoolId && review.schoolId !== schoolId) {
      return false;
    }

    if (status && review.status !== status) {
      return false;
    }

    return true;
  });
}

export function createReview(
  review: Omit<SchoolReview, "id" | "createdAt" | "status">,
) {
  const newReview: SchoolReview = {
    ...review,
    id: createId("review"),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  getStore().reviews.unshift(newReview);

  return newReview;
}

export function updateReviewStatus(id: string, status: SchoolReview["status"]) {
  const review = getStore().reviews.find((item) => item.id === id);

  if (!review) {
    return undefined;
  }

  review.status = status;
  return review;
}

function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
