import {
  fetchLiveSchoolByName,
  fetchNearbyLiveSchools,
} from "@/lib/live-schools";
import { saveSurveyAnswer } from "@/lib/store";
import {
  schoolMatchesRecommendationConstraints,
  surveyAnswerSchema,
} from "@/lib/recommendation";
import { loadGraduationOutcomeIndex } from "@/lib/graduation-outcomes";
import {
  getSurveyCandidateScope,
  selectNationwideGraduationCandidates,
} from "@/lib/survey-candidate-scope";
import type { School, SurveyAnswer } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answer = surveyAnswerSchema.parse(body) as SurveyAnswer;
    const lat = answer.lat;
    const lng = answer.lng;
    const hasLocation = typeof lat === "number" && typeof lng === "number";
    const candidateScope = getSurveyCandidateScope(answer.distancePreference);
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
    const nationwideSchools =
      candidateScope.nationwideSchoolLimit > 0
        ? await fetchNationwideCandidateSchools(
            answer,
            candidateScope.nationwideSummaryLimit,
            candidateScope.nationwideSchoolLimit,
          )
        : [];
    const candidates = uniqueSchools([
      ...(liveResult?.schools ?? []),
      ...nationwideSchools,
    ]);
    const usedLiveCandidateSearch =
      hasLocation || candidateScope.nationwideSchoolLimit > 0;
    const result = await saveSurveyAnswer(
      answer,
      candidates.length ? candidates : usedLiveCandidateSearch ? [] : undefined,
      usedLiveCandidateSearch ? "kakao-neis" : undefined,
    );

    return Response.json({
      id: result.id,
      recommendations: result.recommendations,
      source: result.source,
    });
  } catch (error) {
    return Response.json(
      {
        message: "설문 응답 형식이 올바르지 않습니다.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
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
    }).then((school) =>
      school && schoolMatchesRecommendationConstraints(school, answer)
        ? school
        : undefined,
    ),
  );

  return schools;
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
