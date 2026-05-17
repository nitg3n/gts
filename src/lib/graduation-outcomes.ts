import fs from "node:fs";
import path from "node:path";
import type { School } from "@/lib/types";

type GenderCount = {
  total?: number;
  male?: number;
  female?: number;
};

type GraduationOutcomeRow = {
  year: number;
  graduates?: GenderCount;
  advancement?: GenderCount & {
    rate_percent?: number;
  };
  employment?: GenderCount;
  military?: GenderCount;
  other?: GenderCount;
  higher_education_breakdown?: {
    domestic_junior_college?: GenderCount;
    domestic_university?: GenderCount;
    overseas_junior_college?: GenderCount;
    overseas_university?: GenderCount;
    total?: GenderCount;
  };
};

export type GraduationOutcomeRecord = {
  sido: string;
  district: string;
  region: string;
  school_name: string;
  graduation_outcomes: GraduationOutcomeRow[];
};

export type GraduationOutcomeSummary = {
  schoolName: string;
  region: string;
  years: number[];
  latestYear: number;
  graduatesTotal: number;
  advancementRate: number;
  fourYearRate: number;
  juniorCollegeRate: number;
  employmentRate: number;
  overseasRate: number;
  otherRate: number;
  outcomeStability: number;
  confidence: number;
};

export type GraduationOutcomeIndex = {
  byName: Map<string, GraduationOutcomeSummary[]>;
  all: GraduationOutcomeSummary[];
};

let cachedIndex: GraduationOutcomeIndex | undefined;

export function loadGraduationOutcomeIndex() {
  if (cachedIndex) {
    return cachedIndex;
  }

  const filePath = path.join(
    process.cwd(),
    "outputs",
    "kess_high_school_graduation_outcomes_2023_2025.json",
  );

  if (!fs.existsSync(filePath)) {
    cachedIndex = { byName: new Map(), all: [] };
    return cachedIndex;
  }

  const records = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as GraduationOutcomeRecord[];

  cachedIndex = createGraduationOutcomeIndex(records);
  return cachedIndex;
}

export function createGraduationOutcomeIndex(
  records: GraduationOutcomeRecord[],
): GraduationOutcomeIndex {
  const byName = new Map<string, GraduationOutcomeSummary[]>();
  const all: GraduationOutcomeSummary[] = [];

  records.forEach((record) => {
    const summary = summarizeGraduationOutcome(record);

    if (!summary) {
      return;
    }

    const key = normalizeSchoolName(record.school_name);
    const summaries = byName.get(key) ?? [];
    summaries.push(summary);
    byName.set(key, summaries);
    all.push(summary);
  });

  return { byName, all };
}

export function findGraduationOutcomeForSchool(
  school: School,
  index: GraduationOutcomeIndex,
) {
  const matches = index.byName.get(normalizeSchoolName(school.name)) ?? [];

  if (matches.length <= 1) {
    return matches[0];
  }

  const schoolRegionText = normalizeRegionText(
    `${school.district} ${school.address}`,
  );

  return (
    matches.find((match) =>
      normalizeRegionText(match.region)
        .split(" ")
        .filter(Boolean)
        .every((part) => schoolRegionText.includes(part)),
    ) ?? matches[0]
  );
}

function summarizeGraduationOutcome(
  record: GraduationOutcomeRecord,
): GraduationOutcomeSummary | undefined {
  const outcomes = [...(record.graduation_outcomes ?? [])]
    .filter((outcome) => Number.isFinite(outcome.year))
    .sort((a, b) => a.year - b.year);

  if (!outcomes.length) {
    return undefined;
  }

  const totals = outcomes.reduce(
    (acc, outcome) => {
      const graduates = numberValue(outcome.graduates?.total);
      const domesticUniversity = numberValue(
        outcome.higher_education_breakdown?.domestic_university?.total,
      );
      const overseasUniversity = numberValue(
        outcome.higher_education_breakdown?.overseas_university?.total,
      );
      const domesticJunior = numberValue(
        outcome.higher_education_breakdown?.domestic_junior_college?.total,
      );
      const overseasJunior = numberValue(
        outcome.higher_education_breakdown?.overseas_junior_college?.total,
      );

      acc.graduates += graduates;
      acc.advancement += numberValue(outcome.advancement?.total);
      acc.fourYear += domesticUniversity + overseasUniversity;
      acc.juniorCollege += domesticJunior + overseasJunior;
      acc.employment += numberValue(outcome.employment?.total);
      acc.overseas += overseasUniversity + overseasJunior;
      acc.other += numberValue(outcome.other?.total);

      if (graduates > 0) {
        acc.advancementRates.push(numberValue(outcome.advancement?.total) / graduates);
      }

      return acc;
    },
    {
      graduates: 0,
      advancement: 0,
      fourYear: 0,
      juniorCollege: 0,
      employment: 0,
      overseas: 0,
      other: 0,
      advancementRates: [] as number[],
    },
  );

  const denominator = totals.graduates || 1;
  const confidence = Math.min(
    1,
    (Math.log10(totals.graduates + 1) / 2) * Math.min(1, outcomes.length / 3),
  );

  return {
    schoolName: record.school_name,
    region: record.region,
    years: outcomes.map((outcome) => outcome.year),
    latestYear: outcomes.at(-1)?.year ?? outcomes[0].year,
    graduatesTotal: totals.graduates,
    advancementRate: percent(totals.advancement, denominator),
    fourYearRate: percent(totals.fourYear, denominator),
    juniorCollegeRate: percent(totals.juniorCollege, denominator),
    employmentRate: percent(totals.employment, denominator),
    overseasRate: percent(totals.overseas, denominator),
    otherRate: percent(totals.other, denominator),
    outcomeStability: scoreStability(totals.advancementRates),
    confidence,
  };
}

function scoreStability(rates: number[]) {
  if (rates.length < 2) {
    return 66;
  }

  const mean = rates.reduce((sum, value) => sum + value, 0) / rates.length;
  const variance =
    rates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rates.length;

  return clamp(100 - Math.sqrt(variance) * 160);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeSchoolName(value: string) {
  return value.replace(/\([^)]*\)/g, "").replace(/\s+/g, "");
}

function normalizeRegionText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}
