import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateProfile } from "../src/profile.js";
import {
  assertRecipeCompatibleWithProfile,
  type Recipe,
  validateRecipe,
} from "../src/recipe.js";
import { decodeSharePayload, encodeSharePayload } from "../src/share.js";

function loadXtrans4ProfileFixture() {
  const profileJson = readFileSync(
    new URL("../../../profiles/xtrans4.json", import.meta.url),
    "utf8",
  );
  return validateProfile(JSON.parse(profileJson));
}

function createValidRecipe(): Recipe {
  return validateRecipe({
    id: "180f0f4c-8cda-4f3e-a3f9-296f6ec4ac84",
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
    created_at: "2026-02-16T10:00:00.000Z",
    updated_at: "2026-02-16T10:30:00.000Z",
    tags: ["night", "street"],
  });
}

describe("recipe and share contracts", () => {
  it("round-trips share payload encoding/decoding", () => {
    const recipe = createValidRecipe();
    const payload = {
      v: 1 as const,
      profile_id: recipe.profile_id,
      base_image_id: recipe.base_image_id,
      params: recipe.params,
    };

    const encoded = encodeSharePayload(payload);
    const decoded = decodeSharePayload(encoded);

    expect(decoded).toEqual(payload);
  });

  it("detects incompatible recipe values against a profile", () => {
    const profile = loadXtrans4ProfileFixture();
    const recipe = createValidRecipe();
    recipe.params.highlight = 99;

    expect(() => assertRecipeCompatibleWithProfile(recipe, profile)).toThrow(
      /params.highlight/,
    );
  });
});
