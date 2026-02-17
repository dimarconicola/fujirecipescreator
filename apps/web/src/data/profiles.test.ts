import { describe, expect, it } from "vitest";
import { availableProfiles, resolveProfile } from "./profiles";

describe("profile catalog", () => {
  it("loads xtrans3, xtrans4, and xtrans5 profiles", () => {
    const ids = availableProfiles.map((profile) => profile.profile_id);

    expect(ids).toContain("xtrans3");
    expect(ids).toContain("xtrans4");
    expect(ids).toContain("xtrans5");
  });

  it("resolves profiles by id", () => {
    const resolved = resolveProfile("xtrans5");

    expect(resolved).not.toBeNull();
    expect(resolved?.display_name).toBe("X-Trans V");
    expect(resolveProfile("missing")).toBeNull();
  });
});
