import { describe, expect, it } from "vitest";
import { defaultProfile } from "./state/parameterStore";
import { buildRenderCacheKey, RenderFrameCache } from "./renderCache";

describe("buildRenderCacheKey", () => {
  it("is deterministic for equivalent params objects", () => {
    const first = buildRenderCacheKey({
      imageId: "night_v1",
      profileId: defaultProfile.profile_id,
      mode: "settle",
      params: {
        ...defaultProfile.defaults,
        wb_shift: {
          a_b: -2,
          r_b: 3,
        },
      },
    });

    const second = buildRenderCacheKey({
      imageId: "night_v1",
      profileId: defaultProfile.profile_id,
      mode: "settle",
      params: {
        ...defaultProfile.defaults,
        wb_shift: {
          r_b: 3,
          a_b: -2,
        },
      },
    });

    expect(first).toBe(second);
  });
});

describe("RenderFrameCache", () => {
  it("evicts least-recently-used entries after max size", () => {
    const cache = new RenderFrameCache(2);
    cache.set("a", "data:a");
    cache.set("b", "data:b");

    expect(cache.get("a")?.src).toBe("data:a");

    cache.set("c", "data:c");

    expect(cache.get("b")).toBeNull();
    expect(cache.get("a")?.src).toBe("data:a");
    expect(cache.get("c")?.src).toBe("data:c");
  });
});
