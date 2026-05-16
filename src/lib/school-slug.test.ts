import { describe, expect, it } from "vitest";
import {
  createSchoolSlug,
  ensureUniqueSchoolSlugs,
  schoolNameFromSlug,
} from "@/lib/school-slug";

describe("createSchoolSlug", () => {
  it("creates a readable school name and district slug", () => {
    expect(
      createSchoolSlug({
        name: "대전동화중학교",
        district: "대전 유성구",
      }),
    ).toBe("대전동화중학교-대전-유성구");
  });

  it("does not expose upstream provider names in generated ids", () => {
    expect(
      createSchoolSlug({
        name: "대전관평중학교",
        district: "대전 유성구",
      }),
    ).not.toMatch(/kakao|neis/i);
  });
});

describe("ensureUniqueSchoolSlugs", () => {
  it("adds a short numeric suffix only when slugs collide", () => {
    const schools = ensureUniqueSchoolSlugs([
      { id: "중앙중학교-서울-종로구" },
      { id: "중앙중학교-서울-종로구" },
    ]);

    expect(schools.map((school) => school.id)).toEqual([
      "중앙중학교-서울-종로구",
      "중앙중학교-서울-종로구-2",
    ]);
  });
});

describe("schoolNameFromSlug", () => {
  it("extracts the school name from a readable route slug", () => {
    expect(schoolNameFromSlug("대전동화중학교-대전-유성구")).toBe(
      "대전동화중학교",
    );
  });
});
