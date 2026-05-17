import {
  findGraduationOutcomeForSchool,
  loadGraduationOutcomeIndex,
} from "@/lib/graduation-outcomes";
import { getSchoolByRouteId, listReviews } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
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
