import { describe, expect, it } from "vitest";
import { curatedPresets } from "./presets";

describe("curatedPresets", () => {
  it("contains at least 10 curated presets", () => {
    expect(curatedPresets.length).toBeGreaterThanOrEqual(10);
  });

  it("uses unique preset ids", () => {
    const ids = curatedPresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
