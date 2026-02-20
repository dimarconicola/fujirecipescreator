import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const CAMERA_GATE_SCRIPT = fileURLToPath(
  new URL("../../../scripts/run-camera-calibration-gate.mjs", import.meta.url),
);

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, {
        recursive: true,
        force: true,
      });
    }),
  );
});

async function createTempFixtureDir(): Promise<string> {
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "fuji-camera-gate-test-"));
  tempDirs.push(directoryPath);
  return directoryPath;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

type CameraGateFixtureOptions = {
  baselinePolicy?: "camera_engine" | "any";
  metadataBaselineMetricsPath?: string;
};

async function buildCameraGateFixture(options: CameraGateFixtureOptions = {}) {
  const fixtureRoot = await createTempFixtureDir();
  const oracleIndexPath = path.join(fixtureRoot, "oracle", "index.v1.json");
  const baselineMetricsPath = path.join(
    fixtureRoot,
    "baseline",
    "metrics.camera_engine.v1.json",
  );
  const baselineMetadataPath = path.join(
    fixtureRoot,
    "baseline",
    "metadata.camera_engine.v1.json",
  );

  await writeJson(oracleIndexPath, {
    version: 1,
    source_type: "camera_engine_xrawstudio",
    entries: [],
  });
  await writeJson(baselineMetricsPath, {
    aggregate: {},
    frame_metrics: [],
    directional_scores: [],
  });
  await writeJson(baselineMetadataPath, {
    version: 1,
    lock_require_oracle_source: options.baselinePolicy ?? "camera_engine",
    source_oracle_policy: options.baselinePolicy ?? "camera_engine",
    baseline_metrics_path: options.metadataBaselineMetricsPath ?? baselineMetricsPath,
    source_metrics_path: path.join(fixtureRoot, "runs", "run-1", "metrics.json"),
    source_run_timestamp: "2026-02-19T00:00:00.000Z",
  });

  return {
    fixtureRoot,
    oracleIndexPath,
    baselineMetricsPath,
    baselineMetadataPath,
  };
}

function runCameraGateValidateOnly(args: string[]) {
  return spawnSync("node", [CAMERA_GATE_SCRIPT, ...args, "--validate-only"], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
  });
}

describe("camera calibration gate script", () => {
  it("passes validate-only checks for camera-policy baseline metadata", async () => {
    const fixture = await buildCameraGateFixture();
    const result = runCameraGateValidateOnly([
      "--oracle-index",
      fixture.oracleIndexPath,
      "--baseline-metrics",
      fixture.baselineMetricsPath,
      "--baseline-metadata",
      fixture.baselineMetadataPath,
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.pass).toBe(true);
    expect(output.validate_only).toBe(true);
    expect(output.require_oracle_source).toBe("camera_engine");
    expect(output.require_baseline_policy).toBe("camera_engine");
  });

  it("fails when baseline metadata policy is not camera_engine", async () => {
    const fixture = await buildCameraGateFixture({
      baselinePolicy: "any",
    });
    const result = runCameraGateValidateOnly([
      "--oracle-index",
      fixture.oracleIndexPath,
      "--baseline-metrics",
      fixture.baselineMetricsPath,
      "--baseline-metadata",
      fixture.baselineMetadataPath,
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("violates required policy");
  });

  it("fails when baseline metadata points to a different metrics file", async () => {
    const fixture = await buildCameraGateFixture({
      metadataBaselineMetricsPath: path.join(
        os.tmpdir(),
        "fuji-camera-gate-invalid",
        "metrics.camera_engine.v1.json",
      ),
    });
    const result = runCameraGateValidateOnly([
      "--oracle-index",
      fixture.oracleIndexPath,
      "--baseline-metrics",
      fixture.baselineMetricsPath,
      "--baseline-metadata",
      fixture.baselineMetadataPath,
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not match expected baseline metrics path");
  });
});
