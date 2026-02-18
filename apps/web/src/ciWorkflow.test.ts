import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBranchesBlock(yaml: string, key: "push" | "pull_request"): string {
  const pattern = new RegExp(
    `${key}:\\n\\s+branches:\\n((?:\\s+-\\s+.+\\n)+)`,
    "m",
  );
  const match = yaml.match(pattern);
  return match?.[1] ?? "";
}

describe("ci workflow branch policy", () => {
  const currentFile = fileURLToPath(import.meta.url);
  const workflowPath = path.resolve(
    path.dirname(currentFile),
    "../../../.github/workflows/ci.yml",
  );
  const workflow = readFileSync(workflowPath, "utf8");
  const requiredBranches = ["main", "codex/**"];

  it("keeps required push branch filters", () => {
    const pushBranches = extractBranchesBlock(workflow, "push");
    expect(pushBranches.length).toBeGreaterThan(0);
    for (const branch of requiredBranches) {
      expect(pushBranches).toMatch(
        new RegExp(`-\\s+["']?${escapeRegex(branch)}["']?`),
      );
    }
  });

  it("keeps required pull_request branch filters", () => {
    const prBranches = extractBranchesBlock(workflow, "pull_request");
    expect(prBranches.length).toBeGreaterThan(0);
    for (const branch of requiredBranches) {
      expect(prBranches).toMatch(
        new RegExp(`-\\s+["']?${escapeRegex(branch)}["']?`),
      );
    }
  });
});
