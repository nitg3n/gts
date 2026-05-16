import { describe, expect, it } from "vitest";
import { rankSchools } from "@/lib/recommendation";
import type { School, SurveyAnswer } from "@/lib/types";

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

  it("forces middle-school students into high-school recommendations", () => {
    const answer: SurveyAnswer = {
      level: "middle",
      studentStage: "middle",
      distancePreference: "balanced",
      priorities: ["environment", "meal", "reviews"],
      preferredTags: [],
    };

    const ranked = rankSchools(answer);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((item) => item.school.level === "high")).toBe(true);
  });

  it("forces elementary students into middle-school recommendations", () => {
    const answer: SurveyAnswer = {
      level: "high",
      studentStage: "elementary",
      distancePreference: "balanced",
      priorities: ["environment", "meal", "reviews"],
      preferredTags: [],
    };

    const ranked = rankSchools(answer);

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((item) => item.school.level === "middle")).toBe(true);
  });

  it("lets a farther school win when the survey meaning strongly matches it", () => {
    const answer: SurveyAnswer = {
      level: "high",
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "not-important",
      priorities: ["activities", "academics", "environment"],
      preferredTags: ["실습", "진로", "프로젝트"],
      categoryPreference: "특성화고",
      rawResponses: {
        careerDirection: "practical",
        activityPreference: ["project", "career"],
        schoolLife: 5,
        commuteImportance: 1,
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "near-general",
        name: "가까운일반고등학교",
        category: "일반고",
        lat: 37.5666,
        lng: 126.9781,
        tags: ["진학", "통학"],
      }),
      makeSchool({
        id: "far-practical",
        name: "멀지만맞는진로고등학교",
        category: "특성화고",
        lat: 37.486,
        lng: 127.096,
        tags: ["실습", "진로", "프로젝트", "취업"],
        highlights: ["전공 실습", "프로젝트 포트폴리오", "진로 연결"],
      }),
    ]);

    expect(ranked[0].school.id).toBe("far-practical");
    expect(ranked[0].reasons.join(" ")).toMatch(/실습|프로젝트|진로/);
  });

  it("keeps commute-heavy answers grounded in nearby schools", () => {
    const answer: SurveyAnswer = {
      level: "high",
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "near",
      priorities: ["environment", "activities", "academics"],
      preferredTags: ["통학", "생활지도"],
      rawResponses: {
        transitionConcern: ["commute", "friends"],
        commuteImportance: 5,
        commuteTime: "very-near",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "near-care",
        name: "가까운생활중심고등학교",
        category: "일반고",
        lat: 37.5666,
        lng: 126.9781,
        tags: ["통학", "생활지도", "상담"],
        highlights: ["안정적인 생활지도", "교통 접근"],
      }),
      makeSchool({
        id: "far-care",
        name: "먼생활중심고등학교",
        category: "일반고",
        lat: 37.486,
        lng: 127.096,
        tags: ["생활지도", "상담", "동아리"],
        highlights: ["안정적인 생활지도", "상담 프로그램"],
      }),
    ]);

    expect(ranked[0].school.id).toBe("near-care");
  });

  it("keeps strong far matches visible as expanded candidates", () => {
    const answer: SurveyAnswer = {
      level: "high",
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "near",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["과학", "연구", "프로젝트"],
      categoryPreference: "과학고",
      rawResponses: {
        careerDirection: "science",
        activityPreference: ["project"],
        commuteImportance: 5,
        commuteTime: "near",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "near-general",
        name: "가까운일반고등학교",
        category: "일반고",
        lat: 37.5666,
        lng: 126.9781,
        tags: ["통학", "진학"],
        highlights: ["가까운 통학"],
      }),
      makeSchool({
        id: "far-science",
        name: "멀지만맞는과학고등학교",
        category: "과학고",
        lat: 37.486,
        lng: 127.096,
        tags: ["과학", "연구", "프로젝트"],
        highlights: ["심화 과학", "연구 활동", "프로젝트 발표"],
        metrics: {
          academics: 94,
          activities: 91,
          environment: 82,
          meal: 70,
          reviews: 80,
          stability: 85,
        },
      }),
    ]);
    const farScience = ranked.find((item) => item.school.id === "far-science");

    expect(ranked[0].school.id).toBe("near-general");
    expect(farScience?.matchType).toBe("expanded");
    expect(farScience?.reasons.join(" ")).toMatch(/통학권|과학|프로젝트|연구/);
  });
});

function makeSchool(overrides: Partial<School> & Pick<School, "id" | "name">): School {
  return {
    id: overrides.id,
    name: overrides.name,
    level: overrides.level ?? "high",
    category: overrides.category ?? "일반고",
    district: overrides.district ?? "서울",
    address: overrides.address ?? "서울특별시",
    lat: overrides.lat ?? 37.5665,
    lng: overrides.lng ?? 126.978,
    gender: overrides.gender ?? "coed",
    founded: overrides.founded ?? 2000,
    phone: overrides.phone ?? "",
    website: overrides.website ?? "",
    tags: overrides.tags ?? [],
    description: overrides.description ?? "학교 생활 조건을 비교할 수 있는 학교입니다.",
    highlights: overrides.highlights ?? [],
    metrics: overrides.metrics ?? {
      academics: 72,
      activities: 72,
      environment: 72,
      meal: 70,
      reviews: 70,
      stability: 72,
    },
    source: overrides.source,
    externalIds: overrides.externalIds,
    dataUpdatedAt: overrides.dataUpdatedAt,
    facts: overrides.facts ?? {
      students: 600,
      classes: 24,
      teachers: 55,
      clubs: 28,
      libraryBooks: 16000,
      mealSatisfaction: 0,
      commuteNote: "통학 접근",
    },
  };
}
