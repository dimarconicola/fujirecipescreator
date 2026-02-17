import { describe, expect, it } from "vitest";
import {
  formatRecipeExportAsJson,
  formatRecipeExportAsText,
  type RecipeExportInput,
} from "../src/export.js";

function makeInput(): RecipeExportInput {
  return {
    name: "Soft Chrome Night",
    profile_id: "xtrans4",
    base_image_id: "night_v1",
    params: {
      film_sim: "classic_chrome",
      dynamic_range: "dr200",
      highlight: -1,
      shadow: 2,
      color: -1,
      chrome: "strong",
      chrome_blue: "weak",
      clarity: -2,
      sharpness: -1,
      noise_reduction: 1,
      grain: "weak",
      grain_size: "large",
      wb: "kelvin",
      wb_kelvin: 4300,
      wb_shift: { a_b: -2, r_b: 3 },
    },
  };
}

describe("recipe export formatters", () => {
  it("formats deterministic Fuji-style text output", () => {
    const output = formatRecipeExportAsText(makeInput());

    expect(output).toBe(
      [
        "Approx Disclaimer: Educational visualizer output, not camera-accurate JPEG simulation.",
        "Name: Soft Chrome Night",
        "Profile: xtrans4",
        "Image: night_v1",
        "Film Sim: Classic Chrome",
        "DR: DR200",
        "Highlight: -1",
        "Shadow: +2",
        "Color: -1",
        "Color Chrome: Strong",
        "Color Chrome Blue: Weak",
        "Clarity: -2",
        "Sharpness: -1",
        "Noise Reduction: +1",
        "Grain: Weak / Large",
        "WB: 4300K, Shift A-2 R+3",
      ].join("\n"),
    );
  });

  it("exports deterministic JSON with stable key order", () => {
    const scrambledInput = {
      name: "Soft Chrome Night",
      profile_id: "xtrans4",
      base_image_id: "night_v1",
      params: {
        wb: "kelvin",
        wb_shift: { r_b: 3, a_b: -2 },
        color: -1,
        grain: "weak",
        shadow: 2,
        dynamic_range: "dr200",
        film_sim: "classic_chrome",
        highlight: -1,
        chrome: "strong",
        chrome_blue: "weak",
        clarity: -2,
        sharpness: -1,
        noise_reduction: 1,
        grain_size: "large",
        wb_kelvin: 4300,
      },
    } as RecipeExportInput;

    const output = formatRecipeExportAsJson(scrambledInput);

    const dynamicRangeIndex = output.indexOf('"dynamic_range"');
    const wbIndex = output.indexOf('"wb"');
    const wbShiftIndex = output.indexOf('"wb_shift"');

    expect(dynamicRangeIndex).toBeGreaterThan(output.indexOf('"film_sim"'));
    expect(wbIndex).toBeGreaterThan(output.indexOf('"grain_size"'));
    expect(wbShiftIndex).toBeGreaterThan(output.indexOf('"wb_kelvin"'));
  });
});
