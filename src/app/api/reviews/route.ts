import { z } from "zod";
import { getSchoolById } from "@/lib/schools";
import { createReview, listReviews } from "@/lib/store";
import { requireRequestUser } from "@/lib/supabase";

const reviewSchema = z.object({
  schoolId: z.string(),
  authorName: z.string().min(1).max(30),
  relation: z.enum(["current", "graduate"]),
  enrolledYear: z.number().int().min(1980).max(2030),
  graduatedYear: z.number().int().min(1980).max(2035).optional(),
  ratings: z.object({
    atmosphere: z.number().int().min(1).max(5),
    exams: z.number().int().min(1).max(5),
    meals: z.number().int().min(1).max(5),
    activities: z.number().int().min(1).max(5),
    facilities: z.number().int().min(1).max(5),
  }),
  body: z.string().min(12).max(700),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId") ?? undefined;
  const status = url.searchParams.get("status") === "pending" ? "pending" : "approved";

  return Response.json({
    reviews: listReviews(schoolId, status),
  });
}

export async function POST(request: Request) {
  const user = await requireRequestUser(request);

  if (user instanceof Response) {
    return user;
  }

  try {
    const body = reviewSchema.parse(await request.json());
    const school = getSchoolById(body.schoolId);

    if (!school) {
      return Response.json(
        { message: "학교를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const review = createReview({
      ...body,
      authorId: user.id,
    });

    return Response.json({ review }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        message: "리뷰 입력값을 확인해주세요.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
