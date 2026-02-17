import { z } from "zod";
import { recipeParamsSchema, type RecipeParams } from "./recipe.js";

const recipeExportSchema = z
  .object({
    name: z.string().min(1),
    profile_id: z.string().min(1),
    base_image_id: z.string().min(1),
    params: recipeParamsSchema,
  })
  .strict();

export type RecipeExportInput = z.infer<typeof recipeExportSchema>;

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function formatTitleCase(value: string): string {
  return value
    .split("_")
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

function normalizeRecipeExportInput(input: RecipeExportInput): RecipeExportInput {
  return recipeExportSchema.parse(input);
}

function buildOrderedParams(params: RecipeParams): RecipeParams {
  return {
    film_sim: params.film_sim,
    dynamic_range: params.dynamic_range,
    highlight: params.highlight,
    shadow: params.shadow,
    color: params.color,
    chrome: params.chrome,
    chrome_blue: params.chrome_blue,
    clarity: params.clarity,
    sharpness: params.sharpness,
    noise_reduction: params.noise_reduction,
    grain: params.grain,
    grain_size: params.grain_size,
    wb: params.wb,
    wb_kelvin: params.wb_kelvin,
    wb_shift: {
      a_b: params.wb_shift.a_b,
      r_b: params.wb_shift.r_b,
    },
  };
}

export function formatRecipeExportAsJson(input: RecipeExportInput): string {
  const normalized = normalizeRecipeExportInput(input);
  const ordered = {
    name: normalized.name,
    profile_id: normalized.profile_id,
    base_image_id: normalized.base_image_id,
    params: buildOrderedParams(normalized.params),
  };

  return JSON.stringify(ordered, null, 2);
}

export function formatRecipeExportAsText(input: RecipeExportInput): string {
  const normalized = normalizeRecipeExportInput(input);
  const params = normalized.params;

  return [
    "Approx Disclaimer: Educational visualizer output, not camera-accurate JPEG simulation.",
    `Name: ${normalized.name}`,
    `Profile: ${normalized.profile_id}`,
    `Image: ${normalized.base_image_id}`,
    `Film Sim: ${formatTitleCase(params.film_sim)}`,
    `DR: ${params.dynamic_range.toUpperCase()}`,
    `Highlight: ${formatSigned(params.highlight)}`,
    `Shadow: ${formatSigned(params.shadow)}`,
    `Color: ${formatSigned(params.color)}`,
    `Color Chrome: ${formatTitleCase(params.chrome)}`,
    `Color Chrome Blue: ${formatTitleCase(params.chrome_blue)}`,
    `Clarity: ${formatSigned(params.clarity)}`,
    `Sharpness: ${formatSigned(params.sharpness)}`,
    `Noise Reduction: ${formatSigned(params.noise_reduction)}`,
    `Grain: ${formatTitleCase(params.grain)} / ${formatTitleCase(params.grain_size)}`,
    `WB: ${params.wb === "kelvin" ? `${params.wb_kelvin}K` : formatTitleCase(params.wb)}, Shift A${formatSigned(params.wb_shift.a_b)} R${formatSigned(params.wb_shift.r_b)}`,
  ].join("\n");
}
