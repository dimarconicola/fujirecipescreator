import { describe, expect, it } from "vitest";
import { approvedLuts, blockedLuts, resolveActiveLut } from "./luts";

describe("lut data loader", () => {
  it("loads approved and blocked LUT buckets from manifest", () => {
    expect(approvedLuts.length).toBeGreaterThan(0);
    expect(blockedLuts.length).toBeGreaterThan(0);
  });

  it("resolves active LUT with legal fallback", () => {
    const resolved = resolveActiveLut("xtrans4");

    expect(resolved).not.toBeNull();
    expect(resolved?.approval_status).toBe("approved");
    expect(resolved?.family).toBe("teaching");
  });
});
