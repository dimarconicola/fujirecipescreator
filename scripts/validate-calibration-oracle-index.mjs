import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isOracleSourcePolicySupported,
  validateOracleIndexContract,
} from "./lib/calibrationOracleIndex.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  manifestPath: "calibration/manifest.v1.json",
  oracleDir: "artifacts/calibration/oracle-v1",
  oracleIndexPath: null,
  requireOracleSource: "any",
};

function parseArgs(argv) {
  const options = { ...DEFAULTS };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--manifest") {
      options.manifestPath = argv[index + 1] ?? options.manifestPath;
      index += 1;
      continue;
    }
    if (token === "--oracle-dir") {
      options.oracleDir = argv[index + 1] ?? options.oracleDir;
      index += 1;
      continue;
    }
    if (token === "--oracle-index") {
      options.oracleIndexPath = argv[index + 1] ?? options.oracleIndexPath;
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

  if (!isOracleSourcePolicySupported(options.requireOracleSource)) {
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

function toRootRelative(absolutePath) {
  return path.relative(ROOT_DIR, absolutePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function assertManifestShape(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Calibration manifest must be an object.");
  }
  if (!Array.isArray(manifest.scenes) || manifest.scenes.length === 0) {
    throw new Error("Calibration manifest must include at least one scene.");
  }
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) {
    throw new Error("Calibration manifest must include at least one case.");
  }
}

async function run() {
  const options = parseArgs(process.argv);
  const manifestPath = resolveFromRoot(options.manifestPath);
  const oracleDirPath = resolveFromRoot(options.oracleDir);
  const oracleIndexPath = options.oracleIndexPath
    ? resolveFromRoot(options.oracleIndexPath)
    : path.join(oracleDirPath, "index.v1.json");

  const manifest = await readJson(manifestPath);
  assertManifestShape(manifest);

  const validation = await validateOracleIndexContract({
    rootDir: ROOT_DIR,
    manifest,
    oracleDirPath,
    oracleIndexPath,
    requireOracleSource: options.requireOracleSource,
    verifyHashes: true,
  });

  console.log(
    JSON.stringify(
      {
        pass: validation.pass,
        source_policy: validation.source_policy,
        manifest_path: toRootRelative(manifestPath),
        oracle_dir: toRootRelative(oracleDirPath),
        oracle_index_path: validation.oracle_index_path,
        expected_entries: validation.expected_entry_count,
        indexed_entries: validation.indexed_entry_count,
        validated_entries: validation.validated_entry_count,
        failures: validation.failures,
      },
      null,
      2,
    ),
  );

  if (!validation.pass) {
    process.exitCode = 1;
  }
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
