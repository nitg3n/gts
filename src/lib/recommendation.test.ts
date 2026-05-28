import { describe, expect, it } from "vitest";
import { rankSchools } from "@/lib/recommendation";
import { createGraduationOutcomeIndex } from "@/lib/graduation-outcomes";
import type { School, SchoolReview, SurveyAnswer } from "@/lib/types";

describe("rankSchools", () => {
  it("prioritizes nearby schools when distance is important", () => {
    const answer: SurveyAnswer = {
      lat: 37.4962,
      lng: 127.0622,
      distancePreference: "near",
      priorities: ["academics", "environment", "activities"],
      preferredTags: ["학업"],
    };

    const ranked = rankSchools(answer);

    expect(ranked[0].school.id).toBe("kyunggi-high");
    expect(ranked.every((item) => item.school.level === "high")).toBe(true);
  });

  it("lets activity-heavy schools rise when distance is not important", () => {
    const answer: SurveyAnswer = {
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "not-important",
      priorities: ["activities", "environment", "academics"],
      preferredTags: ["AI", "실습"],
    };

    const ranked = rankSchools(answer);

    expect(ranked[0].school.id).toBe("seoul-robot-high");
  });

  it("removes middle schools from candidate ranking", () => {
    const answer: SurveyAnswer = {
      distancePreference: "balanced",
      priorities: ["environment", "meal", "reviews"],
      preferredTags: ["급식"],
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "middle-school",
        name: "후보중학교",
        level: "middle",
      }),
      makeSchool({
        id: "high-school",
        name: "후보고등학교",
      }),
    ]);

    expect(ranked.map((item) => item.school.id)).toEqual(["high-school"]);
    expect(ranked.every((item) => item.school.level === "high")).toBe(true);
  });

  it("uses coed preference as a hard candidate constraint", () => {
    const answer: SurveyAnswer = {
      distancePreference: "balanced",
      priorities: ["environment", "activities", "academics"],
      preferredTags: [],
      genderPreference: "coed",
      rawResponses: {
        genderPreference: "coed-separated",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "boys-high",
        name: "남자고등학교",
        gender: "boys",
      }),
      makeSchool({
        id: "coed-high",
        name: "공학고등학교",
        gender: "coed",
      }),
    ]);

    expect(ranked.map((item) => item.school.id)).toEqual(["coed-high"]);
  });

  it("uses explicit high-school category preference as a hard candidate constraint", () => {
    const answer: SurveyAnswer = {
      distancePreference: "balanced",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["과학"],
      categoryPreference: "과학고",
      rawResponses: {
        categoryPreference: "과학고",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "general-high",
        name: "일반고등학교",
        category: "일반고",
        tags: ["진학"],
      }),
      makeSchool({
        id: "science-high",
        name: "과학고등학교",
        category: "과학고",
        tags: ["과학", "연구"],
      }),
    ]);

    expect(ranked.map((item) => item.school.id)).toEqual(["science-high"]);
  });

  it.each([
    ["일반고", "일반고", "과학고"],
    ["특성화고", "특성화고", "일반고"],
    ["자율형 사립고", "자율형 사립고", "일반고"],
    ["자율형사립고", "자율고", "일반고"],
    ["영재학교", "영재학교", "과학고"],
    ["외국어고", "외국어고", "일반고"],
    ["과학고", "과학고", "일반고"],
    ["예술고", "예술고", "체육고"],
    ["체육고", "체육고", "예술고"],
    ["마이스터고", "마이스터고", "특성화고"],
  ])(
    "treats explicit %s preference as a hard school-type filter",
    (preference, matchingCategory, excludedCategory) => {
      const answer: SurveyAnswer = {
        distancePreference: "balanced",
        priorities: ["academics", "activities", "environment"],
        preferredTags: [],
        categoryPreference: preference,
        rawResponses: {
          categoryPreference: preference,
        },
      };

      const ranked = rankSchools(answer, [
        makeSchool({
          id: "excluded-high",
          name: "제외고등학교",
          category: excludedCategory,
        }),
        makeSchool({
          id: "matching-high",
          name: "일치고등학교",
          category: matchingCategory,
        }),
      ]);

      expect(ranked.map((item) => item.school.id)).toEqual(["matching-high"]);
    },
  );

  it("does not hard-filter an inferred category from career direction alone", () => {
    const answer: SurveyAnswer = {
      distancePreference: "balanced",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["과학", "연구"],
      categoryPreference: "과학고",
      rawResponses: {
        categoryPreference: "any",
        careerDirection: "science",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "general-high",
        name: "탐구일반고등학교",
        category: "일반고",
        tags: ["과학", "연구"],
      }),
      makeSchool({
        id: "science-high",
        name: "과학고등학교",
        category: "과학고",
        tags: ["과학", "연구"],
      }),
    ]);

    expect(ranked.map((item) => item.school.id).sort()).toEqual([
      "general-high",
      "science-high",
    ]);
  });

  it("uses KESS special purpose type as hard category evidence", () => {
    const answer: SurveyAnswer = {
      distancePreference: "not-important",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["과학"],
      categoryPreference: "과학고",
      rawResponses: {
        categoryPreference: "과학고",
        careerDirection: "science",
      },
    };
    const graduationOutcomes = createGraduationOutcomeIndex([
      makeOutcomeRecord("새빛고등학교", 100, 95, 90, 2, 0, "과학고"),
      makeOutcomeRecord("일반고등학교", 100, 98, 94, 1, 0),
    ]);

    const ranked = rankSchools(
      answer,
      [
        makeSchool({
          id: "typed-science",
          name: "새빛고등학교",
          category: "일반고",
          tags: ["과학", "연구"],
        }),
        makeSchool({
          id: "plain-general",
          name: "일반고등학교",
          category: "일반고",
          tags: ["과학", "연구"],
        }),
      ],
      { graduationOutcomes },
    );

    expect(ranked.map((item) => item.school.id)).toEqual(["typed-science"]);
    expect(ranked[0].graduationOutcome?.specialPurposeType).toBe("과학고");
    expect(
      ranked[0].evidence?.some(
        (item) => item.source === "kess" && item.value === "과학고",
      ),
    ).toBe(true);
  });

  it("uses student gender as eligibility before ranking single-gender schools", () => {
    const answer: SurveyAnswer = {
      studentGender: "female",
      distancePreference: "balanced",
      priorities: ["environment", "activities", "academics"],
      preferredTags: [],
      genderPreference: "single-gender",
      rawResponses: {
        studentGender: "female",
        genderPreference: "single-gender",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "boys-high",
        name: "남자고등학교",
        gender: "boys",
      }),
      makeSchool({
        id: "girls-high",
        name: "여자고등학교",
        gender: "girls",
      }),
      makeSchool({
        id: "coed-high",
        name: "공학고등학교",
        gender: "coed",
      }),
    ]);

    expect(ranked.map((item) => item.school.id)).toEqual(["girls-high"]);
  });

  it("does not recommend girls schools to male students even without gender-type preference", () => {
    const answer: SurveyAnswer = {
      studentGender: "male",
      distancePreference: "balanced",
      priorities: ["environment", "activities", "academics"],
      preferredTags: [],
      genderPreference: "any",
      rawResponses: {
        studentGender: "male",
        genderPreference: "any",
      },
    };

    const ranked = rankSchools(answer, [
      makeSchool({
        id: "girls-high",
        name: "여자고등학교",
        gender: "girls",
      }),
      makeSchool({
        id: "boys-high",
        name: "남자고등학교",
        gender: "boys",
      }),
      makeSchool({
        id: "coed-high",
        name: "공학고등학교",
        gender: "coed",
      }),
    ]);

    expect(ranked.map((item) => item.school.id)).not.toContain("girls-high");
    expect(ranked.map((item) => item.school.id).sort()).toEqual([
      "boys-high",
      "coed-high",
    ]);
  });

  it("lets a farther school win when the survey meaning strongly matches it", () => {
    const answer: SurveyAnswer = {
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

  it("uses graduation outcomes as official evidence for college-focused answers", () => {
    const answer: SurveyAnswer = {
      lat: 37.5665,
      lng: 126.978,
      distancePreference: "not-important",
      priorities: ["academics", "environment", "activities"],
      preferredTags: ["진학"],
      rawResponses: {
        careerDirection: "college",
        schoolReputation: 5,
      },
    };
    const graduationOutcomes = createGraduationOutcomeIndex([
      makeOutcomeRecord("진학강한고등학교", 120, 108, 98, 5, 1),
      makeOutcomeRecord("진학약한고등학교", 120, 60, 30, 18, 14),
    ]);

    const ranked = rankSchools(
      answer,
      [
        makeSchool({
          id: "weak-college",
          name: "진학약한고등학교",
          category: "일반고",
          tags: ["진학"],
        }),
        makeSchool({
          id: "strong-college",
          name: "진학강한고등학교",
          category: "일반고",
          tags: ["진학"],
        }),
      ],
      { graduationOutcomes },
    );

    expect(ranked[0].school.id).toBe("strong-college");
    expect(ranked[0].evidence?.some((item) => item.source === "kess")).toBe(true);
    expect(
      ranked[0].evidence?.some(
        (item) => item.source === "kess" && item.dimension === "college_outcome",
      ),
    ).toBe(true);
    expect(ranked[0].dimensionScores?.college_outcome).toBeGreaterThan(
      ranked[1].dimensionScores?.college_outcome ?? 0,
    );
    expect(ranked[0].reasons.join(" ")).toContain("4년제 진학률");
  });

  it("connects practical-career answers to employment and junior-college outcomes", () => {
    const answer: SurveyAnswer = {
      distancePreference: "not-important",
      priorities: ["activities", "academics", "environment"],
      preferredTags: ["실습", "취업"],
      rawResponses: {
        careerDirection: "practical",
        activityPreference: ["career", "project"],
        learningSupportNeed: 4,
      },
    };
    const graduationOutcomes = createGraduationOutcomeIndex([
      makeOutcomeRecord("취업성과강한고등학교", 100, 42, 8, 22, 50),
      makeOutcomeRecord("취업성과약한고등학교", 100, 80, 68, 7, 2),
    ]);

    const ranked = rankSchools(
      answer,
      [
        makeSchool({
          id: "weak-career",
          name: "취업성과약한고등학교",
          category: "특성화고",
          tags: ["실습", "취업", "진로"],
        }),
        makeSchool({
          id: "strong-career",
          name: "취업성과강한고등학교",
          category: "특성화고",
          tags: ["실습", "취업", "진로"],
        }),
      ],
      { graduationOutcomes },
    );

    expect(ranked[0].school.id).toBe("strong-career");
    expect(
      ranked[0].evidence?.some(
        (item) => item.source === "kess" && item.dimension === "career_outcome",
      ),
    ).toBe(true);
    expect(ranked[0].dimensionScores?.career_outcome).toBeGreaterThan(
      ranked[1].dimensionScores?.career_outcome ?? 0,
    );
  });

  it("uses approved reviews as experience evidence without replacing official data", () => {
    const answer: SurveyAnswer = {
      distancePreference: "balanced",
      priorities: ["environment", "reviews", "activities"],
      preferredTags: ["상담", "생활지도"],
      rawResponses: {
        transitionConcern: ["friends", "care"],
        relationshipSafety: 5,
      },
    };
    const reviews: SchoolReview[] = [
      makeReview("care-school", {
        atmosphere: 5,
        exams: 3,
        meals: 4,
        activities: 5,
        facilities: 4,
      }),
      makeReview("care-school", {
        atmosphere: 5,
        exams: 4,
        meals: 4,
        activities: 4,
        facilities: 4,
      }),
      makeReview("quiet-school", {
        atmosphere: 2,
        exams: 3,
        meals: 3,
        activities: 2,
        facilities: 3,
      }),
    ];

    const ranked = rankSchools(
      answer,
      [
        makeSchool({
          id: "quiet-school",
          name: "조용한고등학교",
          tags: ["생활지도"],
        }),
        makeSchool({
          id: "care-school",
          name: "관계좋은고등학교",
          tags: ["생활지도", "상담"],
        }),
      ],
      { reviews },
    );

    expect(ranked[0].school.id).toBe("care-school");
    expect(ranked[0].evidence?.some((item) => item.source === "review")).toBe(true);
    expect(ranked[0].dimensionScores?.relationship_safety).toBeGreaterThan(
      ranked[1].dimensionScores?.relationship_safety ?? 0,
    );
    expect(ranked[0].dimensionScores?.life_enjoyment).toBeGreaterThan(
      ranked[1].dimensionScores?.life_enjoyment ?? 0,
    );
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

function makeOutcomeRecord(
  schoolName: string,
  graduates: number,
  advancement: number,
  fourYear: number,
  juniorCollege: number,
  employment: number,
  specialPurposeType?: string,
) {
  return {
    sido: "서울",
    district: "중구",
    region: "서울 중구",
    school_name: schoolName,
    special_purpose_type: specialPurposeType ?? null,
    graduation_outcomes: [2023, 2024, 2025].map((year) => ({
      year,
      graduates: { total: graduates },
      advancement: {
        total: advancement,
        rate_percent: (advancement / graduates) * 100,
      },
      employment: { total: employment },
      military: { total: 0 },
      other: { total: Math.max(0, graduates - advancement - employment) },
      higher_education_breakdown: {
        domestic_junior_college: { total: juniorCollege },
        domestic_university: { total: fourYear },
        overseas_junior_college: { total: 0 },
        overseas_university: { total: 0 },
        total: { total: advancement },
      },
    })),
  };
}

function makeReview(
  schoolId: string,
  ratings: SchoolReview["ratings"],
): SchoolReview {
  return {
    id: `review-${schoolId}-${Math.random()}`,
    schoolId,
    authorId: "anonymous",
    authorName: "익명",
    relation: "current",
    enrolledYear: 2024,
    ratings,
    body: "학교 분위기와 활동 경험을 남긴 리뷰입니다.",
    status: "approved",
    createdAt: new Date().toISOString(),
  };
}
