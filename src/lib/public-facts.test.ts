import { describe, expect, it } from "vitest";
import {
  formatPublicFactValue,
  getPublicFactItems,
  getPublicFactValue,
} from "@/lib/public-facts";
import type { School } from "@/lib/types";

describe("public school facts", () => {
  it("formats raw API facts and derived school-size indicators", () => {
    const school = makeSchool({
      facts: {
        students: 600,
        classes: 24,
        teachers: 50,
        clubs: 31,
        libraryBooks: 0,
        mealSatisfaction: 0,
        commuteNote: "선택한 위치에서 약 700m",
      },
    });

    expect(getPublicFactValue(school, "studentsPerClass")).toBe(25);
    expect(getPublicFactValue(school, "studentsPerTeacher")).toBe(12);
    expect(formatPublicFactValue(school, "studentsPerClass")).toBe("25.0명");
    expect(getPublicFactItems(school).map((fact) => fact.key)).toEqual([
      "students",
      "studentsPerClass",
      "studentsPerTeacher",
      "classes",
      "teachers",
      "clubs",
    ]);
  });

  it("does not surface seeded placeholder facts as public facts", () => {
    expect(getPublicFactItems(makeSchool({ source: "seed" }))).toEqual([]);
  });
});

function makeSchool(overrides: Partial<School> = {}): School {
  return {
    id: "test-school",
    name: "테스트고등학교",
    level: "high",
    category: "일반고",
    district: "서울",
    address: "서울특별시",
    lat: 37.5665,
    lng: 126.978,
    gender: "coed",
    founded: 2000,
    phone: "",
    website: "",
    tags: [],
    description: "",
    highlights: [],
    metrics: {
      academics: 70,
      activities: 70,
      environment: 70,
      meal: 70,
      reviews: 70,
      stability: 70,
    },
    source: "kakao-neis",
    externalIds: undefined,
    dataUpdatedAt: undefined,
    facts: {
      students: 0,
      classes: 0,
      teachers: 0,
      clubs: 0,
      libraryBooks: 0,
      mealSatisfaction: 0,
      commuteNote: "",
    },
    ...overrides,
  };
}
