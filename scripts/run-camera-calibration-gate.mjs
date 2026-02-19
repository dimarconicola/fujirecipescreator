import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAMERA_ORACLE_INDEX = "artifacts/calibration/oracle-camera-engine-v1/index.v1.json";
const CAMERA_BASELINE_METRICS = "calibration/baseline/metrics.camera_engine.v1.json";

function resolveFromRoot(relativePath) {
  return path.resolve(ROOT_DIR, relativePath);
}

async function assertExists(relativePath) {
  const absolutePath = resolveFromRoot(relativePath);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(
      `Missing required camera calibration artifact: ${relativePath}. Import camera oracle and lock camera baseline before enabling strict camera gate.`,
    );
  }
}

function runCommand(command) {
  execSync(command, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

async function run() {
  await assertExists(CAMERA_ORACLE_INDEX);
  await assertExists(CAMERA_BASELINE_METRICS);

  runCommand("npm run calibration:camera:oracle:check");
  runCommand("npm run calibration:camera:baseline:check");

  console.log(
    JSON.stringify(
      {
        pass: true,
        camera_oracle_index: CAMERA_ORACLE_INDEX,
        camera_baseline_metrics: CAMERA_BASELINE_METRICS,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        pass: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
