import { computeRenderCacheKey } from "@fuji/engine-webgl";
import type { RecipeParams } from "@fuji/domain";

type RenderCacheMode = "interactive" | "settle";

type RenderFrameCacheEntry = {
  src: string;
  lastAccessedAt: number;
};

type BuildRenderCacheKeyInput = {
  imageId: string;
  profileId: string;
  params: RecipeParams;
  mode: RenderCacheMode;
};

export function buildRenderCacheKey(input: BuildRenderCacheKeyInput): string {
  return computeRenderCacheKey({
    imageId: input.imageId,
    profileId: input.profileId,
    params: input.params,
    mode: input.mode,
  });
}

export class RenderFrameCache {
  private readonly entries = new Map<string, RenderFrameCacheEntry>();

  constructor(private readonly maxEntries = 32) {}

  get(key: string): RenderFrameCacheEntry | null {
    const existing = this.entries.get(key);
    if (!existing) {
      return null;
    }

    const updated: RenderFrameCacheEntry = {
      ...existing,
      lastAccessedAt: Date.now(),
    };

    this.entries.delete(key);
    this.entries.set(key, updated);
    return updated;
  }

  set(key: string, src: string): void {
    this.entries.delete(key);
    this.entries.set(key, {
      src,
      lastAccessedAt: Date.now(),
    });

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }

  size(): number {
    return this.entries.size;
  }
}
