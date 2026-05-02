import { createClient } from "@supabase/supabase-js";
import { getAdminEmails, hasSupabaseServerConfig } from "@/lib/env";

export function createBrowserSupabaseClient(config: {
  supabaseProjectUrl: string;
  supabasePublishableKey: string;
}) {
  if (!config.supabaseProjectUrl || !config.supabasePublishableKey) {
    return undefined;
  }

  return createClient(
    config.supabaseProjectUrl,
    config.supabasePublishableKey,
  );
}

export function createServerSupabaseClient() {
  if (!hasSupabaseServerConfig()) {
    return undefined;
  }

  return createClient(
    process.env.SUPABASE_PROJECT_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export async function getRequestUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return undefined;
  }

  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return undefined;
  }

  return data.user;
}

export async function requireRequestUser(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    if (isLocalDevelopmentRequest(request)) {
      return {
        id: "local-dev-user",
        email: "local-dev@gotoschool.local",
      };
    }

    return Response.json(
      { message: "로그인이 필요합니다." },
      { status: 401 },
    );
  }

  return user;
}

export async function requireAdminUser(request: Request) {
  const user = await getRequestUser(request);
  const adminEmails = getAdminEmails();
  const email = user?.email?.toLowerCase();

  if (!user || !email || !adminEmails.includes(email)) {
    if (isLocalDevelopmentRequest(request)) {
      return {
        id: "local-admin",
        email: "local-admin@gotoschool.local",
      };
    }

    return Response.json(
      { message: "관리자 권한이 필요합니다." },
      { status: 403 },
    );
  }

  return user;
}

function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
