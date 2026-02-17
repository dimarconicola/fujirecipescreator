import { z } from "zod";
import type { Profile } from "./profile.js";

const intSchema = z.number().int();

export const recipeParamsSchema = z
  .object({
    film_sim: z.string().min(1),
    dynamic_range: z.string().min(1),
    highlight: intSchema,
    shadow: intSchema,
    color: intSchema,
    chrome: z.string().min(1),
    chrome_blue: z.string().min(1),
    clarity: intSchema,
    sharpness: intSchema,
    noise_reduction: intSchema,
    grain: z.string().min(1),
    grain_size: z.string().min(1),
    wb: z.string().min(1),
    wb_kelvin: intSchema,
    wb_shift: z
      .object({
        a_b: intSchema,
        r_b: intSchema,
      })
      .strict(),
  })
  .strict();

export const recipeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120),
    profile_id: z.string().min(1),
    base_image_id: z.string().min(1),
    params: recipeParamsSchema,
    created_at: z.string().datetime({ offset: true }),
    updated_at: z.string().datetime({ offset: true }),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    if (Date.parse(recipe.updated_at) < Date.parse(recipe.created_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updated_at"],
        message: "updated_at must be equal to or later than created_at",
      });
    }
  });

export type RecipeParams = z.infer<typeof recipeParamsSchema>;
export type Recipe = z.infer<typeof recipeSchema>;

export type CompatibilityIssue = {
  path: string;
  message: string;
};

function addIssue(issues: CompatibilityIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

function isWithinBounds(value: number, bounds: readonly [number, number]): boolean {
  return value >= bounds[0] && value <= bounds[1];
}

export function getRecipeCompatibilityIssues(
  recipe: Pick<Recipe, "profile_id" | "params">,
  profile: Profile,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const { params } = recipe;
  const supported = profile.supported_params;

  if (recipe.profile_id !== profile.profile_id) {
    addIssue(
      issues,
      "profile_id",
      "Recipe profile_id does not match target profile.profile_id",
    );
  }

  if (!supported.film_sim.includes(params.film_sim)) {
    addIssue(issues, "params.film_sim", "film_sim is not supported by profile");
  }

  if (!supported.dynamic_range.includes(params.dynamic_range)) {
    addIssue(issues, "params.dynamic_range", "dynamic_range is not supported by profile");
  }

  if (!supported.highlight.includes(params.highlight)) {
    addIssue(issues, "params.highlight", "highlight is out of supported range");
  }

  if (!supported.shadow.includes(params.shadow)) {
    addIssue(issues, "params.shadow", "shadow is out of supported range");
  }

  if (!supported.color.includes(params.color)) {
    addIssue(issues, "params.color", "color is out of supported range");
  }

  if (!supported.chrome.includes(params.chrome)) {
    addIssue(issues, "params.chrome", "chrome is not supported by profile");
  }

  if (!supported.chrome_blue.includes(params.chrome_blue)) {
    addIssue(issues, "params.chrome_blue", "chrome_blue is not supported by profile");
  }

  if (!supported.clarity.includes(params.clarity)) {
    addIssue(issues, "params.clarity", "clarity is out of supported range");
  }

  if (!supported.sharpness.includes(params.sharpness)) {
    addIssue(issues, "params.sharpness", "sharpness is out of supported range");
  }

  if (!supported.noise_reduction.includes(params.noise_reduction)) {
    addIssue(
      issues,
      "params.noise_reduction",
      "noise_reduction is out of supported range",
    );
  }

  if (!supported.grain.includes(params.grain)) {
    addIssue(issues, "params.grain", "grain is not supported by profile");
  }

  if (!supported.grain_size.includes(params.grain_size)) {
    addIssue(issues, "params.grain_size", "grain_size is not supported by profile");
  }

  if (!supported.wb.includes(params.wb)) {
    addIssue(issues, "params.wb", "wb is not supported by profile");
  }

  if (!isWithinBounds(params.wb_kelvin, supported.wb_kelvin)) {
    addIssue(issues, "params.wb_kelvin", "wb_kelvin is out of supported bounds");
  }

  if (!isWithinBounds(params.wb_shift.a_b, supported.wb_shift.a_b)) {
    addIssue(issues, "params.wb_shift.a_b", "wb_shift.a_b is out of supported bounds");
  }

  if (!isWithinBounds(params.wb_shift.r_b, supported.wb_shift.r_b)) {
    addIssue(issues, "params.wb_shift.r_b", "wb_shift.r_b is out of supported bounds");
  }

  return issues;
}

export function assertRecipeCompatibleWithProfile(
  recipe: Pick<Recipe, "profile_id" | "params">,
  profile: Profile,
): void {
  const issues = getRecipeCompatibilityIssues(recipe, profile);

  if (issues.length === 0) {
    return;
  }

  const details = issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");

  throw new Error(`Recipe is incompatible with profile ${profile.profile_id}: ${details}`);
}

export function validateRecipe(input: unknown): Recipe {
  return recipeSchema.parse(input);
}

export function safeValidateRecipe(input: unknown): z.SafeParseReturnType<unknown, Recipe> {
  return recipeSchema.safeParse(input);
}
