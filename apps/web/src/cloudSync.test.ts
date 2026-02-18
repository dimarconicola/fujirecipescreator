import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SYNC_FILENAME, pullSnapshotFromGithubGist, pushSnapshotToGithubGist } from "./cloudSync";
import type { RecipeStoreSnapshot } from "./state/recipeStore";
import { defaultProfile } from "./state/parameterStore";

const baseSnapshot: RecipeStoreSnapshot = {
  recipes: [
    {
      id: "recipe-1",
      name: "Cloud Test",
      profile_id: defaultProfile.profile_id,
      base_image_id: "landscape_v1",
      params: {
        ...defaultProfile.defaults,
        wb_shift: {
          ...defaultProfile.defaults.wb_shift,
        },
      },
      created_at: "2026-02-17T00:00:00.000Z",
      updated_at: "2026-02-17T00:00:00.000Z",
      tags: [],
    },
  ],
  activeRecipeId: "recipe-1",
  recipeName: "Cloud Test",
  slots: {
    A: null,
    B: null,
  },
};

describe("cloud sync", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("pushes a versioned recipe snapshot payload to gist", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await pushSnapshotToGithubGist(
      {
        token: "token-123",
        gistId: "https://gist.github.com/demo-user/1a2b3c4d5e6f7a8b9c0d",
      },
      baseSnapshot,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/gists/1a2b3c4d5e6f7a8b9c0d");
    expect(init.method).toBe("PATCH");

    const payload = JSON.parse(String(init.body)) as {
      files: Record<string, { content: string }>;
    };
    expect(Object.keys(payload.files)).toContain(DEFAULT_SYNC_FILENAME);
    expect(payload.files[DEFAULT_SYNC_FILENAME]?.content).toContain('"version": 1');
    expect(payload.files[DEFAULT_SYNC_FILENAME]?.content).toContain('"recipeName": "Cloud Test"');
  });

  it("pulls and unwraps a versioned recipe snapshot payload", async () => {
    const filePayload = JSON.stringify({
      version: 1,
      exported_at: "2026-02-17T00:01:00.000Z",
      data: baseSnapshot,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          files: {
            [DEFAULT_SYNC_FILENAME]: {
              filename: DEFAULT_SYNC_FILENAME,
              content: filePayload,
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pulled = await pullSnapshotFromGithubGist({
      token: "token-123",
      gistId: "1a2b3c4d5e6f7a8b9c0d",
    });

    const snapshot = pulled as RecipeStoreSnapshot;
    expect(snapshot.recipes).toHaveLength(1);
    expect(snapshot.recipeName).toBe("Cloud Test");
    expect(snapshot.activeRecipeId).toBe("recipe-1");
  });

  it("rejects pushes when required sync credentials are missing", async () => {
    await expect(
      pushSnapshotToGithubGist(
        {
          token: "",
          gistId: "1a2b3c4d5e6f7a8b9c0d",
        },
        baseSnapshot,
      ),
    ).rejects.toThrow("token is required");
  });

  it("rejects sync when gist ID is invalid", async () => {
    await expect(
      pullSnapshotFromGithubGist({
        token: "token-123",
        gistId: "not-a-valid-gist-id",
      }),
    ).rejects.toThrow("gist ID is invalid");
  });

  it("rejects sync when filename includes path separators", async () => {
    await expect(
      pushSnapshotToGithubGist(
        {
          token: "token-123",
          gistId: "1a2b3c4d5e6f7a8b9c0d",
          filename: "../bad.json",
        },
        baseSnapshot,
      ),
    ).rejects.toThrow("filename must not include path separators");
  });
});
