import { describe, expect, it } from "vitest";
import { imageCredits, lutCredits } from "./credits";

describe("credits data", () => {
  it("loads image attribution records", () => {
    expect(imageCredits).toHaveLength(3);
    expect(imageCredits.every((entry) => entry.sourceUrl.length > 0)).toBe(true);
    expect(imageCredits.every((entry) => entry.license.length > 0)).toBe(true);
  });

  it("loads LUT attribution records", () => {
    expect(lutCredits.length).toBeGreaterThan(0);
    expect(lutCredits.every((entry) => entry.sourceUrl.length > 0)).toBe(true);
  });
});
