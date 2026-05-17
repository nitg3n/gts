import type { StoredSurveyResponse } from "@/lib/types";

export type LatestSurveyResult = {
  responseId: string;
  savedAt: string;
  result?: StoredSurveyResponse;
};

const storageKey = "gts:latest-survey-response:v1";
const maxAgeMs = 1000 * 60 * 60 * 24 * 30;

export function getLatestSurveyResponseId() {
  return getLatestSurveyRecord()?.responseId;
}

export function getLatestSurveyResult() {
  const record = getLatestSurveyRecord();

  if (!record?.result || !isStoredSurveyResponse(record.result)) {
    return undefined;
  }

  return record.result;
}

function getLatestSurveyRecord() {
  if (!canUseLocalStorage()) {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as LatestSurveyResult;
    const savedAt = Date.parse(parsed.savedAt);

    if (
      typeof parsed.responseId !== "string" ||
      parsed.responseId.length === 0 ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > maxAgeMs
    ) {
      clearLatestSurveyResponseId();
      return undefined;
    }

    return parsed;
  } catch {
    clearLatestSurveyResponseId();
    return undefined;
  }
}

export function saveLatestSurveyResponseId(
  responseId: string,
  result?: StoredSurveyResponse,
) {
  if (!canUseLocalStorage()) {
    return;
  }

  const payload: LatestSurveyResult = {
    responseId,
    savedAt: new Date().toISOString(),
    result: result?.id === responseId ? result : undefined,
  };

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          responseId,
          savedAt: payload.savedAt,
        } satisfies LatestSurveyResult),
      );
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }
}

export function saveLatestSurveyResult(result: StoredSurveyResponse) {
  saveLatestSurveyResponseId(result.id, result);
}

export function clearLatestSurveyResponseId() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isStoredSurveyResponse(value: unknown): value is StoredSurveyResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredSurveyResponse>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    Boolean(candidate.answer) &&
    Array.isArray(candidate.recommendations)
  );
}
