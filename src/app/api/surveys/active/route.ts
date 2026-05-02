import { getActiveSurvey } from "@/lib/store";

export async function GET() {
  return Response.json({
    survey: await getActiveSurvey(),
  });
}
