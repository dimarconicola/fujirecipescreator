import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeValidateProfile, validateProfile } from "../src/profile.js";

function loadProfileFixture(profileId: string): unknown {
  const profileJson = readFileSync(
    new URL(`../../../profiles/${profileId}.json`, import.meta.url),
    "utf8",
  );
  return JSON.parse(profileJson) as unknown;
}

describe("profileSchema", () => {
  it("validates all repository profile fixtures", () => {
    const profileIds = ["xtrans3", "xtrans4", "xtrans5"];
    const validatedProfiles = profileIds.map((profileId) =>
      validateProfile(loadProfileFixture(profileId)),
    );

    expect(validatedProfiles.map((profile) => profile.profile_id)).toEqual(profileIds);
    for (const profile of validatedProfiles) {
      expect(profile.defaults.film_sim).toBe("provia");
      expect(profile.supported_params.highlight).toContain(0);
    }
  });

  it("rejects defaults that are outside supported params", () => {
    const fixture = loadProfileFixture("xtrans4") as {
      defaults: { film_sim: string };
    };
    fixture.defaults.film_sim = "invalid_sim";

    const result = safeValidateProfile(fixture);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join(".") === "defaults.film_sim"),
      ).toBe(true);
    }
  });
});
