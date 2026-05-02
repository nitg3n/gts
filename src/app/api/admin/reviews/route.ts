import { listReviews } from "@/lib/store";
import { requireAdminUser } from "@/lib/supabase";

export async function GET(request: Request) {
  const user = await requireAdminUser(request);

  if (user instanceof Response) {
    return user;
  }

  return Response.json({
    reviews: await listReviews(undefined),
  });
}
