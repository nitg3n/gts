import "server-only";

import { rankSchools, surveyAnswerSchema } from "@/lib/recommendation";
import { fetchLiveSchoolBySlug } from "@/lib/live-schools";
import { loadGraduationOutcomeIndex } from "@/lib/graduation-outcomes";
import { getSchoolById, schools } from "@/lib/schools";
import { normalizeSchoolIdParam } from "@/lib/school-slug";
import { hasPersistentDatabase, queryPersistentStore } from "@/lib/persistence";
import { surveys as defaultSurveys } from "@/data/surveys";
import type { CleanSurvey, SurveyQuestion } from "@/data/surveys";
import type {
  School,
  SchoolReview,
  StoredSurveyResponse,
  SurveyAnswer,
} from "@/lib/types";

type GtsStore = {
  schools: Map<string, School>;
  surveys: CleanSurvey[];
  activeSurveyId: string;
  surveyResponses: Map<string, StoredSurveyResponse>;
  reviews: SchoolReview[];
};

declare global {
  var __gtsStore: GtsStore | undefined;
  var __gtsPersistentDefaultsReady: Promise<void> | undefined;
}

export function getStore() {
  if (!globalThis.__gtsStore) {
    globalThis.__gtsStore = {
      schools: new Map(schools.map((school) => [school.id, school])),
      surveys: cloneSurveys(defaultSurveys),
      activeSurveyId: defaultSurveys[0].id,
      surveyResponses: new Map(),
      reviews: [],
    };
  }

  if (!globalThis.__gtsStore.schools) {
    globalThis.__gtsStore.schools = new Map(
      schools.map((school) => [school.id, school]),
    );
  }

  if (!globalThis.__gtsStore.surveys) {
    globalThis.__gtsStore.surveys = cloneSurveys(defaultSurveys);
    globalThis.__gtsStore.activeSurveyId = defaultSurveys[0].id;
  }

  if (
    !globalThis.__gtsStore.surveys.some(
      (survey) => survey.id === defaultSurveys[0].id,
    )
  ) {
    globalThis.__gtsStore.surveys = cloneSurveys(defaultSurveys);
    globalThis.__gtsStore.activeSurveyId = defaultSurveys[0].id;
  }

  return globalThis.__gtsStore;
}

export function cacheSchools(nextSchools: School[]) {
  const store = getStore();

  nextSchools.forEach((school) => {
    store.schools.set(school.id, school);
  });
}

export function getCachedSchool(id: string) {
  const normalizedId = normalizeSchoolIdParam(id);
  const store = getStore();
  const direct = store.schools.get(normalizedId) ?? getSchoolById(normalizedId);

  if (direct) {
    return direct;
  }

  if (normalizedId.startsWith("kakao-")) {
    const kakaoPlaceId = normalizedId.replace(/^kakao-/, "");

    return [...store.schools.values()].find(
      (school) => school.externalIds?.kakaoPlaceId === kakaoPlaceId,
    );
  }

  return undefined;
}

export async function getSchoolByRouteId(id: string) {
  const cached = getCachedSchool(id);

  if (cached) {
    return cached;
  }

  const liveSchool = await fetchLiveSchoolBySlug(id);

  if (liveSchool) {
    cacheSchools([liveSchool]);
  }

  return liveSchool;
}

export async function listSurveyDefinitions() {
  const persistentSurveys = await readPersistentSurveys();

  if (persistentSurveys) {
    return cloneSurveys(persistentSurveys);
  }

  return cloneSurveys(getStore().surveys);
}

export async function getActiveSurvey() {
  const persistentSurvey = await readPersistentActiveSurvey();

  if (persistentSurvey) {
    return cloneSurvey(persistentSurvey);
  }

  const store = getStore();
  return cloneSurvey(
    store.surveys.find((survey) => survey.id === store.activeSurveyId) ??
      store.surveys[0],
  );
}

export async function saveSurveyDefinition(
  survey: CleanSurvey,
  activeSurveyId?: string,
) {
  const activeId = await getActiveSurveyId();
  const store = getStore();
  const cleanSurvey = normalizeSurveyDefinition(survey);
  const shouldActivateInMemory = Boolean(
    activeSurveyId || store.activeSurveyId === survey.id,
  );
  const persistentActiveSurveyId =
    activeSurveyId ?? (activeId === cleanSurvey.id ? cleanSurvey.id : undefined);
  const persisted = await writePersistentSurveyDefinition(
    cleanSurvey,
    persistentActiveSurveyId,
  );

  if (hasPersistentDatabase() && !persisted) {
    throw new Error("설문을 Supabase에 저장하지 못했습니다.");
  }

  const existingIndex = store.surveys.findIndex((item) => item.id === cleanSurvey.id);

  if (existingIndex >= 0) {
    store.surveys[existingIndex] = cleanSurvey;
  } else {
    store.surveys.push(cleanSurvey);
  }

  if (shouldActivateInMemory) {
    store.activeSurveyId = activeSurveyId ?? cleanSurvey.id;
  }

  return cloneSurvey(cleanSurvey);
}

export async function getActiveSurveyId() {
  const persistentId = await readPersistentActiveSurveyId();

  if (persistentId) {
    return persistentId;
  }

  return getStore().activeSurveyId;
}

export async function saveSurveyAnswer(
  rawAnswer: unknown,
  candidates?: School[],
  source?: StoredSurveyResponse["source"],
) {
  const answer = surveyAnswerSchema.parse(rawAnswer) as SurveyAnswer;
  const schoolCandidates = Array.isArray(candidates) ? candidates : undefined;

  if (schoolCandidates?.length) {
    cacheSchools(schoolCandidates);
  }

  const reviews = await getRecommendationReviews();
  const graduationOutcomes = loadGraduationOutcomeIndex();
  const id = createId("response");
  const stored: StoredSurveyResponse = {
    id,
    answer: sanitizeSurveyAnswer(answer),
    createdAt: new Date().toISOString(),
    recommendations: highSchoolRecommendations(
      rankSchools(answer, schoolCandidates, { graduationOutcomes, reviews }),
    ),
    source: source ?? (schoolCandidates ? "kakao" : "seed"),
  };

  getStore().surveyResponses.set(id, stored);
  await writePersistentSurveyResponse(stored);

  return stored;
}

export async function getSurveyResult(id: string) {
  const stored = getStore().surveyResponses.get(id);

  if (stored) {
    const normalized = normalizeStoredSurveyResponse(stored);
    getStore().surveyResponses.set(id, normalized);
    return normalized;
  }

  const persistent = await readPersistentSurveyResponse(id);

  if (persistent) {
    const normalized = normalizeStoredSurveyResponse(persistent);
    cacheSchools(
      normalized.recommendations.map((recommendation) => recommendation.school),
    );
    getStore().surveyResponses.set(id, normalized);
    return normalized;
  }

  const fallback = surveyAnswerSchema.parse({
    distancePreference: "balanced",
    priorities: ["activities", "environment", "academics"],
    preferredTags: ["동아리", "상담"],
  }) as SurveyAnswer;

  return {
    id: "demo",
    answer: fallback,
    createdAt: new Date().toISOString(),
    recommendations: highSchoolRecommendations(rankSchools(fallback)),
  };
}

function normalizeStoredSurveyResponse(
  response: StoredSurveyResponse,
): StoredSurveyResponse {
  const answer = surveyAnswerSchema.parse(response.answer) as SurveyAnswer;

  return {
    ...response,
    answer: sanitizeSurveyAnswer(answer),
    recommendations: highSchoolRecommendations(response.recommendations),
  };
}

function highSchoolRecommendations(
  recommendations: StoredSurveyResponse["recommendations"],
) {
  return recommendations
    .filter((recommendation) => recommendation.school?.level === "high")
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));
}

export async function listReviews(
  schoolId?: string,
  status?: SchoolReview["status"],
) {
  const persistentReviews = await readPersistentReviews(schoolId, status);

  if (persistentReviews) {
    return persistentReviews.filter(isUserReview);
  }

  return getStore().reviews.filter((review) => {
    if (!isUserReview(review)) {
      return false;
    }

    if (schoolId && review.schoolId !== schoolId) {
      return false;
    }

    if (status && review.status !== status) {
      return false;
    }

    return true;
  });
}

export async function createReview(
  review: Omit<SchoolReview, "id" | "createdAt" | "status">,
) {
  const newReview: SchoolReview = {
    ...review,
    id: createId("review"),
    status: "approved",
    createdAt: new Date().toISOString(),
  };

  getStore().reviews.unshift(newReview);
  await writePersistentReview(newReview);

  return newReview;
}

export async function updateReviewStatus(id: string, status: SchoolReview["status"]) {
  const persistentReview = await updatePersistentReviewStatus(id, status);
  const review = getStore().reviews.find((item) => item.id === id);

  if (persistentReview) {
    if (review) {
      Object.assign(review, persistentReview);
    } else {
      getStore().reviews.unshift(persistentReview);
    }

    return persistentReview;
  }

  if (!review) {
    return undefined;
  }

  review.status = status;
  return review;
}

async function readPersistentSurveys() {
  return readPersistent(async () => {
    const result = await queryPersistentStore<{ payload: CleanSurvey }>(
      `
        select payload
        from public.gts_surveys
        order by is_active desc, updated_at desc
      `,
    );

    const surveys = result?.rows.map((row) => normalizeSurveyDefinition(row.payload));
    return surveys ? uniqueSurveysById(surveys) : surveys;
  });
}

async function readPersistentActiveSurvey() {
  return readPersistent(async () => {
    const result = await queryPersistentStore<{ payload: CleanSurvey }>(
      `
        select payload
        from public.gts_surveys
        where is_active = true
        order by updated_at desc
        limit 1
      `,
    );

    const survey = result?.rows[0]?.payload;
    return survey ? normalizeSurveyDefinition(survey) : undefined;
  });
}

async function readPersistentActiveSurveyId() {
  return readPersistent(async () => {
    const result = await queryPersistentStore<{ id: string }>(
      `
        select id
        from public.gts_surveys
        where is_active = true
        order by updated_at desc
        limit 1
      `,
    );

    return result?.rows[0]?.id;
  });
}

async function writePersistentSurveyDefinition(
  survey: CleanSurvey,
  activeSurveyId?: string,
) {
  return writePersistent(async () => {
    if (activeSurveyId) {
      await queryPersistentStore(
        "update public.gts_surveys set is_active = false where is_active = true",
      );
    }

    await queryPersistentStore(
      `
        insert into public.gts_surveys (id, payload, is_active, updated_at)
        values ($1, $2::jsonb, $3, now())
        on conflict (id) do update set
          payload = excluded.payload,
          is_active = excluded.is_active,
          updated_at = now()
      `,
      [survey.id, JSON.stringify(survey), activeSurveyId === survey.id],
    );
  });
}

async function writePersistentSurveyResponse(response: StoredSurveyResponse) {
  await writePersistent(async () => {
    await queryPersistentStore(
      `
        insert into public.gts_survey_responses
          (id, answer, recommendations, source, created_at)
        values ($1, $2::jsonb, $3::jsonb, $4, $5)
        on conflict (id) do update set
          answer = excluded.answer,
          recommendations = excluded.recommendations,
          source = excluded.source
      `,
      [
        response.id,
        JSON.stringify(response.answer),
        JSON.stringify(response.recommendations),
        response.source,
        response.createdAt,
      ],
    );
  });
}

async function readPersistentSurveyResponse(id: string) {
  return readPersistent(async () => {
    const result = await queryPersistentStore<{
      id: string;
      answer: SurveyAnswer;
      recommendations: StoredSurveyResponse["recommendations"];
      source: StoredSurveyResponse["source"] | null;
      created_at: Date | string;
    }>(
      `
        select id, answer, recommendations, source, created_at
        from public.gts_survey_responses
        where id = $1
        limit 1
      `,
      [id],
    );
    const row = result?.rows[0];

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      answer: surveyAnswerSchema.parse(row.answer) as SurveyAnswer,
      createdAt: toIsoString(row.created_at),
      recommendations: row.recommendations,
      source: row.source ?? undefined,
    } satisfies StoredSurveyResponse;
  });
}

async function readPersistentReviews(
  schoolId?: string,
  status?: SchoolReview["status"],
) {
  return readPersistent(async () => {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (schoolId) {
      params.push(schoolId);
      clauses.push(`school_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }

    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await queryPersistentStore<{ payload: SchoolReview }>(
      `
        select payload
        from public.gts_reviews
        ${where}
        order by created_at desc
      `,
      params,
    );

    return result?.rows.map((row) => row.payload);
  });
}

async function getRecommendationReviews() {
  const persistentReviews = await readPersistentReviews(undefined, "approved");

  if (persistentReviews) {
    return persistentReviews.filter(isUserReview);
  }

  return getStore().reviews.filter(isUserReview);
}

async function writePersistentReview(review: SchoolReview) {
  await writePersistent(async () => {
    await queryPersistentStore(
      `
        insert into public.gts_reviews
          (id, school_id, status, payload, created_at, updated_at)
        values ($1, $2, $3, $4::jsonb, $5, now())
        on conflict (id) do update set
          school_id = excluded.school_id,
          status = excluded.status,
          payload = excluded.payload,
          updated_at = now()
      `,
      [
        review.id,
        review.schoolId,
        review.status,
        JSON.stringify(review),
        review.createdAt,
      ],
    );
  });
}

async function updatePersistentReviewStatus(
  id: string,
  status: SchoolReview["status"],
) {
  return readPersistent(async () => {
    const result = await queryPersistentStore<{ payload: SchoolReview }>(
      `
        update public.gts_reviews
        set
          status = $2,
          payload = jsonb_set(payload, '{status}', to_jsonb($2::text), true),
          updated_at = now()
        where id = $1
        returning payload
      `,
      [id, status],
    );

    return result?.rows[0]?.payload;
  });
}

async function readPersistent<T>(operation: () => Promise<T | undefined>) {
  try {
    await ensurePersistentDefaults();
    return await operation();
  } catch (error) {
    logPersistentStoreError(error);
    return undefined;
  }
}

async function writePersistent(operation: () => Promise<void>) {
  if (!hasPersistentDatabase()) {
    return false;
  }

  try {
    await ensurePersistentDefaults();
    await operation();
    return true;
  } catch (error) {
    logPersistentStoreError(error);
    // Keep local development usable even if the database is unavailable.
    return false;
  }
}

async function ensurePersistentDefaults() {
  if (!globalThis.__gtsPersistentDefaultsReady) {
    globalThis.__gtsPersistentDefaultsReady = seedPersistentDefaults();
  }

  return globalThis.__gtsPersistentDefaultsReady.catch((error) => {
    globalThis.__gtsPersistentDefaultsReady = undefined;
    throw error;
  });
}

async function seedPersistentDefaults() {
  const surveyCount = await queryPersistentStore<{ count: string }>(
    "select count(*) from public.gts_surveys",
  );

  if (!surveyCount) {
    return;
  }

  await Promise.all(
    defaultSurveys.map((survey, index) =>
      queryPersistentStore(
        `
          insert into public.gts_surveys (id, payload, is_active)
          values ($1, $2::jsonb, $3)
          on conflict (id) do nothing
        `,
        [
          survey.id,
          JSON.stringify(survey),
          Number(surveyCount.rows[0]?.count ?? 0) === 0 && index === 0,
        ],
      ),
    ),
  );

  const activeSurvey = await queryPersistentStore<{ id: string }>(
    `
      select id
      from public.gts_surveys
      where is_active = true
      order by updated_at desc
      limit 1
    `,
  );
  const activeSurveyId = activeSurvey?.rows[0]?.id;
  const shouldActivateCurrentDefault =
    !activeSurveyId ||
    (activeSurveyId.startsWith("school-selection-") &&
      activeSurveyId !== defaultSurveys[0].id);

  if (shouldActivateCurrentDefault) {
    await queryPersistentStore(
      "update public.gts_surveys set is_active = false where is_active = true",
    );
    await queryPersistentStore(
      "update public.gts_surveys set is_active = true where id = $1",
      [defaultSurveys[0].id],
    );
  }
}

function isUserReview(review: SchoolReview) {
  return review.authorId !== "seed";
}

function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSurveyDefinition(survey: CleanSurvey): CleanSurvey {
  const isSelectionSurvey = survey.id.startsWith("school-selection-");
  const currentSelectionSurvey = defaultSurveys[0];

  return {
    ...survey,
    id: isSelectionSurvey
      ? currentSelectionSurvey.id
      : survey.id.trim() || createId("survey"),
    title: isSelectionSurvey
      ? currentSelectionSurvey.title
      : survey.title.trim() || "새 설문",
    description: isSelectionSurvey
      ? currentSelectionSurvey.description
      : survey.description.trim(),
    audience: isSelectionSurvey
      ? currentSelectionSurvey.audience
      : survey.audience.trim() || "중학생",
    sourceExampleFiles: isSelectionSurvey
      ? currentSelectionSurvey.sourceExampleFiles
      : survey.sourceExampleFiles ?? [],
    questions: (isSelectionSurvey ? currentSelectionSurvey.questions : survey.questions)
      .map(normalizeHighSchoolOnlyQuestion)
      .filter((question): question is CleanSurvey["questions"][number] =>
        Boolean(question),
      )
      .map((question, index) => ({
        ...question,
        id: question.id.trim() || `question-${index + 1}`,
        title: question.title.trim() || "새 질문",
        choices: question.choices?.map((choice, choiceIndex) => ({
          ...choice,
          id: choice.id.trim() || `${question.id}-choice-${choiceIndex + 1}`,
          label: choice.label.trim() || "선택지",
          value: choice.value.trim() || choice.label.trim() || `choice-${choiceIndex + 1}`,
        })),
      })),
  };
}

function normalizeHighSchoolOnlyQuestion(
  question: SurveyQuestion,
): SurveyQuestion | undefined {
  if (
    question.id === "elementaryGrade" ||
    question.id === "middleEnvironmentPreference"
  ) {
    return undefined;
  }

  return question;
}

function cloneSurvey(survey: CleanSurvey): CleanSurvey {
  return JSON.parse(JSON.stringify(survey)) as CleanSurvey;
}

function cloneSurveys(surveys: CleanSurvey[]) {
  return surveys.map(cloneSurvey);
}

function uniqueSurveysById(surveys: CleanSurvey[]) {
  const seen = new Set<string>();

  return surveys.filter((survey) => {
    if (seen.has(survey.id)) {
      return false;
    }

    seen.add(survey.id);
    return true;
  });
}

function sanitizeSurveyAnswer(answer: SurveyAnswer) {
  const cleanAnswer = { ...answer };
  delete cleanAnswer.lat;
  delete cleanAnswer.lng;

  return JSON.parse(JSON.stringify(cleanAnswer)) as SurveyAnswer;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function logPersistentStoreError(error: unknown) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const detail =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
  const hint =
    detail.includes("getaddrinfo ENOTFOUND") &&
    detail.includes(".supabase.co")
      ? " Supabase direct DB hosts can require IPv6. Use the Supavisor pooler connection string in SUPABASE_DATABASE_URL or POSTGRES_URL."
      : "";

  console.warn(`[gts:persistence] ${detail}${hint}`);
}
