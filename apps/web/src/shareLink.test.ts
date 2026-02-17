import { describe, expect, it } from "vitest";
import { defaultProfile } from "./state/parameterStore";
import { buildShareLink, decodeSharePayloadFromSearch } from "./shareLink";

describe("share link helpers", () => {
  it("builds links that decode back to the same payload", () => {
    const link = buildShareLink({
      originUrl: "https://example.com/fuji",
      profileId: defaultProfile.profile_id,
      baseImageId: "portrait_v1",
      params: {
        ...defaultProfile.defaults,
        wb_shift: { ...defaultProfile.defaults.wb_shift },
      },
    });

    const decoded = decodeSharePayloadFromSearch(new URL(link).search);

    expect(decoded).not.toBeNull();
    expect(decoded?.profile_id).toBe(defaultProfile.profile_id);
    expect(decoded?.base_image_id).toBe("portrait_v1");
    expect(decoded?.params).toEqual(defaultProfile.defaults);
  });

  it("returns null when search string has no share payload", () => {
    expect(decodeSharePayloadFromSearch("?v=1")).toBeNull();
  });
});
