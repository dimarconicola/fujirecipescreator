import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isOracleSourcePolicySupported } from "./lib/calibrationOracleIndex.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = Object.freeze({
  oracleIndexPath: "artifacts/calibration/oracle-camera-engine-v1/index.v1.json",
  baselineMetricsPath: "calibration/baseline/metrics.camera_engine.v1.json",
  baselineMetadataPath: "calibration/baseline/metadata.camera_engine.v1.json",
  requireOracleSource: "camera_engine",
  requireBaselinePolicy: "camera_engine",
  validateOnly: false,
  skipBuild: false,
  disallowBootstrapSource: false,
});

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
    if (token === "--oracle-index") {
      options.oracleIndexPath = argv[index + 1] ?? options.oracleIndexPath;
      index += 1;
      continue;
    }
    if (token === "--baseline-metrics") {
      options.baselineMetricsPath = argv[index + 1] ?? options.baselineMetricsPath;
      index += 1;
      continue;
    }
    if (token === "--baseline-metadata") {
      options.baselineMetadataPath = argv[index + 1] ?? options.baselineMetadataPath;
      index += 1;
      continue;
    }
    if (token === "--require-oracle-source") {
      options.requireOracleSource = argv[index + 1] ?? options.requireOracleSource;
      index += 1;
      continue;
    }
    if (token === "--require-baseline-policy") {
      options.requireBaselinePolicy = argv[index + 1] ?? options.requireBaselinePolicy;
      index += 1;
      continue;
    }
    if (token === "--validate-only") {
      options.validateOnly = true;
      continue;
    }
    if (token === "--skip-build") {
      options.skipBuild = true;
      continue;
    }
    if (token === "--disallow-bootstrap-source") {
      options.disallowBootstrapSource = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!isOracleSourcePolicySupported(options.requireOracleSource)) {
    throw new Error(
      `Unsupported oracle source policy "${options.requireOracleSource}". Use "any" or "camera_engine".`,
    );
  }
  if (!isOracleSourcePolicySupported(options.requireBaselinePolicy)) {
    throw new Error(
      `Unsupported baseline metadata policy "${options.requireBaselinePolicy}". Use "any" or "camera_engine".`,
    );
  }

  return options;
}

function isBootstrapSourceType(sourceType) {
  return typeof sourceType === "string" && sourceType.toLowerCase().includes("bootstrap");
}

function validateOracleBootstrapPolicy(indexPayload, disallowBootstrapSource) {
  if (!disallowBootstrapSource) {
    return {
      blocked: false,
      indexSourceType:
        typeof indexPayload?.source_type === "string" ? indexPayload.source_type : null,
      blockedEntries: [],
    };
  }

  const indexSourceType =
    typeof indexPayload?.source_type === "string" ? indexPayload.source_type : null;
  if (isBootstrapSourceType(indexSourceType)) {
    throw new Error(
      `Camera oracle index source_type "${indexSourceType}" is bootstrap-tagged and disallowed by --disallow-bootstrap-source.`,
    );
  }

  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  const blockedEntries = [];
  for (const entry of entries) {
    const entrySourceType =
      typeof entry?.source_type === "string" ? entry.source_type : null;
    if (!isBootstrapSourceType(entrySourceType)) {
      continue;
    }
    const sceneId =
      typeof entry?.scene_id === "string" ? entry.scene_id : "unknown_scene";
    const caseId = typeof entry?.case_id === "string" ? entry.case_id : "unknown_case";
    blockedEntries.push(`${sceneId}/${caseId}:${entrySourceType}`);
  }

  if (blockedEntries.length > 0) {
    const preview = blockedEntries.slice(0, 5).join(", ");
    throw new Error(
      `Camera oracle index contains bootstrap-tagged entries and is disallowed by --disallow-bootstrap-source (${blockedEntries.length} entries). Examples: ${preview}`,
    );
  }

  return {
    blocked: false,
    indexSourceType,
    blockedEntries: [],
  };
}

async function assertExists(pathValue, label) {
  const absolutePath = resolveFromRoot(pathValue);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(
      `Missing required camera calibration artifact: ${pathValue} (${label}). Import camera oracle and lock camera baseline before enabling strict camera gate.`,
    );
  }
  return absolutePath;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function validateBaselineMetadata(
  metadata,
  expectedBaselineMetricsPath,
  requiredPolicy,
) {
  if (!metadata || typeof metadata !== "object") {
    throw new Error("Camera baseline metadata must be a JSON object.");
  }

  const lockPolicy =
    typeof metadata.lock_require_oracle_source === "string"
      ? metadata.lock_require_oracle_source
      : null;
  const sourcePolicy =
    typeof metadata.source_oracle_policy === "string" ? metadata.source_oracle_policy : null;
  const effectivePolicy = lockPolicy ?? sourcePolicy;

  if (requiredPolicy !== "any" && effectivePolicy !== requiredPolicy) {
    throw new Error(
      `Camera baseline metadata policy "${effectivePolicy ?? "missing"}" violates required policy "${requiredPolicy}".`,
    );
  }

  const metadataBaselinePath =
    typeof metadata.baseline_metrics_path === "string"
      ? resolveFromRoot(metadata.baseline_metrics_path)
      : null;
  if (!metadataBaselinePath) {
    throw new Error(
      "Camera baseline metadata is missing baseline_metrics_path. Re-lock baseline with calibration:camera:baseline:lock.",
    );
  }

  if (path.normalize(metadataBaselinePath) !== path.normalize(expectedBaselineMetricsPath)) {
    throw new Error(
      `Camera baseline metadata baseline_metrics_path (${metadata.baseline_metrics_path}) does not match expected baseline metrics path (${relativeToRoot(expectedBaselineMetricsPath)}).`,
    );
  }

  return {
    effectivePolicy,
    sourceRunTimestamp:
      typeof metadata.source_run_timestamp === "string" ? metadata.source_run_timestamp : null,
    sourceMetricsPath:
      typeof metadata.source_metrics_path === "string" ? metadata.source_metrics_path : null,
    baselineMetricsPath:
      typeof metadata.baseline_metrics_path === "string" ? metadata.baseline_metrics_path : null,
  };
}

function runNodeScript(relativeScriptPath, args) {
  execFileSync("node", [resolveFromRoot(relativeScriptPath), ...args], {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

function runNpmCommand(args) {
  execFileSync("npm", args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
}

async function run() {
  const options = parseArgs(process.argv);
  const oracleIndexPath = await assertExists(options.oracleIndexPath, "camera_oracle_index");
  const baselineMetricsPath = await assertExists(
    options.baselineMetricsPath,
    "camera_baseline_metrics",
  );
  const baselineMetadataPath = await assertExists(
    options.baselineMetadataPath,
    "camera_baseline_metadata",
  );

  const baselineMetadata = await readJson(baselineMetadataPath);
  const oracleIndex = await readJson(oracleIndexPath);
  const baselineMetadataSummary = validateBaselineMetadata(
    baselineMetadata,
    baselineMetricsPath,
    options.requireBaselinePolicy,
  );
  const oracleBootstrapPolicySummary = validateOracleBootstrapPolicy(
    oracleIndex,
    options.disallowBootstrapSource,
  );

  if (!options.validateOnly) {
    const oracleDirPath = path.dirname(oracleIndexPath);
    runNodeScript("scripts/validate-calibration-oracle-index.mjs", [
      "--oracle-dir",
      oracleDirPath,
      "--oracle-index",
      oracleIndexPath,
      "--require-oracle-source",
      options.requireOracleSource,
    ]);
    if (!options.skipBuild) {
      runNpmCommand(["--workspace", "@fuji/engine-webgl", "run", "build"]);
    }
    runNodeScript("scripts/run-calibration-harness.mjs", [
      "--mode",
      "evaluate",
      "--oracle-dir",
      oracleDirPath,
      "--oracle-index",
      oracleIndexPath,
      "--require-oracle-source",
      options.requireOracleSource,
      "--baseline-metrics",
      baselineMetricsPath,
    ]);
  }

  console.log(
    JSON.stringify(
      {
        pass: true,
        validate_only: options.validateOnly,
        skip_build: options.skipBuild,
        disallow_bootstrap_source: options.disallowBootstrapSource,
        require_oracle_source: options.requireOracleSource,
        require_baseline_policy: options.requireBaselinePolicy,
        camera_oracle_index: relativeToRoot(oracleIndexPath),
        camera_baseline_metrics: relativeToRoot(baselineMetricsPath),
        camera_baseline_metadata: relativeToRoot(baselineMetadataPath),
        baseline_metadata: baselineMetadataSummary,
        oracle_source_summary: oracleBootstrapPolicySummary,
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
