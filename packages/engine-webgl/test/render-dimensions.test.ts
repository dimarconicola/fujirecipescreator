import { describe, expect, it } from "vitest";
import { computeRenderDimensions } from "../src/index.js";

describe("computeRenderDimensions", () => {
  it("scales source dimensions for interactive previews", () => {
    expect(computeRenderDimensions(1600, 900, 0.5)).toEqual({
      width: 800,
      height: 450,
    });
  });

  it("clamps resolution scale into safe bounds", () => {
    expect(computeRenderDimensions(1200, 800, 4)).toEqual({
      width: 1200,
      height: 800,
    });

    expect(computeRenderDimensions(1200, 800, 0)).toEqual({
      width: 120,
      height: 80,
    });
  });
});
