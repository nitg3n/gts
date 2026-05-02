import { z } from "zod";
import { updateReviewStatus } from "@/lib/store";
import { requireAdminUser } from "@/lib/supabase";

const statusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminUser(request);

  if (user instanceof Response) {
    return user;
  }

  const { id } = await context.params;
  const { status } = statusSchema.parse(await request.json());
  const review = await updateReviewStatus(id, status);

  if (!review) {
    return Response.json({ message: "리뷰를 찾을 수 없습니다." }, { status: 404 });
  }

  return Response.json({ review });
}
