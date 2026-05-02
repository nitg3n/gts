import { getSurveyResult } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ responseId: string }> },
) {
  const { responseId } = await context.params;

  return Response.json(await getSurveyResult(responseId));
}
