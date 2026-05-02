import { getCachedSchool, listReviews } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const school = getCachedSchool(id);

  if (!school) {
    return Response.json({ message: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({
    school,
    reviews: await listReviews(id, "approved"),
  });
}
