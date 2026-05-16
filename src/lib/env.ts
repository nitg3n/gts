export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasSupabaseServerConfig() {
  return Boolean(getSupabaseServerConfig());
}

export function getSupabaseServerConfig() {
  const projectUrl =
    process.env.SUPABASE_PROJECT_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!projectUrl || !publishableKey) {
    return undefined;
  }

  return {
    projectUrl,
    publishableKey,
  };
}
