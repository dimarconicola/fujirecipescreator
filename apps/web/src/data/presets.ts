import type { RecipeParams } from "@fuji/domain";
import { defaultProfile } from "../state/parameterStore";

export type RecipePreset = {
  id: string;
  name: string;
  description: string;
  imageId: string;
  params: RecipeParams;
};

function makeParams(overrides: Partial<RecipeParams>): RecipeParams {
  return {
    ...defaultProfile.defaults,
    ...overrides,
    wb_shift: {
      ...defaultProfile.defaults.wb_shift,
      ...(overrides.wb_shift ?? {}),
    },
  };
}

export const curatedPresets: RecipePreset[] = [
  {
    id: "sunlit-foliage-pop",
    name: "Sunlit Foliage Pop",
    description: "Vivid daytime greens with stronger color separation.",
    imageId: "landscape_v1",
    params: makeParams({
      film_sim: "velvia",
      color: 2,
      shadow: 1,
      chrome: "strong",
      chrome_blue: "weak",
      clarity: 1,
      sharpness: 1,
    }),
  },
  {
    id: "soft-portrait-daylight",
    name: "Soft Portrait Daylight",
    description: "Gentle contrast and softened detail for skin tones.",
    imageId: "portrait_v1",
    params: makeParams({
      film_sim: "astia",
      highlight: -1,
      shadow: 0,
      color: -1,
      clarity: -2,
      sharpness: -1,
      noise_reduction: 1,
      grain: "off",
    }),
  },
  {
    id: "night-street-soft-chrome",
    name: "Night Street Soft Chrome",
    description: "Muted tones with lifted highlights and subtle grain.",
    imageId: "night_v1",
    params: makeParams({
      film_sim: "classic_chrome",
      dynamic_range: "dr400",
      highlight: -1,
      shadow: 2,
      color: -1,
      clarity: -2,
      grain: "weak",
      grain_size: "large",
      wb: "kelvin",
      wb_kelvin: 4300,
      wb_shift: { a_b: -2, r_b: 3 },
    }),
  },
  {
    id: "cinema-eternal",
    name: "Cinema Eterna",
    description: "Flat highlight roll-off for cinematic daylight scenes.",
    imageId: "landscape_v1",
    params: makeParams({
      film_sim: "eterna",
      dynamic_range: "dr400",
      highlight: -2,
      shadow: -1,
      color: -2,
      clarity: -1,
      noise_reduction: 2,
      wb: "daylight",
    }),
  },
  {
    id: "clean-monochrome",
    name: "Clean Monochrome",
    description: "Neutral black-and-white with restrained grain.",
    imageId: "portrait_v1",
    params: makeParams({
      film_sim: "mono",
      dynamic_range: "dr200",
      highlight: 0,
      shadow: 1,
      color: -4,
      clarity: 1,
      sharpness: 1,
      grain: "weak",
      grain_size: "small",
    }),
  },
  {
    id: "punchy-travel",
    name: "Punchy Travel",
    description: "High-impact travel look with deep shadows and crisp detail.",
    imageId: "landscape_v1",
    params: makeParams({
      film_sim: "classic_neg",
      dynamic_range: "dr200",
      highlight: 1,
      shadow: 3,
      color: 1,
      chrome: "strong",
      chrome_blue: "strong",
      clarity: 2,
      sharpness: 2,
      noise_reduction: -2,
    }),
  },
  {
    id: "misty-morning",
    name: "Misty Morning",
    description: "Low-contrast atmospheric look for overcast scenes.",
    imageId: "landscape_v1",
    params: makeParams({
      film_sim: "provia",
      dynamic_range: "dr400",
      highlight: -2,
      shadow: -2,
      color: -2,
      clarity: -3,
      sharpness: -2,
      noise_reduction: 2,
      wb: "shade",
      wb_shift: { a_b: 2, r_b: -1 },
    }),
  },
  {
    id: "noir-night",
    name: "Noir Night",
    description: "High-shadow monochrome night treatment.",
    imageId: "night_v1",
    params: makeParams({
      film_sim: "acros",
      dynamic_range: "dr200",
      highlight: 1,
      shadow: 4,
      color: -4,
      clarity: 2,
      sharpness: 1,
      grain: "strong",
      grain_size: "large",
      wb: "tungsten",
    }),
  },
  {
    id: "warm-golden-hour",
    name: "Warm Golden Hour",
    description: "Warmer WB and soft highlight control for evening light.",
    imageId: "portrait_v1",
    params: makeParams({
      film_sim: "provia",
      dynamic_range: "dr200",
      highlight: -1,
      shadow: 0,
      color: 1,
      chrome: "weak",
      clarity: 0,
      wb: "kelvin",
      wb_kelvin: 6800,
      wb_shift: { a_b: 3, r_b: 1 },
    }),
  },
  {
    id: "urban-cool-evening",
    name: "Urban Cool Evening",
    description: "Cool-toned city palette with compressed highlights.",
    imageId: "night_v1",
    params: makeParams({
      film_sim: "classic_chrome",
      dynamic_range: "dr400",
      highlight: -1,
      shadow: 1,
      color: -2,
      chrome_blue: "strong",
      clarity: 1,
      sharpness: 0,
      grain: "weak",
      wb: "kelvin",
      wb_kelvin: 3800,
      wb_shift: { a_b: -3, r_b: -1 },
    }),
  },
];
