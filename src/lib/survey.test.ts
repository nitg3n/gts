import { describe, expect, it } from "vitest";
import { deriveSurveyAnswer, getDefaultSurveyResponses } from "@/lib/survey";

describe("deriveSurveyAnswer", () => {
  it("turns the cleaned survey defaults into a high-school recommendation answer", () => {
    const answer = deriveSurveyAnswer(getDefaultSurveyResponses());

    expect(answer.level).toBe("high");
    expect(answer.distancePreference).toBe("balanced");
    expect(answer.priorities).toHaveLength(3);
    expect(answer.rawResponses?.targetLevel).toBe("high");
  });

  it("maps strict commute answers to nearby-school preference", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      commuteImportance: 5,
      commuteTime: "very-near",
    });

    expect(answer.distancePreference).toBe("near");
  });

  it("switches elementary students to middle-school recommendations", () => {
    const answer = deriveSurveyAnswer({
      ...getDefaultSurveyResponses(),
      studentStage: "elementary",
      targetLevel: "middle",
      middleEnvironmentPreference: "activity",
    });

    expect(answer.studentStage).toBe("elementary");
    expect(answer.level).toBe("middle");
    expect(answer.preferredTags).toContain("동아리");
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
});
