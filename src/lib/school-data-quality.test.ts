import { describe, expect, it } from "vitest";
import { hasOfficialSchoolData } from "@/lib/school-data-quality";
import type { School } from "@/lib/types";

describe("hasOfficialSchoolData", () => {
  it("rejects Kakao-only schools without NEIS or SchoolInfo values", () => {
    expect(hasOfficialSchoolData(makeSchool({ source: "kakao" }))).toBe(false);
  });

  it("accepts schools matched with NEIS data", () => {
    expect(
      hasOfficialSchoolData(
        makeSchool({
          source: "kakao-neis",
          externalIds: {
            kakaoPlaceId: "1",
            neisSchoolCode: "123",
            neisOfficeCode: "D10",
          },
        }),
      ),
    ).toBe(true);
  });

  it("accepts schools with SchoolInfo disclosure values", () => {
    expect(
      hasOfficialSchoolData(
        makeSchool({
          source: "kakao-neis",
          facts: {
            students: 560,
            classes: 20,
            teachers: 42,
            clubs: 0,
            libraryBooks: 0,
            mealSatisfaction: 0,
            commuteNote: "",
          },
        }),
      ),
    ).toBe(true);
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
    source: "kakao",
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
