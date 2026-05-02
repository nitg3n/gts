import { z } from "zod";
import {
  getActiveSurveyId,
  listSurveyDefinitions,
  saveSurveyDefinition,
} from "@/lib/store";
import { requireAdminUser } from "@/lib/supabase";
import type { CleanSurvey } from "@/data/surveys";

const surveySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  audience: z.string(),
  defaultTargetLevel: z.enum(["middle", "high", "all"]),
  sourceExampleFiles: z.array(z.string()).default([]),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["hidden", "section", "single", "multi", "scale"]),
      title: z.string().min(1),
      description: z.string().optional(),
      required: z.boolean().optional(),
      choices: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            value: z.string().min(1),
            hint: z.string().optional(),
          }),
        )
        .optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      minLabel: z.string().optional(),
      maxLabel: z.string().optional(),
      defaultValue: z
        .union([z.string(), z.number(), z.array(z.string())])
        .optional(),
      weightTargets: z
        .array(
          z.enum([
            "academics",
            "activities",
            "environment",
            "meal",
            "reviews",
            "stability",
            "distance",
          ]),
        )
        .optional(),
      visibleForStages: z.array(z.enum(["elementary", "middle"])).optional(),
    }),
  ),
});

const saveSurveySchema = z.object({
  survey: surveySchema,
  activeSurveyId: z.string().optional(),
});

export async function GET(request: Request) {
  const user = await requireAdminUser(request);

  if (user instanceof Response) {
    return user;
  }

  return Response.json({
    surveys: await listSurveyDefinitions(),
    activeSurveyId: await getActiveSurveyId(),
  });
}

export async function PATCH(request: Request) {
  const user = await requireAdminUser(request);

  if (user instanceof Response) {
    return user;
  }

  try {
    const { survey, activeSurveyId } = saveSurveySchema.parse(
      await request.json(),
    );
    const saved = await saveSurveyDefinition(survey as CleanSurvey, activeSurveyId);

    return Response.json({
      survey: saved,
      surveys: await listSurveyDefinitions(),
      activeSurveyId: await getActiveSurveyId(),
    });
  } catch (error) {
    return Response.json(
      {
        message: "설문 저장값을 확인해주세요.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}
