import { describe, expect, it } from "vitest";
import { rankSchools } from "@/lib/recommendation";
import type { SurveyAnswer } from "@/lib/types";

describe("rankSchools", () => {
  it("prioritizes nearby schools when distance is important", () => {
    const answer: SurveyAnswer = {
      level: "all",
      lat: 37.4962,
      lng: 127.0622,
      distancePreference: "near",
      priorities: ["academics", "environment", "activities"],
      preferredTags: ["학업"],
    };

    const ranked = rankSchools(answer);

    expect(ranked[0].school.id).toBe("daechi-middle");
  });

  it("lets activity-heavy schools rise when distance is not important", () => {
    const answer: SurveyAnswer = {
      level: "high",
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "not-important",
      priorities: ["activities", "environment", "academics"],
      preferredTags: ["AI", "실습"],
    };

    const ranked = rankSchools(answer);

    expect(ranked[0].school.id).toBe("seoul-robot-high");
  });

  it("filters candidates by school level", () => {
    const answer: SurveyAnswer = {
      level: "middle",
      distancePreference: "balanced",
      priorities: ["environment", "meal", "reviews"],
      preferredTags: ["급식"],
    };

    const ranked = rankSchools(answer);

    expect(ranked.every((item) => item.school.level === "middle")).toBe(true);
  });
});
