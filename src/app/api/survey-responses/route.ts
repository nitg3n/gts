import { fetchNearbyLiveSchools } from "@/lib/live-schools";
import { saveSurveyAnswer } from "@/lib/store";
import { surveyAnswerSchema } from "@/lib/recommendation";
import type { SurveyAnswer } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const answer = surveyAnswerSchema.parse(body) as SurveyAnswer;
    const liveResult =
      typeof answer.lat === "number" && typeof answer.lng === "number"
        ? await fetchNearbyLiveSchools({
            lat: answer.lat,
            lng: answer.lng,
            level: answer.level,
            radiusKm: answer.distancePreference === "near" ? 12 : 20,
          })
        : undefined;
    const result = await saveSurveyAnswer(
      answer,
      liveResult?.schools,
      liveResult?.source,
    );

    return Response.json({
      id: result.id,
      recommendations: result.recommendations,
      source: liveResult?.source ?? "seed",
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
