import { getActiveSurvey } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    survey: await getActiveSurvey(),
  });
}
