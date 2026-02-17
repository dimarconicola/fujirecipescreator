import { describe, expect, it } from "vitest";
import { applyCpuApproxPixel, buildApproxUniforms, type ApproxRenderParams } from "../src/index.js";

function makeParams(overrides: Partial<ApproxRenderParams> = {}): ApproxRenderParams {
  return {
    filmSim: "provia",
    dynamicRange: "dr100",
    highlight: 0,
    shadow: 0,
    color: 0,
    chrome: "off",
    chromeBlue: "off",
    clarity: 0,
    sharpness: 0,
    noiseReduction: 0,
    grain: "off",
    grainSize: "small",
    wbMode: "kelvin",
    wbKelvin: 5600,
    wbShift: {
      a_b: 0,
      r_b: 0,
    },
    ...overrides,
  };
}

describe("cpu renderer math", () => {
  it("applies wb and tone adjustments while staying clamped", () => {
    const uniforms = buildApproxUniforms(
      makeParams({
        wbKelvin: 7600,
        highlight: 4,
        shadow: -2,
      }),
    );

    const [r, g, b] = applyCpuApproxPixel(0.5, 0.5, 0.5, uniforms, 0.5);

    expect(r).toBeGreaterThanOrEqual(0);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);
  });

  it("adds grain when grain amount is enabled", () => {
    const noGrainUniforms = buildApproxUniforms(makeParams({ grain: "off" }));
    const grainUniforms = buildApproxUniforms(makeParams({ grain: "strong", grainSize: "large" }));

    const baseline = applyCpuApproxPixel(0.4, 0.4, 0.4, noGrainUniforms, 0.5);
    const withGrain = applyCpuApproxPixel(0.4, 0.4, 0.4, grainUniforms, 0.9);

    expect(withGrain).not.toEqual(baseline);
  });

  it("changes saturated pixels with color chrome settings", () => {
    const noChromeUniforms = buildApproxUniforms(makeParams({ chrome: "off", chromeBlue: "off" }));
    const chromeUniforms = buildApproxUniforms(
      makeParams({ chrome: "strong", chromeBlue: "strong" }),
    );

    const baseline = applyCpuApproxPixel(0.18, 0.32, 0.9, noChromeUniforms, 0.5);
    const withChrome = applyCpuApproxPixel(0.18, 0.32, 0.9, chromeUniforms, 0.5);

    expect(withChrome).not.toEqual(baseline);
  });
});
