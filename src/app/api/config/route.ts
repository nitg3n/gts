import { getPublicRuntimeConfig } from "@/lib/env";

export async function GET() {
  return Response.json(getPublicRuntimeConfig());
}
