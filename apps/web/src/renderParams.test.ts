import { describe, expect, it } from "vitest";
import type { Profile, RecipeParams } from "@fuji/domain";
import { DEFAULT_APPROX_STRENGTH_SCALARS } from "@fuji/engine-webgl";
import { toApproxRenderParams } from "./renderParams";

function makeParams(overrides?: Partial<RecipeParams>): RecipeParams {
  return {
    film_sim: "provia",
    dynamic_range: "dr100",
    highlight: 0,
    shadow: 0,
    color: 0,
    chrome: "off",
    chrome_blue: "off",
    clarity: 0,
    sharpness: 0,
    noise_reduction: 0,
    grain: "off",
    grain_size: "small",
    wb: "auto",
    wb_kelvin: 5600,
    wb_shift: {
      a_b: 0,
      r_b: 0,
    },
    ...overrides,
  };
}

describe("toApproxRenderParams", () => {
  it("maps profile strength scalars into engine param format", () => {
    const profileStrengthScalars: Profile["strength_scalars"] = {
      tone_curve: 0.96,
      chrome: 1.08,
      clarity: 1.1,
      nr: 0.95,
      grain: 1.05,
    };
    const mapped = toApproxRenderParams(makeParams(), profileStrengthScalars);

    expect(mapped.strengthScalars).toEqual({
      toneCurve: 0.96,
      chrome: 1.08,
      clarity: 1.1,
      nr: 0.95,
      grain: 1.05,
    });
  });

  it("uses default neutral scalars when profile scalars are omitted", () => {
    const mapped = toApproxRenderParams(makeParams());
    expect(mapped.strengthScalars).toEqual(DEFAULT_APPROX_STRENGTH_SCALARS);
  });
});

