import {
  fetchBroadRegionForLocation,
  fetchLiveSchoolByName,
  fetchNearbyLiveSchools,
} from "@/lib/live-schools";
import { saveSurveyAnswer } from "@/lib/store";
import {
  schoolMatchesRecommendationConstraints,
  surveyAnswerSchema,
} from "@/lib/recommendation";
import { loadGraduationOutcomeIndex } from "@/lib/graduation-outcomes";
import { hasCommuteDistanceLimit } from "@/lib/commute";
import {
  getSurveyCandidateScope,
  isNationwideExpansionEnabled,
  type SurveyCandidateScope,
  selectNationwideGraduationCandidates,
} from "@/lib/survey-candidate-scope";
import { getSpecialSchoolCandidateNames } from "@/lib/special-school-candidates";
import { isSameBroadRegion, normalizeBroadRegionName } from "@/lib/korean-regions";
import type { School, SurveyAnswer } from "@/lib/types";

export const runtime = "nodejs";

const minimumRecommendationCount = 3;
const supplementalCandidateLimit = 6;

export async function POST(request: Request) {
  try {
    if (isRequestBodyTooLarge(request, 64_000)) {
      return Response.json(
        { message: "설문 응답이 너무 큽니다." },
        { status: 413 },
      );
    }

    const body = await request.json();
    const answer = surveyAnswerSchema.parse(body) as SurveyAnswer;
    const lat = answer.lat;
    const lng = answer.lng;
    const hasLocation = typeof lat === "number" && typeof lng === "number";
    const candidateScope = getSurveyCandidateScope(answer);
    const broadRegion = hasLocation
      ? await fetchBroadRegionForLocation({ lat, lng })
      : undefined;
    const liveResult =
      hasLocation && candidateScope.nearbyLimit > 0
        ? await fetchNearbyLiveSchools({
            lat,
            lng,
            level: "high",
            radiusKm: candidateScope.nearbyRadiusKm,
            limit: candidateScope.nearbyLimit,
          })
        : undefined;
    const resolvedBroadRegion =
      broadRegion ?? inferBroadRegionFromSchools(liveResult?.schools ?? []);
    const regionalSchools =
      candidateScope.regionalSchoolLimit > 0 && resolvedBroadRegion
        ? await fetchRegionalCandidateSchools(
            answer,
            resolvedBroadRegion,
            candidateScope.regionalSummaryLimit,
            candidateScope.regionalSchoolLimit,
          )
        : [];
    const nationwideSchools =
      candidateScope.nationwideSchoolLimit > 0
        ? await fetchNationwideCandidateSchools(
            answer,
            candidateScope.nationwideSummaryLimit,
            candidateScope.nationwideSchoolLimit,
          )
        : [];
    const specialTypeSchools = await fetchSpecialTypeCandidateSchools(
      answer,
      candidateScope,
      resolvedBroadRegion,
    );
    const candidates = await ensureMinimumCandidateSchools({
      answer,
      candidateScope,
      schools: uniqueSchools([
        ...(liveResult?.schools ?? []),
        ...regionalSchools,
        ...specialTypeSchools,
        ...nationwideSchools,
      ]),
    });
    const usedLiveCandidateSearch =
      hasLocation ||
      candidateScope.regionalSchoolLimit > 0 ||
      candidateScope.nationwideSchoolLimit > 0;
    const result = await saveSurveyAnswer(
      answer,
      candidates.length ? candidates : usedLiveCandidateSearch ? [] : undefined,
      candidates.length || usedLiveCandidateSearch ? "kakao-neis" : undefined,
    );

    return Response.json(result);
  } catch (error) {
    return Response.json(
      errorResponse("설문 응답 형식이 올바르지 않습니다.", error),
      { status: 400 },
    );
  }
}

async function ensureMinimumCandidateSchools({
  answer,
  candidateScope,
  schools,
}: {
  answer: SurveyAnswer;
  candidateScope: SurveyCandidateScope;
  schools: School[];
}) {
  const graduationOutcomes = loadGraduationOutcomeIndex();
  const eligibleCount = schools.filter((school) =>
    schoolMatchesRecommendationConstraints(school, answer, {
      graduationOutcomes,
    }),
  ).length;

  if (eligibleCount >= minimumRecommendationCount) {
    return schools;
  }

  if (
    candidateScope.nationwideSchoolLimit <= 0 ||
    hasCommuteDistanceLimit(answer)
  ) {
    return schools;
  }

  const supplementarySchools = await fetchNationwideCandidateSchools(
    answer,
    Math.max(candidateScope.nationwideSummaryLimit, 180),
    Math.max(minimumRecommendationCount - eligibleCount, supplementalCandidateLimit),
  );

  return uniqueSchools([...schools, ...supplementarySchools]);
}

async function fetchNationwideCandidateSchools(
  answer: SurveyAnswer,
  summaryLimit: number,
  schoolLimit: number,
) {
  const graduationOutcomes = loadGraduationOutcomeIndex();
  const summaries = selectNationwideGraduationCandidates(
    answer,
    graduationOutcomes,
    summaryLimit,
  );
  const schools = await collectWithConcurrency(summaries, 8, schoolLimit, (summary) =>
    fetchLiveSchoolByName({
      schoolName: summary.schoolName,
      region: summary.region,
      level: "high",
      includeDisclosureFacts: false,
    }).then((school) =>
      school &&
      schoolMatchesRecommendationConstraints(school, answer, {
        graduationOutcomes,
      })
        ? school
        : undefined,
    ),
  );

  return schools;
}

async function fetchRegionalCandidateSchools(
  answer: SurveyAnswer,
  broadRegion: string,
  summaryLimit: number,
  schoolLimit: number,
) {
  const graduationOutcomes = loadGraduationOutcomeIndex();
  const summaries = selectNationwideGraduationCandidates(
    answer,
    graduationOutcomes,
    summaryLimit,
    { broadRegion },
  );
  const schools = await collectWithConcurrency(summaries, 8, schoolLimit, (summary) =>
    fetchLiveSchoolByName({
      schoolName: summary.schoolName,
      region: summary.region,
      level: "high",
      includeDisclosureFacts: false,
    }).then((school) =>
      school &&
      schoolMatchesBroadRegion(school, broadRegion) &&
      schoolMatchesRecommendationConstraints(school, answer, {
        graduationOutcomes,
      })
        ? school
        : undefined,
    ),
  );

  return schools;
}

async function fetchSpecialTypeCandidateSchools(
  answer: SurveyAnswer,
  candidateScope: SurveyCandidateScope,
  broadRegion: string | undefined,
) {
  const names = getSpecialSchoolCandidateNames(answer);

  if (names.length === 0) {
    return [];
  }

  const allowNationwide = isNationwideExpansionEnabled(answer);

  if (!allowNationwide && !broadRegion) {
    return [];
  }

  const graduationOutcomes = loadGraduationOutcomeIndex();
  const targetCount = Math.min(
    names.length,
    Math.max(
      minimumRecommendationCount,
      candidateScope.regionalSchoolLimit,
      candidateScope.nationwideSchoolLimit,
    ),
  );

  return collectWithConcurrency(names, 6, targetCount, (schoolName) =>
    fetchLiveSchoolByName({
      schoolName,
      level: "high",
      includeDisclosureFacts: false,
    }).then((school) =>
      school &&
      (allowNationwide ||
        (broadRegion && schoolMatchesBroadRegion(school, broadRegion))) &&
      schoolMatchesRecommendationConstraints(school, answer, {
        graduationOutcomes,
      })
        ? school
        : undefined,
    ),
  );
}

function schoolMatchesBroadRegion(school: School, broadRegion: string) {
  return isSameBroadRegion(`${school.district} ${school.address}`, broadRegion);
}

function inferBroadRegionFromSchools(schools: School[]) {
  const school = schools.find((item) => item.address || item.district);

  return normalizeBroadRegionName(
    school ? `${school.district} ${school.address}` : undefined,
  );
}

async function collectWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  targetCount: number,
  mapper: (item: T) => Promise<R | undefined>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length && results.length < targetCount) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        const result = await mapper(items[currentIndex]);

        if (result && results.length < targetCount) {
          results.push(result);
        }
      }
    },
  );

  await Promise.all(workers);
  return results;
}

function uniqueSchools(schools: School[]) {
  const seen = new Set<string>();

  return schools.filter((school) => {
    if (seen.has(school.id)) {
      return false;
    }

    seen.add(school.id);
    return true;
  });
}

function isRequestBodyTooLarge(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return false;
  }

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}

function errorResponse(message: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    return {
      message,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return { message };
}
