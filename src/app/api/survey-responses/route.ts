import { saveSurveyAnswer } from "@/lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = saveSurveyAnswer(body);

    return Response.json({
      id: result.id,
      recommendations: result.recommendations,
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
