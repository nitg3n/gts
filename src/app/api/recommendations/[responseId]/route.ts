import { getSurveyResult } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/recommendations/[responseId]">,
) {
  const { responseId } = await context.params;
  const result = await getSurveyResult(responseId);

  if (!result) {
    return Response.json(
      { message: "추천 결과를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return Response.json(result);
}
