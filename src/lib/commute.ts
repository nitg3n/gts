import type { SurveyAnswer } from "@/lib/types";

type CommuteMethod = "walk" | "bike" | "transit" | "car" | "any";
type CommuteTime = "very-near" | "near" | "balanced" | "far-ok" | "any";

const commuteTimeMinutes: Record<Exclude<CommuteTime, "any">, number> = {
  "very-near": 10,
  near: 20,
  balanced: 30,
  "far-ok": 50,
};

const effectiveStraightLineKmh: Record<CommuteMethod, number> = {
  walk: 4,
  bike: 14,
  transit: 36,
  car: 48,
  any: 32,
};

export function getCommuteDistanceLimitKm(answer: SurveyAnswer) {
  if (answer.distancePreference === "not-important") {
    return undefined;
  }

  const commuteTime = getCommuteTime(answer);

  if (!commuteTime || commuteTime === "any") {
    return undefined;
  }

  const minutes = commuteTimeMinutes[commuteTime];
  const method = getCommuteMethod(answer);
  const km = (minutes / 60) * effectiveStraightLineKmh[method];

  return Math.max(1, Math.round(km * 10) / 10);
}

export function hasCommuteDistanceLimit(answer: SurveyAnswer) {
  return typeof getCommuteDistanceLimitKm(answer) === "number";
}

function getCommuteTime(answer: SurveyAnswer): CommuteTime | undefined {
  const value = answer.rawResponses?.commuteTime;

  return isCommuteTime(value) ? value : undefined;
}

function getCommuteMethod(answer: SurveyAnswer): CommuteMethod {
  const value = answer.rawResponses?.commuteMethod;

  return isCommuteMethod(value) ? value : "any";
}

function isCommuteTime(value: unknown): value is CommuteTime {
  return (
    value === "very-near" ||
    value === "near" ||
    value === "balanced" ||
    value === "far-ok" ||
    value === "any"
  );
}

function isCommuteMethod(value: unknown): value is CommuteMethod {
  return (
    value === "walk" ||
    value === "bike" ||
    value === "transit" ||
    value === "car" ||
    value === "any"
  );
}
