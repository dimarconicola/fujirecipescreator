import { describe, expect, it } from "vitest";
import { defaultProfile } from "./state/parameterStore";
import { applyTipPreset, guidedPresets } from "./learnTips";

describe("applyTipPreset", () => {
  it("merges preset params while preserving unspecified fields", () => {
    const base = {
      ...defaultProfile.defaults,
      wb_shift: { ...defaultProfile.defaults.wb_shift },
    };
    const preset = guidedPresets.find((candidate) => candidate.id === "soft-night");

    if (!preset) {
      throw new Error("soft-night preset missing");
    }

    const merged = applyTipPreset(base, preset);

    expect(merged.film_sim).toBe("classic_chrome");
    expect(merged.dynamic_range).toBe(base.dynamic_range);
    expect(merged.wb).toBe("kelvin");
    expect(merged.wb_shift).toEqual({ a_b: -2, r_b: 3 });
  });
});
