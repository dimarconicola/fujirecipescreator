import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  sourcePath: null,
  targetPath: "calibration/baseline/metrics.v1.json",
  metadataPath: "calibration/baseline/metadata.v1.json",
  requireOracleSource: null,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--source") {
      options.sourcePath = argv[index + 1] ?? options.sourcePath;
      index += 1;
      continue;
    }
    if (token === "--target") {
      options.targetPath = argv[index + 1] ?? options.targetPath;
      index += 1;
      continue;
    }
    if (token === "--metadata") {
      options.metadataPath = argv[index + 1] ?? options.metadataPath;
      index += 1;
      continue;
    }
    if (token === "--require-oracle-source") {
      options.requireOracleSource = argv[index + 1] ?? options.requireOracleSource;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (
    options.requireOracleSource !== null &&
    options.requireOracleSource !== "any" &&
    options.requireOracleSource !== "camera_engine"
  ) {
    throw new Error(
      `Unsupported oracle source policy "${options.requireOracleSource}". Use "any" or "camera_engine".`,
    );
  }

  return options;
}

function resolveFromRoot(relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.resolve(ROOT_DIR, relativeOrAbsolutePath);
}

function relativeToRoot(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function assertMetricsShape(metrics) {
  if (!metrics || typeof metrics !== "object") {
    throw new Error("Baseline source must be a metrics JSON object.");
  }
  if (!Array.isArray(metrics.frame_metrics)) {
    throw new Error("Baseline source missing frame_metrics array.");
  }
  if (!Array.isArray(metrics.directional_scores)) {
    throw new Error("Baseline source missing directional_scores array.");
  }
  if (!metrics.aggregate || typeof metrics.aggregate !== "object") {
    throw new Error("Baseline source missing aggregate metrics.");
  }
}

async function findLatestRunMetricsPath(requireOracleSource = null) {
  const runsRoot = resolveFromRoot("artifacts/calibration/runs");
  const runEntries = await fs.readdir(runsRoot, {
    withFileTypes: true,
  });
  const candidateFiles = [];

  for (const entry of runEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const metricsPath = path.join(runsRoot, entry.name, "metrics.json");
    try {
      const stats = await fs.stat(metricsPath);
      if (requireOracleSource && requireOracleSource !== "any") {
        const metrics = await readJson(metricsPath);
        if (metrics?.oracle_source_policy !== requireOracleSource) {
          continue;
        }
      }
      candidateFiles.push({
        metricsPath,
        mtimeMs: stats.mtimeMs,
      });
    } catch {
      // ignore non-run folders
    }
  }

  if (candidateFiles.length === 0) {
    throw new Error(
      requireOracleSource && requireOracleSource !== "any"
        ? `No calibration run metrics found under artifacts/calibration/runs with oracle_source_policy=${requireOracleSource}. Run an evaluate command with --require-oracle-source ${requireOracleSource} first or provide --source.`
        : "No calibration run metrics found under artifacts/calibration/runs. Run calibration:run first or provide --source.",
    );
  }

  candidateFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidateFiles[0].metricsPath;
}

function resolveCommitSha() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function run() {
  const options = parseArgs(process.argv);
  const sourcePath = options.sourcePath
    ? resolveFromRoot(options.sourcePath)
    : await findLatestRunMetricsPath(options.requireOracleSource);
  const targetPath = resolveFromRoot(options.targetPath);
  const metadataPath = resolveFromRoot(options.metadataPath);

  const metrics = await readJson(sourcePath);
  assertMetricsShape(metrics);

  await fs.mkdir(path.dirname(targetPath), {
    recursive: true,
  });
  await fs.mkdir(path.dirname(metadataPath), {
    recursive: true,
  });

  await fs.copyFile(sourcePath, targetPath);

  const metadata = {
    version: 1,
    locked_at: new Date().toISOString(),
    locked_by_commit: resolveCommitSha(),
    source_metrics_path: relativeToRoot(sourcePath),
    baseline_metrics_path: relativeToRoot(targetPath),
    source_run_timestamp: metrics.timestamp ?? null,
    source_oracle_policy: metrics.oracle_source_policy ?? null,
    lock_require_oracle_source: options.requireOracleSource ?? null,
    frame_count: Array.isArray(metrics.frame_metrics) ? metrics.frame_metrics.length : 0,
    directional_axis_count: Array.isArray(metrics.directional_scores)
      ? metrics.directional_scores.length
      : 0,
  };
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        pass: true,
        source_metrics_path: relativeToRoot(sourcePath),
        baseline_metrics_path: relativeToRoot(targetPath),
        baseline_metadata_path: relativeToRoot(metadataPath),
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
