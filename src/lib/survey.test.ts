import { describe, expect, it } from "vitest";
import { deriveSurveyAnswer, getDefaultSurveyResponses } from "@/lib/survey";

describe("deriveSurveyAnswer", () => {
  it("turns the cleaned survey defaults into a high-school recommendation answer", () => {
    const answer = deriveSurveyAnswer(getDefaultSurveyResponses());

    expect(answer.distancePreference).toBe("balanced");
    expect(answer.priorities).toHaveLength(3);
    expect(answer.studentGender).toBeUndefined();
  });

  it("keeps the student's gender as a hard recommendation input", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      studentGender: "female",
    });

    expect(answer.studentGender).toBe("female");
  });

  it("maps strict commute answers to nearby-school preference", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      commuteImportance: 5,
      commuteTime: "very-near",
    });

    expect(answer.distancePreference).toBe("near");
  });

  it("maps vocational preferences to practical activity tags", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      categoryPreference: "특성화고",
      schoolLife: 5,
    });

    expect(answer.categoryPreference).toBe("특성화고");
    expect(answer.preferredTags).toContain("실습");
    expect(answer.preferredTags).toContain("동아리");
  });

  it("infers category and tags from career direction when the category is undecided", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      categoryPreference: "any",
      careerDirection: "science",
      activityPreference: ["project"],
    });

    expect(answer.categoryPreference).toBe("과학고");
    expect(answer.preferredTags).toContain("과학");
    expect(answer.preferredTags).toContain("프로젝트");
  });

  it("keeps gifted-school preferences as a distinct high-school type", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      categoryPreference: "영재학교",
    });

    expect(answer.categoryPreference).toBe("영재학교");
    expect(answer.preferredTags).toContain("영재");
    expect(answer.preferredTags).toContain("과학");
  });

  it("uses transition concerns to strengthen commute and care signals", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      commuteImportance: 3,
      commuteTime: "balanced",
      transitionConcern: ["commute", "friends"],
    });

    expect(answer.distancePreference).toBe("near");
    expect(answer.preferredTags).toContain("통학");
    expect(answer.preferredTags).toContain("상담");
  });
});
