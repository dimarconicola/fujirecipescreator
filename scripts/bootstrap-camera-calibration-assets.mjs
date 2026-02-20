#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isOracleSourceTypeAllowed } from "./lib/calibrationOracleIndex.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = Object.freeze({
  manifestPath: "calibration/manifest.v1.json",
  metadataIndexPath: "assets/images/metadata/index.json",
  recordOracleDir: "artifacts/calibration/oracle-v1",
  cameraOracleDir: "artifacts/calibration/oracle-camera-engine-v1",
  cameraOracleIndexPath: null,
  sourceType: "camera_engine_bootstrap_seed",
  skipDownload: false,
  skipRecord: false,
  skipImport: false,
  skipCameraRun: false,
  lockBaseline: false,
  skipGateValidate: false,
  dryRun: false,
});

const CAMERA_BASELINE_METRICS_PATH = "calibration/baseline/metrics.camera_engine.v1.json";
const CAMERA_BASELINE_METADATA_PATH = "calibration/baseline/metadata.camera_engine.v1.json";

function resolveFromRoot(relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.resolve(ROOT_DIR, relativeOrAbsolutePath);
}

function relativeToRoot(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") {
      options.manifestPath = argv[index + 1] ?? options.manifestPath;
      index += 1;
      continue;
    }
    if (token === "--metadata-index") {
      options.metadataIndexPath = argv[index + 1] ?? options.metadataIndexPath;
      index += 1;
      continue;
    }
    if (token === "--record-oracle-dir") {
      options.recordOracleDir = argv[index + 1] ?? options.recordOracleDir;
      index += 1;
      continue;
    }
    if (token === "--camera-oracle-dir") {
      options.cameraOracleDir = argv[index + 1] ?? options.cameraOracleDir;
      index += 1;
      continue;
    }
    if (token === "--camera-oracle-index") {
      options.cameraOracleIndexPath = argv[index + 1] ?? options.cameraOracleIndexPath;
      index += 1;
      continue;
    }
    if (token === "--source-type") {
      options.sourceType = argv[index + 1] ?? options.sourceType;
      index += 1;
      continue;
    }
    if (token === "--skip-download") {
      options.skipDownload = true;
      continue;
    }
    if (token === "--skip-record") {
      options.skipRecord = true;
      continue;
    }
    if (token === "--skip-import") {
      options.skipImport = true;
      continue;
    }
    if (token === "--skip-camera-run") {
      options.skipCameraRun = true;
      continue;
    }
    if (token === "--lock-baseline") {
      options.lockBaseline = true;
      continue;
    }
    if (token === "--skip-gate-validate") {
      options.skipGateValidate = true;
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!isOracleSourceTypeAllowed(options.sourceType, "camera_engine")) {
    throw new Error(
      `--source-type must start with "camera_engine". Received "${options.sourceType}".`,
    );
  }
  return options;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args) {
  execFileSync(command, args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length === 0) {
    throw new Error(`Downloaded empty payload from ${url}`);
  }
  await fs.mkdir(path.dirname(destinationPath), {
    recursive: true,
  });
  await fs.writeFile(destinationPath, buffer);
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Calibration manifest must be an object.");
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    throw new Error("Calibration manifest must include scenes.");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("Calibration manifest must include cases.");
  }
}

function assertMetadataIndexShape(metadataIndex) {
  if (!metadataIndex || typeof metadataIndex !== "object") {
    throw new Error("Metadata index must be an object.");
  }
  if (!Array.isArray(metadataIndex.images)) {
    throw new Error("Metadata index must include an images array.");
  }
}

async function loadImageMetadataMap(metadataIndexPath) {
  const metadataIndex = await readJson(metadataIndexPath);
  assertMetadataIndexShape(metadataIndex);

  const byImageId = new Map();
  for (const entry of metadataIndex.images) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    if (typeof entry.image_id !== "string" || typeof entry.metadata_path !== "string") {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const metadata = await readJson(resolveFromRoot(entry.metadata_path));
    if (!metadata || typeof metadata !== "object") {
      continue;
    }
    byImageId.set(entry.image_id, metadata);
  }
  return byImageId;
}

async function ensureManifestSceneSources({
  manifest,
  metadataByImageId,
  skipDownload,
  dryRun,
}) {
  const existing = [];
  const downloaded = [];
  const unresolved = [];

  for (const scene of manifest.scenes) {
    const sceneId = typeof scene?.id === "string" ? scene.id : null;
    const sourcePathValue = typeof scene?.source_path === "string" ? scene.source_path : null;
    if (!sceneId || !sourcePathValue) {
      unresolved.push({
        sceneId: sceneId ?? "unknown",
        reason: "manifest missing id/source_path",
      });
      continue;
    }

    const sourcePath = resolveFromRoot(sourcePathValue);
    // eslint-disable-next-line no-await-in-loop
    const exists = await fileExists(sourcePath);
    if (exists) {
      existing.push(relativeToRoot(sourcePath));
      continue;
    }

    if (skipDownload) {
      unresolved.push({
        sceneId,
        reason: `missing local source file ${sourcePathValue} and --skip-download enabled`,
      });
      continue;
    }

    const metadata = metadataByImageId.get(sceneId);
    const downloadUrl =
      typeof metadata?.direct_asset_url === "string"
        ? metadata.direct_asset_url
        : typeof metadata?.source_url === "string"
          ? metadata.source_url
          : null;
    if (!downloadUrl) {
      unresolved.push({
        sceneId,
        reason: "missing metadata direct_asset_url/source_url",
      });
      continue;
    }

    if (dryRun) {
      downloaded.push({
        scene_id: sceneId,
        source_path: sourcePathValue,
        download_url: downloadUrl,
        dry_run: true,
      });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await downloadFile(downloadUrl, sourcePath);
    downloaded.push({
      scene_id: sceneId,
      source_path: sourcePathValue,
      download_url: downloadUrl,
      dry_run: false,
    });
  }

  if (unresolved.length > 0) {
    throw new Error(
      `Unable to resolve ${unresolved.length} manifest scene sources: ${JSON.stringify(unresolved)}`,
    );
  }

  return {
    existing,
    downloaded,
  };
}

async function run() {
  const options = parseArgs(process.argv);
  const manifestPath = resolveFromRoot(options.manifestPath);
  const metadataIndexPath = resolveFromRoot(options.metadataIndexPath);
  const recordOracleDir = resolveFromRoot(options.recordOracleDir);
  const cameraOracleDir = resolveFromRoot(options.cameraOracleDir);
  const cameraOracleIndexPath = options.cameraOracleIndexPath
    ? resolveFromRoot(options.cameraOracleIndexPath)
    : path.join(cameraOracleDir, "index.v1.json");

  const manifest = await readJson(manifestPath);
  assertManifestShape(manifest);
  const metadataByImageId = await loadImageMetadataMap(metadataIndexPath);
  const sceneSourceSummary = await ensureManifestSceneSources({
    manifest,
    metadataByImageId,
    skipDownload: options.skipDownload,
    dryRun: options.dryRun,
  });

  const executedSteps = [];
  if (!options.skipRecord) {
    if (!options.dryRun) {
      runCommand("npm", ["run", "calibration:record"]);
    }
    executedSteps.push("calibration:record");
  }

  if (!options.skipImport) {
    const importArgs = [
      resolveFromRoot("scripts/import-camera-oracle.mjs"),
      "--manifest",
      manifestPath,
      "--source-dir",
      recordOracleDir,
      "--oracle-dir",
      cameraOracleDir,
      "--oracle-index",
      cameraOracleIndexPath,
      "--source-type",
      options.sourceType,
    ];
    if (options.dryRun) {
      importArgs.push("--dry-run");
    } else {
      runCommand("node", importArgs);
    }
    executedSteps.push("camera:oracle:import");
  }

  if (!options.dryRun && !options.skipCameraRun) {
    runCommand("npm", ["--workspace", "@fuji/engine-webgl", "run", "build"]);
    runCommand("node", [
      resolveFromRoot("scripts/run-calibration-harness.mjs"),
      "--mode",
      "evaluate",
      "--oracle-dir",
      cameraOracleDir,
      "--oracle-index",
      cameraOracleIndexPath,
      "--require-oracle-source",
      "camera_engine",
    ]);
    executedSteps.push("camera:evaluate");
  }

  const baselineMetricsPath = resolveFromRoot(CAMERA_BASELINE_METRICS_PATH);
  const shouldLockBaseline =
    options.lockBaseline || (!(await fileExists(baselineMetricsPath)) && !options.dryRun);
  if (shouldLockBaseline) {
    if (!options.dryRun) {
      runCommand("node", [
        resolveFromRoot("scripts/lock-calibration-baseline.mjs"),
        "--target",
        resolveFromRoot(CAMERA_BASELINE_METRICS_PATH),
        "--metadata",
        resolveFromRoot(CAMERA_BASELINE_METADATA_PATH),
        "--require-oracle-source",
        "camera_engine",
      ]);
    }
    executedSteps.push("camera:baseline:lock");
  }

  if (!options.skipGateValidate) {
    if (!options.dryRun) {
      runCommand("node", [
        resolveFromRoot("scripts/run-camera-calibration-gate.mjs"),
        "--validate-only",
        "--skip-build",
        "--oracle-index",
        cameraOracleIndexPath,
      ]);
    }
    executedSteps.push("camera:gate:validate");
  }

  console.log(
    JSON.stringify(
      {
        pass: true,
        dry_run: options.dryRun,
        source_type: options.sourceType,
        manifest_path: relativeToRoot(manifestPath),
        metadata_index_path: relativeToRoot(metadataIndexPath),
        record_oracle_dir: relativeToRoot(recordOracleDir),
        camera_oracle_dir: relativeToRoot(cameraOracleDir),
        camera_oracle_index_path: relativeToRoot(cameraOracleIndexPath),
        scene_sources: sceneSourceSummary,
        executed_steps: executedSteps,
        note: "Bootstrap dataset is generated from licensable canonical scene assets and app calibration record outputs; this is not first-party camera-engine export parity.",
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
