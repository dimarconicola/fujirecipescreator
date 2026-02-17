import { describe, expect, it } from "vitest";
import {
  buildApproxUniforms,
  computeWbMultipliers,
  resolveFilmSimId,
  type ApproxRenderParams,
} from "../src/index.js";

function makeParams(overrides?: Partial<ApproxRenderParams>): ApproxRenderParams {
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

describe("approx math", () => {
  it("maps known film sim IDs", () => {
    expect(resolveFilmSimId("provia")).toBe(0);
    expect(resolveFilmSimId("velvia")).toBe(1);
    expect(resolveFilmSimId("classic_chrome")).toBe(3);
    expect(resolveFilmSimId("unknown")).toBe(0);
  });

  it("warms image with higher kelvin", () => {
    const cool = computeWbMultipliers(makeParams({ wbKelvin: 3200 }));
    const warm = computeWbMultipliers(makeParams({ wbKelvin: 7600 }));

    expect(warm[0]).toBeGreaterThan(cool[0]);
    expect(warm[2]).toBeLessThan(cool[2]);
  });

  it("builds bounded uniforms for shader use", () => {
    const uniforms = buildApproxUniforms(
      makeParams({
        dynamicRange: "dr400",
        color: 4,
        highlight: 4,
        shadow: -2,
        clarity: 5,
        sharpness: 4,
        noiseReduction: 4,
        chrome: "strong",
        chromeBlue: "strong",
        grain: "strong",
        grainSize: "large",
      }),
    );

    expect(uniforms.dynamicRangeCompression).toBeGreaterThan(0);
    expect(uniforms.saturation).toBeLessThanOrEqual(2);
    expect(uniforms.highlight).toBeLessThanOrEqual(1);
    expect(uniforms.shadow).toBeGreaterThanOrEqual(-1);
    expect(uniforms.clarity).toBeLessThanOrEqual(0.75);
    expect(uniforms.sharpness).toBeGreaterThanOrEqual(0);
    expect(uniforms.sharpness).toBeLessThanOrEqual(1);
    expect(uniforms.noiseReduction).toBeLessThanOrEqual(1);
    expect(uniforms.chromeStrength).toBeGreaterThan(0);
    expect(uniforms.chromeBlueStrength).toBeGreaterThan(0);
    expect(uniforms.chromeStrength).toBeLessThanOrEqual(1);
    expect(uniforms.chromeBlueStrength).toBeLessThanOrEqual(1);
    expect(uniforms.grainAmount).toBeGreaterThan(0);
    expect(uniforms.grainSize).toBe(1);
  });

  it("applies interaction rules between nr/sharpness/grain", () => {
    const lowNr = buildApproxUniforms(
      makeParams({
        noiseReduction: -4,
        sharpness: 3,
        grain: "strong",
      }),
    );
    const highNr = buildApproxUniforms(
      makeParams({
        noiseReduction: 4,
        sharpness: 3,
        grain: "strong",
      }),
    );
    const grainOff = buildApproxUniforms(
      makeParams({
        noiseReduction: -4,
        grain: "off",
        grainSize: "large",
      }),
    );

    expect(highNr.sharpness).toBeLessThan(lowNr.sharpness);
    expect(highNr.grainAmount).toBeLessThan(lowNr.grainAmount);
    expect(grainOff.grainAmount).toBe(0);
    expect(grainOff.grainSize).toBe(0);
  });

  it("applies profile strength scalars to calibrated response curves", () => {
    const baseline = buildApproxUniforms(
      makeParams({
        dynamicRange: "dr400",
        highlight: 2,
        shadow: 2,
        chrome: "weak",
        chromeBlue: "weak",
        clarity: 2,
        noiseReduction: 1,
        grain: "strong",
      }),
    );
    const calibrated = buildApproxUniforms(
      makeParams({
        dynamicRange: "dr400",
        highlight: 2,
        shadow: 2,
        chrome: "weak",
        chromeBlue: "weak",
        clarity: 2,
        noiseReduction: 1,
        grain: "strong",
        strengthScalars: {
          toneCurve: 1.25,
          chrome: 1.2,
          clarity: 1.1,
          nr: 0.8,
          grain: 1.2,
        },
      }),
    );

    expect(Math.abs(calibrated.highlight)).toBeGreaterThan(Math.abs(baseline.highlight));
    expect(Math.abs(calibrated.shadow)).toBeGreaterThan(Math.abs(baseline.shadow));
    expect(calibrated.dynamicRangeCompression).toBeGreaterThan(
      baseline.dynamicRangeCompression,
    );
    expect(calibrated.chromeStrength).toBeGreaterThan(baseline.chromeStrength);
    expect(calibrated.chromeBlueStrength).toBeGreaterThan(baseline.chromeBlueStrength);
    expect(calibrated.clarity).toBeGreaterThan(baseline.clarity);
    expect(calibrated.noiseReduction).toBeLessThan(baseline.noiseReduction);
    expect(calibrated.grainAmount).toBeGreaterThan(baseline.grainAmount);
  });
});
