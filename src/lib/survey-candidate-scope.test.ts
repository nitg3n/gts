import { describe, expect, it } from "vitest";
import { createGraduationOutcomeIndex } from "@/lib/graduation-outcomes";
import {
  getSurveyCandidateScope,
  selectNationwideGraduationCandidates,
} from "@/lib/survey-candidate-scope";
import type { SurveyAnswer } from "@/lib/types";

describe("survey candidate scope", () => {
  it("opens nationwide candidates when distance is not important", () => {
    expect(getSurveyCandidateScope("near").nationwideSchoolLimit).toBe(0);
    expect(getSurveyCandidateScope("balanced").nationwideSchoolLimit).toBeGreaterThan(
      0,
    );
    expect(getSurveyCandidateScope("not-important").nearbyLimit).toBe(0);
    expect(
      getSurveyCandidateScope("not-important").nationwideSummaryLimit,
    ).toBeGreaterThan(getSurveyCandidateScope("balanced").nationwideSummaryLimit);
    expect(getSurveyCandidateScope("not-important").nationwideSchoolLimit).toBeGreaterThan(
      getSurveyCandidateScope("balanced").nationwideSchoolLimit,
    );
  });

  it("selects nationwide college-outcome candidates independent of local distance", () => {
    const answer: SurveyAnswer = {
      distancePreference: "not-important",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["진학"],
      rawResponses: {
        careerDirection: "college",
        schoolReputation: 5,
      },
    };
    const index = createGraduationOutcomeIndex([
      makeOutcomeRecord("전국진학강한고등학교", 100, 95, 90, 2, 0),
      makeOutcomeRecord("전국진학약한고등학교", 100, 40, 20, 10, 3),
    ]);

    const selected = selectNationwideGraduationCandidates(answer, index, 1);

    expect(selected.map((summary) => summary.schoolName)).toEqual([
      "전국진학강한고등학교",
    ]);
  });

  it("keeps explicit school type filters in the nationwide pool", () => {
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
    const index = createGraduationOutcomeIndex([
      makeOutcomeRecord("전국일반고등학교", 100, 100, 98, 1, 0),
      makeOutcomeRecord("서울도시과학기술고등학교", 100, 100, 98, 1, 0),
      makeOutcomeRecord("한성과학고등학교", 100, 85, 78, 2, 0),
    ]);

    const selected = selectNationwideGraduationCandidates(answer, index, 5);

    expect(selected.map((summary) => summary.schoolName)).toEqual([
      "한성과학고등학교",
    ]);
  });

  it("uses KESS special purpose type when the school name does not expose the type", () => {
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
    const index = createGraduationOutcomeIndex([
      makeOutcomeRecord("전국일반고등학교", 100, 98, 94, 1, 0),
      makeOutcomeRecord("새빛고등학교", 100, 95, 90, 2, 0, "과학고"),
    ]);

    const selected = selectNationwideGraduationCandidates(answer, index, 5);

    expect(selected.map((summary) => summary.schoolName)).toEqual([
      "새빛고등학교",
    ]);
    expect(selected[0].specialPurposeType).toBe("과학고");
  });

  it("treats gifted schools as a distinct nationwide school type", () => {
    const giftedAnswer: SurveyAnswer = {
      distancePreference: "not-important",
      priorities: ["academics", "activities", "environment"],
      preferredTags: ["영재", "과학"],
      categoryPreference: "영재학교",
      rawResponses: {
        categoryPreference: "영재학교",
        careerDirection: "science",
      },
    };
    const scienceAnswer: SurveyAnswer = {
      ...giftedAnswer,
      categoryPreference: "과학고",
      rawResponses: {
        categoryPreference: "과학고",
        careerDirection: "science",
      },
    };
    const index = createGraduationOutcomeIndex([
      makeOutcomeRecord("서울과학고등학교", 100, 97, 94, 0, 0),
      makeOutcomeRecord("한성과학고등학교", 100, 88, 82, 2, 0),
    ]);

    expect(
      selectNationwideGraduationCandidates(giftedAnswer, index, 5).map(
        (summary) => summary.schoolName,
      ),
    ).toEqual(["서울과학고등학교"]);
    expect(
      selectNationwideGraduationCandidates(scienceAnswer, index, 5).map(
        (summary) => summary.schoolName,
      ),
    ).toEqual(["한성과학고등학교"]);
  });

  it("keeps a broad nationwide pool for autonomous private schools because names rarely expose the type", () => {
    const answer: SurveyAnswer = {
      distancePreference: "not-important",
      priorities: ["academics", "activities", "environment"],
      preferredTags: [],
      categoryPreference: "자율형사립고",
      rawResponses: {
        categoryPreference: "자율형사립고",
        careerDirection: "college",
      },
    };
    const index = createGraduationOutcomeIndex([
      makeOutcomeRecord("전국우수고등학교", 100, 95, 90, 2, 0),
      makeOutcomeRecord("전국다른고등학교", 100, 80, 70, 4, 0),
    ]);

    const selected = selectNationwideGraduationCandidates(answer, index, 2);

    expect(selected.map((summary) => summary.schoolName)).toEqual([
      "전국우수고등학교",
      "전국다른고등학교",
    ]);
  });
});

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
    sido: "전국",
    district: "테스트",
    region: "전국 테스트",
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
