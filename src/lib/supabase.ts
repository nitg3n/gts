import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServerConfig,
  hasSupabaseServerConfig,
} from "@/lib/env";

const browserSupabaseProjectUrl =
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "";
const browserSupabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export function hasBrowserSupabaseConfig() {
  return Boolean(browserSupabaseProjectUrl && browserSupabasePublishableKey);
}

export function createBrowserSupabaseClient() {
  if (!hasBrowserSupabaseConfig()) {
    return undefined;
  }

  return createClient(
    browserSupabaseProjectUrl,
    browserSupabasePublishableKey,
  );
}

export function createServerSupabaseClient() {
  if (!hasSupabaseServerConfig()) {
    return undefined;
  }
  const config = getSupabaseServerConfig();

  if (!config) {
    return undefined;
  }

  return createClient(
    config.projectUrl,
    config.publishableKey,
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

function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
