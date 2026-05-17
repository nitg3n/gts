import {
  findGraduationOutcomeForSchool,
  loadGraduationOutcomeIndex,
} from "@/lib/graduation-outcomes";
import { getSchoolByRouteId, listReviews } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/schools/[id]">,
) {
  const { id } = await context.params;
  if (id.length > 180) {
    return Response.json({ message: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  const school = await getSchoolByRouteId(id);

  if (!school || school.level !== "high") {
    return Response.json({ message: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({
    school,
    graduationOutcome: findGraduationOutcomeForSchool(
      school,
      loadGraduationOutcomeIndex(),
    ),
    reviews: await listReviews(school.id),
  });
}
