import type { RecipeStoreSnapshot } from "./state/recipeStore";

export type GithubGistSyncConfig = {
  token: string;
  gistId: string;
  filename?: string;
};

const DEFAULT_SYNC_FILENAME = "fuji-recipes-sync-v1.json";

type GistFileRecord = {
  filename?: string;
  content?: string;
  truncated?: boolean;
  raw_url?: string;
};

type GistResponse = {
  files?: Record<string, GistFileRecord>;
  message?: string;
};

function normalizeConfig(config: GithubGistSyncConfig): {
  token: string;
  gistId: string;
  filename: string;
} {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  const filename = (config.filename ?? DEFAULT_SYNC_FILENAME).trim() || DEFAULT_SYNC_FILENAME;

  if (!token) {
    throw new Error("Cloud sync token is required.");
  }

  if (!gistId) {
    throw new Error("Cloud sync gist ID is required.");
  }

  return {
    token,
    gistId,
    filename,
  };
}

function buildPayload(snapshot: RecipeStoreSnapshot): string {
  return JSON.stringify(
    {
      version: 1,
      exported_at: new Date().toISOString(),
      data: snapshot,
    },
    null,
    2,
  );
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload.message && payload.message.trim().length > 0) {
      return payload.message;
    }
  } catch {
    // Keep fallback error message when body parsing fails.
  }

  return response.statusText || "unknown_error";
}

function normalizePulledPayload(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  const candidate = input as {
    version?: unknown;
    data?: unknown;
  };

  if (candidate.version === 1 && typeof candidate.data === "object" && candidate.data) {
    return candidate.data;
  }

  return input;
}

async function readGistFileContent(
  file: GistFileRecord,
  token: string,
): Promise<string | null> {
  if (typeof file.content === "string" && !file.truncated) {
    return file.content;
  }

  if (!file.raw_url) {
    return null;
  }

  const response = await fetch(file.raw_url, {
    headers: {
      Accept: "application/vnd.github.raw",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`Cloud pull failed while fetching raw gist file (${response.status}): ${message}`);
  }

  return await response.text();
}

function resolveGistFile(
  files: Record<string, GistFileRecord>,
  requestedFilename: string,
): GistFileRecord | null {
  const direct = files[requestedFilename];
  if (direct) {
    return direct;
  }

  const requestedByInnerName = Object.values(files).find(
    (file) => file.filename === requestedFilename,
  );
  if (requestedByInnerName) {
    return requestedByInnerName;
  }

  return (
    Object.values(files).find((file) => file.filename?.endsWith(".json")) ??
    Object.values(files)[0] ??
    null
  );
}

export async function pushSnapshotToGithubGist(
  config: GithubGistSyncConfig,
  snapshot: RecipeStoreSnapshot,
): Promise<void> {
  const normalized = normalizeConfig(config);
  const payloadContent = buildPayload(snapshot);

  const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(normalized.gistId)}`, {
    method: "PATCH",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalized.token}`,
    },
    body: JSON.stringify({
      files: {
        [normalized.filename]: {
          content: payloadContent,
        },
      },
    }),
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`Cloud push failed (${response.status}): ${message}`);
  }
}

export async function pullSnapshotFromGithubGist(
  config: GithubGistSyncConfig,
): Promise<unknown> {
  const normalized = normalizeConfig(config);

  const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(normalized.gistId)}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${normalized.token}`,
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(`Cloud pull failed (${response.status}): ${message}`);
  }

  const gist = (await response.json()) as GistResponse;
  const files = gist.files;
  if (!files || Object.keys(files).length === 0) {
    throw new Error("Cloud pull failed: gist has no files.");
  }

  const file = resolveGistFile(files, normalized.filename);
  if (!file) {
    throw new Error("Cloud pull failed: no usable sync file found in gist.");
  }

  const content = await readGistFileContent(file, normalized.token);
  if (!content) {
    throw new Error("Cloud pull failed: selected gist file has no content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Cloud pull failed: gist sync file is not valid JSON.");
  }

  return normalizePulledPayload(parsed);
}

export { DEFAULT_SYNC_FILENAME };
