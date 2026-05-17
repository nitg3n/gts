import { describe, expect, it } from "vitest";
import { maxCompareSchools, mergeCompareSchools } from "@/lib/compare-list";
import type { School } from "@/lib/types";

describe("mergeCompareSchools", () => {
  it("appends new schools without replacing the current comparison list", () => {
    const merged = mergeCompareSchools(
      [makeSchool("a"), makeSchool("b")],
      [makeSchool("c")],
    );

    expect(merged.map((school) => school.id)).toEqual(["a", "b", "c"]);
  });

  it("updates duplicates and keeps the newest additions inside the limit", () => {
    const current = Array.from({ length: maxCompareSchools }, (_, index) =>
      makeSchool(`school-${index + 1}`),
    );
    const merged = mergeCompareSchools(current, [
      makeSchool("school-2", "업데이트된 학교"),
      makeSchool("new-school"),
    ]);

    expect(merged).toHaveLength(maxCompareSchools);
    expect(merged.map((school) => school.id)).not.toContain("school-1");
    expect(merged.map((school) => school.id)).toContain("new-school");
    expect(merged.find((school) => school.id === "school-2")?.name).toBe(
      "업데이트된 학교",
    );
  });

  it("filters out middle schools from the comparison list", () => {
    const merged = mergeCompareSchools(
      [makeSchool("high-a")],
      [makeSchool("middle-a", "middle-a", "middle"), makeSchool("high-b")],
    );

    expect(merged.map((school) => school.id)).toEqual(["high-a", "high-b"]);
  });
});

function makeSchool(id: string, name = id, level: School["level"] = "high"): School {
  return {
    id,
    name,
    level,
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
    source: "seed",
    facts: {
      students: 0,
      classes: 0,
      teachers: 0,
      clubs: 0,
      libraryBooks: 0,
      mealSatisfaction: 0,
      commuteNote: "",
    },
  };
}
