import { z } from "zod";
import { createReview, getCachedSchool, listReviews } from "@/lib/store";

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
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "pending" ||
    statusParam === "approved" ||
    statusParam === "rejected"
      ? statusParam
      : undefined;

  return Response.json({
    reviews: await listReviews(schoolId, status),
  });
}

export async function POST(request: Request) {
  try {
    const body = reviewSchema.parse(await request.json());
    const school = getCachedSchool(body.schoolId);

    if (!school) {
      return Response.json(
        { message: "학교를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const review = await createReview({
      ...body,
      authorId: "public-reviewer",
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
