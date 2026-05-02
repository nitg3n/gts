import type { School } from "@/lib/types";

export const publicFactDefinitions = [
  { key: "students", label: "학생 수", shortLabel: "학생", unit: "명" },
  { key: "classes", label: "학급 수", shortLabel: "학급", unit: "학급" },
  { key: "teachers", label: "교원 수", shortLabel: "교원", unit: "명" },
  { key: "clubs", label: "동아리 수", shortLabel: "동아리", unit: "개" },
] as const;

export type PublicFactKey = (typeof publicFactDefinitions)[number]["key"];

export type PublicFactItem = {
  key: PublicFactKey;
  label: string;
  shortLabel: string;
  value: string;
  unit: string;
  rawValue: number;
};

export function getPublicFactItems(school: School): PublicFactItem[] {
  if (school.source !== "kakao-neis") {
    return [];
  }

  return publicFactDefinitions
    .map((definition) => {
      const rawValue = school.facts[definition.key];

      return {
        ...definition,
        rawValue,
        value: `${rawValue.toLocaleString("ko-KR")}${definition.unit}`,
      };
    })
    .filter((item) => Number.isFinite(item.rawValue) && item.rawValue > 0);
}

export function getPublicFactValue(
  school: School,
  key: PublicFactKey,
): number | undefined {
  if (school.source !== "kakao-neis") {
    return undefined;
  }

  const value = school.facts[key];
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function formatPublicFactValue(school: School, key: PublicFactKey) {
  const definition = publicFactDefinitions.find((item) => item.key === key);
  const value = getPublicFactValue(school, key);

  if (!definition || typeof value !== "number") {
    return "-";
  }

  return `${value.toLocaleString("ko-KR")}${definition.unit}`;
}
