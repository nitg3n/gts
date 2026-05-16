import { fetchNearbyLiveSchools } from "@/lib/live-schools";
import { saveSurveyAnswer } from "@/lib/store";
import {
  normalizeSurveyAnswerForRecommendation,
  surveyAnswerSchema,
} from "@/lib/recommendation";
import type { SurveyAnswer } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answer = normalizeSurveyAnswerForRecommendation(
      surveyAnswerSchema.parse(body) as SurveyAnswer,
    );
    const lat = answer.lat;
    const lng = answer.lng;
    const hasLocation = typeof lat === "number" && typeof lng === "number";
    const liveResult =
      hasLocation
        ? await fetchNearbyLiveSchools({
            lat,
            lng,
            level: answer.level,
            radiusKm: 20,
            limit: 45,
          })
        : undefined;
    const result = await saveSurveyAnswer(
      answer,
      hasLocation ? (liveResult?.schools ?? []) : undefined,
      liveResult?.source ?? (hasLocation ? "kakao-neis" : undefined),
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
