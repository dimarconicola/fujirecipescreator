import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getApprovedLuts,
  getBlockedLuts,
  resolveApprovedLutForFamily,
  validateLutManifest,
} from "../src/index.js";

function loadManifest() {
  const manifestJson = readFileSync(
    new URL("../../../luts/manifest.json", import.meta.url),
    "utf8",
  );

  return validateLutManifest(JSON.parse(manifestJson));
}

describe("lut manifest legal gate", () => {
  it("validates repository lut manifest shape", () => {
    const manifest = loadManifest();
    expect(manifest.version).toBe(1);
    expect(manifest.luts.length).toBeGreaterThan(0);
  });

  it("exposes approved LUTs only when legal signals are affirmative", () => {
    const manifest = loadManifest();
    const approved = getApprovedLuts(manifest);

    expect(approved.length).toBeGreaterThan(0);
    expect(
      approved.every(
        (entry) =>
          entry.redistribution_allowed === "yes" &&
          entry.modification_allowed === "yes" &&
          entry.commercial_use_allowed === "yes" &&
          entry.approval_status === "approved",
      ),
    ).toBe(true);
  });

  it("keeps blocked entries out and falls back to approved teaching LUTs", () => {
    const manifest = loadManifest();
    const blocked = getBlockedLuts(manifest);

    expect(blocked.length).toBeGreaterThan(0);

    const resolved = resolveApprovedLutForFamily(manifest, "xtrans4");
    expect(resolved).not.toBeNull();
    expect(resolved?.family).toBe("teaching");
  });
});
