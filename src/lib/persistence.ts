import "server-only";

import { Pool, type QueryResultRow } from "pg";
import type { PersistenceState } from "@/lib/types";

declare global {
  var __gtsPgPool: Pool | undefined;
  var __gtsSchemaReady: Promise<void> | undefined;
  var __gtsPersistenceWarning: string | undefined;
}

export function hasPersistentDatabase() {
  return Boolean(getPersistentDatabaseUrl());
}

export async function queryPersistentStore<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const pool = getPool();

  if (!pool) {
    return undefined;
  }

  await ensureSchema(pool);
  return pool.query<T>(text, params);
}

function getPool() {
  if (!hasPersistentDatabase()) {
    return undefined;
  }

  if (!globalThis.__gtsPgPool) {
    globalThis.__gtsPgPool = new Pool({
      connectionString: normalizeConnectionString(getPersistentDatabaseUrl()!),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30_000,
      max: 5,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return globalThis.__gtsPgPool;
}

function getPersistentDatabaseUrl() {
  const value =
    process.env.SUPABASE_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DATAASE_URL;

  return value?.trim() || undefined;
}

export function describePersistenceResult(persisted: boolean): PersistenceState {
  const enabled = hasPersistentDatabase();
  const configWarning = getPersistenceConfigWarning();

  if (enabled && persisted) {
    return {
      enabled,
      persisted,
      mode: "database",
      warning: configWarning,
    };
  }

  return {
    enabled,
    persisted: false,
    mode: "memory",
    warning:
      configWarning ??
      (enabled
        ? globalThis.__gtsPersistenceWarning ??
          "서버 데이터베이스 저장에 실패해 현재 서버 메모리에만 임시 저장되었습니다."
        : undefined),
  };
}

function getPersistenceConfigWarning() {
  if (
    !process.env.SUPABASE_DATABASE_URL &&
    !process.env.POSTGRES_URL &&
    process.env.SUPABASE_DATAASE_URL
  ) {
    return "SUPABASE_DATAASE_URL 환경 변수명이 감지되었습니다. 배포 환경에서는 SUPABASE_DATABASE_URL로 수정하는 것이 안전합니다.";
  }

  return undefined;
}

export function rememberPersistenceWarning(warning: string) {
  globalThis.__gtsPersistenceWarning = warning;
}

function ensureSchema(pool: Pool) {
  if (!globalThis.__gtsSchemaReady) {
    globalThis.__gtsSchemaReady = createSchema(pool);
  }

  return globalThis.__gtsSchemaReady.catch((error) => {
    globalThis.__gtsSchemaReady = undefined;
    throw error;
  });
}

async function createSchema(pool: Pool) {
  await pool.query(`
    create table if not exists public.gts_surveys (
      id text primary key,
      payload jsonb not null,
      is_active boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists public.gts_reviews (
      id text primary key,
      school_id text not null,
      status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
      payload jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table public.gts_reviews
      alter column status set default 'approved';
  `);

  await pool.query(`
    create table if not exists public.gts_survey_responses (
      id text primary key,
      answer jsonb not null,
      recommendations jsonb not null,
      source text,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create index if not exists gts_reviews_school_status_idx
      on public.gts_reviews (school_id, status, created_at desc);
  `);

  await pool.query(`
    create index if not exists gts_reviews_status_idx
      on public.gts_reviews (status, created_at desc);
  `);

  await pool.query(`
    create index if not exists gts_surveys_active_idx
      on public.gts_surveys (is_active, updated_at desc);
  `);
}

function normalizeConnectionString(value: string) {
  const trimmed = value.trim();

  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname && parsed.username) {
      return trimmed;
    }
  } catch {
    // Fall through to manual normalization for unescaped passwords.
  }

  const match = trimmed.match(/^([^:]+:\/\/)([^:@/]+):(.+)@([^@]+)$/);

  if (!match) {
    return trimmed;
  }

  const [, protocol, username, password, hostAndPath] = match;

  return `${protocol}${encodeURIComponent(username)}:${encodeURIComponent(
    password,
  )}@${hostAndPath}`;
}
