import type { RecipeParams } from "@fuji/domain";

export type LearnTipPreset = {
  id: string;
  title: string;
  description: string;
  params: Partial<RecipeParams>;
};

export type GlossaryItem = {
  term: string;
  meaning: string;
};

export const glossaryItems: GlossaryItem[] = [
  {
    term: "Dynamic Range",
    meaning: "Higher DR compresses highlights and protects bright regions at the cost of flatter contrast.",
  },
  {
    term: "Highlight / Shadow",
    meaning: "Highlight shapes upper tonal roll-off; Shadow lifts or deepens darker tones.",
  },
  {
    term: "Color Chrome",
    meaning: "Targets highly saturated colors to preserve depth and separation.",
  },
  {
    term: "Clarity",
    meaning: "Adjusts local contrast; negative values soften transitions and positive values add punch.",
  },
  {
    term: "WB Shift",
    meaning: "A/B and R/B axes offset white balance tint independently from Kelvin/preset.",
  },
];

export const guidedPresets: LearnTipPreset[] = [
  {
    id: "highlight-protect",
    title: "Protect Highlights",
    description:
      "Good for bright daylight scenes where skies clip: raise DR and lower highlights.",
    params: {
      dynamic_range: "dr400",
      highlight: -2,
      shadow: 0,
    },
  },
  {
    id: "soft-night",
    title: "Soft Night Mood",
    description:
      "Reduces harsh contrast and adds gentle grain for low-light scenes.",
    params: {
      film_sim: "classic_chrome",
      highlight: -1,
      shadow: 2,
      color: -1,
      clarity: -2,
      grain: "weak",
      grain_size: "large",
      wb: "kelvin",
      wb_kelvin: 4300,
      wb_shift: { a_b: -2, r_b: 3 },
    },
  },
  {
    id: "crisp-color",
    title: "Crisp Color",
    description:
      "Increases punch and detail for foliage or travel daylight looks.",
    params: {
      film_sim: "velvia",
      color: 2,
      clarity: 2,
      sharpness: 2,
      noise_reduction: -2,
      chrome: "strong",
      chrome_blue: "strong",
    },
  },
];

export function applyTipPreset(
  baseParams: RecipeParams,
  preset: LearnTipPreset,
): RecipeParams {
  const next = {
    ...baseParams,
    ...preset.params,
    wb_shift: {
      ...baseParams.wb_shift,
      ...(preset.params.wb_shift ?? {}),
    },
  };

  return next;
}
