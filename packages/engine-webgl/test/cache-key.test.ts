import { describe, expect, it } from "vitest";
import { computeRenderCacheKey, resolvePipelineMode } from "../src/index.js";

describe("computeRenderCacheKey", () => {
  it("produces deterministic keys independent of object key order", () => {
    const first = computeRenderCacheKey({
      imageId: "landscape_v1",
      profileId: "xtrans4",
      mode: "interactive",
      params: {
        highlight: 1,
        shadow: 0,
        wb_shift: { a_b: -1, r_b: 2 },
      },
    });

    const second = computeRenderCacheKey({
      imageId: "landscape_v1",
      profileId: "xtrans4",
      mode: "interactive",
      params: {
        wb_shift: { r_b: 2, a_b: -1 },
        shadow: 0,
        highlight: 1,
      },
    });

    expect(first).toBe(second);
  });
});

describe("resolvePipelineMode", () => {
  it("returns cpu_fallback when webgl2 is unavailable", () => {
    expect(resolvePipelineMode({ webgl2: false, supports3dTextures: false })).toBe(
      "cpu_fallback",
    );
  });
});
