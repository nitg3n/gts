import type { PublicRuntimeConfig } from "@/lib/types";

export function getPublicRuntimeConfig(): PublicRuntimeConfig {
  const kakaoJsKey = process.env.KAKAO_JS_KEY ?? "";
  const supabaseProjectUrl = process.env.SUPABASE_PROJECT_URL ?? "";
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

  return {
    kakaoJsKey,
    supabaseProjectUrl,
    supabasePublishableKey,
    hasKakaoMap: Boolean(kakaoJsKey),
    hasSupabase: Boolean(supabaseProjectUrl && supabasePublishableKey),
  };
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasSupabaseServerConfig() {
  return Boolean(
    process.env.SUPABASE_PROJECT_URL && process.env.SUPABASE_PUBLISHABLE_KEY,
  );
}
