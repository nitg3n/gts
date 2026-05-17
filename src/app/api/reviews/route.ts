import { z } from "zod";
import { createReview, getCachedSchool, listReviews } from "@/lib/store";

export const runtime = "nodejs";

const reviewSchema = z.object({
  schoolId: z.string().trim().min(1).max(180),
  authorName: z.string().trim().min(1).max(30),
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
  body: z.string().trim().min(12).max(700),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId")?.trim() || undefined;

  if (schoolId && schoolId.length > 180) {
    return Response.json(
      { message: "학교 식별자를 확인해주세요." },
      { status: 400 },
    );
  }

  return Response.json({
    reviews: await listReviews(schoolId, "approved"),
  });
}

export async function POST(request: Request) {
  try {
    if (isRequestBodyTooLarge(request, 16_000)) {
      return Response.json(
        { message: "리뷰 입력이 너무 깁니다." },
        { status: 413 },
      );
    }

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
      errorResponse("리뷰 입력값을 확인해주세요.", error),
      { status: 400 },
    );
  }
}

function isRequestBodyTooLarge(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) {
    return false;
  }

  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > maxBytes;
}

function errorResponse(message: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    return {
      message,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  return { message };
}
