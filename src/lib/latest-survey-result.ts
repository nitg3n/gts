import type { StoredSurveyResponse } from "@/lib/types";

export type LatestSurveyResult = {
  responseId: string;
  savedAt: string;
  result?: StoredSurveyResponse;
};

const storageKey = "gts:latest-survey-response:v1";
const historyStorageKey = "gts:survey-result-history:v1";
const maxAgeMs = 1000 * 60 * 60 * 24 * 30;
const maxHistoryItems = 8;

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
  saveSurveyResultToHistory(result);
}

export function clearLatestSurveyResponseId() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(storageKey);
}

export function getSavedSurveyResults() {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(historyStorageKey);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      clearSavedSurveyResults();
      return [];
    }

    const cutoff = Date.now() - maxAgeMs;

    return parsed
      .filter(isStoredSurveyHistoryItem)
      .filter((item) => Date.parse(item.savedAt) >= cutoff)
      .map((item) => item.result);
  } catch {
    clearSavedSurveyResults();
    return [];
  }
}

export function clearSavedSurveyResults() {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.removeItem(historyStorageKey);
}

function saveSurveyResultToHistory(result: StoredSurveyResponse) {
  if (!canUseLocalStorage()) {
    return;
  }

  const savedAt = new Date().toISOString();
  const current = getSavedSurveyResults();
  const next = [
    { responseId: result.id, savedAt, result },
    ...current
      .filter((item) => item.id !== result.id)
      .slice(0, maxHistoryItems - 1)
      .map((item) => ({
        responseId: item.id,
        savedAt: item.createdAt,
        result: item,
      })),
  ];

  try {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(next));
  } catch {
    const compact = next.slice(0, 3);

    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(compact));
    } catch {
      window.localStorage.removeItem(historyStorageKey);
    }
  }
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

function isStoredSurveyHistoryItem(
  value: unknown,
): value is LatestSurveyResult & { result: StoredSurveyResponse } {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LatestSurveyResult>;
  const savedAt = Date.parse(candidate.savedAt ?? "");

  return (
    typeof candidate.responseId === "string" &&
    Number.isFinite(savedAt) &&
    isStoredSurveyResponse(candidate.result)
  );
}
