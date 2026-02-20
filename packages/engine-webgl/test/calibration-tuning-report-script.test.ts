import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const TUNING_REPORT_SCRIPT = fileURLToPath(
  new URL("../../../scripts/report-calibration-tuning.mjs", import.meta.url),
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
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "fuji-tuning-report-test-"));
  tempDirs.push(directoryPath);
  return directoryPath;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function runTuningReport(args: string[]) {
  return spawnSync("node", [TUNING_REPORT_SCRIPT, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
  });
}

describe("calibration tuning report script", () => {
  it("fails with low-signal gate when dataset is bootstrap and zero-drift", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const metricsPath = path.join(fixtureRoot, "runs", "run-a", "metrics.json");
    const reportPath = path.join(fixtureRoot, "runs", "run-a", "tuning-report.md");

    await writeJson(metricsPath, {
      aggregate: {
        mean_delta_e00: 0,
        p95_delta_e00: 0,
        luma_rmse: 0,
        mean_chroma_error: 0,
        mean_hue_drift_deg: 0,
      },
      oracle_source_policy: "camera_engine",
      frame_metrics: [
        {
          axis: "highlight",
          oracle_source: "camera_engine_bootstrap_seed",
          metrics: {
            mean_delta_e00: 0,
            luma_rmse: 0,
            mean_chroma_error: 0,
          },
        },
      ],
      directional_records: [
        {
          axis: "highlight",
          reference_delta: 0,
          candidate_delta: 0,
          correct: true,
        },
      ],
      directional_scores: [
        {
          axis: "highlight",
          classification: "critical",
          score: 1,
          threshold: 1,
          samples: 1,
          correct: 1,
          pass: true,
        },
      ],
    });

    const result = runTuningReport([
      "--metrics",
      metricsPath,
      "--output",
      reportPath,
      "--fail-on-low-signal",
    ]);

    expect(result.status).toBe(1);
    const output = JSON.parse(result.stdout);
    expect(output.pass).toBe(false);
    expect(output.signal_quality).toBe("low_signal");
    expect(output.low_signal_reasons.some((reason: string) => reason.includes("bootstrap"))).toBe(
      true,
    );

    const markdown = await readFile(reportPath, "utf8");
    expect(markdown).toContain("Signal quality: LOW (not tunable)");
  });

  it("emits increase/decrease style guidance for usable camera signal", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const metricsPath = path.join(fixtureRoot, "runs", "run-b", "metrics.json");
    const reportPath = path.join(fixtureRoot, "runs", "run-b", "tuning-report.md");

    await writeJson(metricsPath, {
      aggregate: {
        mean_delta_e00: 1.8,
        p95_delta_e00: 3.6,
        luma_rmse: 0.014,
        mean_chroma_error: 1.3,
        mean_hue_drift_deg: 4.1,
      },
      oracle_source_policy: "camera_engine",
      frame_metrics: [
        {
          axis: "highlight",
          oracle_source: "camera_engine_xrawstudio",
          metrics: {
            mean_delta_e00: 1.6,
            luma_rmse: 0.011,
            mean_chroma_error: 0.7,
          },
        },
        {
          axis: "shadow",
          oracle_source: "camera_engine_xrawstudio",
          metrics: {
            mean_delta_e00: 1.4,
            luma_rmse: 0.012,
            mean_chroma_error: 0.9,
          },
        },
      ],
      directional_records: [
        {
          axis: "highlight",
          reference_delta: -0.12,
          candidate_delta: -0.05,
          correct: true,
        },
        {
          axis: "shadow",
          reference_delta: -0.08,
          candidate_delta: -0.13,
          correct: true,
        },
      ],
      directional_scores: [
        {
          axis: "highlight",
          classification: "critical",
          score: 1,
          threshold: 1,
          samples: 1,
          correct: 1,
          pass: true,
        },
        {
          axis: "shadow",
          classification: "critical",
          score: 1,
          threshold: 1,
          samples: 1,
          correct: 1,
          pass: true,
        },
      ],
    });

    const result = runTuningReport([
      "--metrics",
      metricsPath,
      "--output",
      reportPath,
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.pass).toBe(true);
    expect(output.signal_quality).toBe("usable");
    expect(output.action_summary.increase).toBeGreaterThan(0);
    expect(output.action_summary.decrease).toBeGreaterThan(0);

    const markdown = await readFile(reportPath, "utf8");
    expect(markdown).toContain("Increase tone_curve highlight response strength");
    expect(markdown).toContain("Decrease tone_curve shadow response strength");
  });
});
