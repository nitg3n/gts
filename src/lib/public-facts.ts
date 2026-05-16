import type { School } from "@/lib/types";

export type PublicFactKey =
  | "students"
  | "studentsPerClass"
  | "studentsPerTeacher"
  | "classes"
  | "teachers"
  | "clubs"
  | "libraryBooks";

type PublicFactDefinition = {
  key: PublicFactKey;
  label: string;
  shortLabel: string;
  unit: string;
  precision?: number;
};

export const publicFactDefinitions = [
  { key: "students", label: "학생 수", shortLabel: "학생", unit: "명" },
  {
    key: "studentsPerClass",
    label: "학급당 학생 수",
    shortLabel: "학급당",
    unit: "명",
    precision: 1,
  },
  {
    key: "studentsPerTeacher",
    label: "교원 1인당 학생 수",
    shortLabel: "교원당",
    unit: "명",
    precision: 1,
  },
  { key: "classes", label: "학급 수", shortLabel: "학급", unit: "학급" },
  { key: "teachers", label: "교원 수", shortLabel: "교원", unit: "명" },
  { key: "clubs", label: "동아리 수", shortLabel: "동아리", unit: "개" },
  {
    key: "libraryBooks",
    label: "도서관 장서 수",
    shortLabel: "장서",
    unit: "권",
  },
] satisfies PublicFactDefinition[];

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

  return publicFactDefinitions.flatMap((definition): PublicFactItem[] => {
    const rawValue = getPublicFactValue(school, definition.key);

    if (typeof rawValue !== "number") {
      return [];
    }

    return [
      {
        key: definition.key,
        label: definition.label,
        shortLabel: definition.shortLabel,
        unit: definition.unit,
        rawValue,
        value: formatFactValue(rawValue, definition),
      },
    ];
  });
}

export function getPublicFactValue(
  school: School,
  key: PublicFactKey,
): number | undefined {
  if (school.source !== "kakao-neis") {
    return undefined;
  }

  const value = getRawPublicFactValue(school, key);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function formatPublicFactValue(school: School, key: PublicFactKey) {
  const definition = publicFactDefinitions.find((item) => item.key === key);
  const value = getPublicFactValue(school, key);

  if (!definition || typeof value !== "number") {
    return "-";
  }

  return formatFactValue(value, definition);
}

function getRawPublicFactValue(school: School, key: PublicFactKey) {
  if (key === "studentsPerClass") {
    return ratio(school.facts.students, school.facts.classes);
  }

  if (key === "studentsPerTeacher") {
    return ratio(school.facts.students, school.facts.teachers);
  }

  return school.facts[key];
}

function formatFactValue(value: number, definition: PublicFactDefinition) {
  const formatted = value.toLocaleString("ko-KR", {
    maximumFractionDigits: definition.precision ?? 0,
    minimumFractionDigits: definition.precision ?? 0,
  });

  return `${formatted}${definition.unit}`;
}

function ratio(numerator: number, denominator: number) {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }

  return numerator / denominator;
}
