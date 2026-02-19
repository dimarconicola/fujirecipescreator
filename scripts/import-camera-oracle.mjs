import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import {
  buildOracleSceneCaseKey,
  isOracleSourceTypeAllowed,
  sha256Hex,
  validateOracleIndexContract,
} from "./lib/calibrationOracleIndex.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULTS = {
  manifestPath: "calibration/manifest.v1.json",
  sourceDir: "artifacts/calibration/camera-engine-exports",
  oracleDir: "artifacts/calibration/oracle-camera-engine-v1",
  oracleIndexPath: null,
  sourceType: "camera_engine_xrawstudio",
  dryRun: false,
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
    if (token === "--source-dir") {
      options.sourceDir = argv[index + 1] ?? options.sourceDir;
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
    if (token === "--source-type") {
      options.sourceType = argv[index + 1] ?? options.sourceType;
      index += 1;
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
      `--source-type must start with "camera_engine" for camera policy. Received "${options.sourceType}".`,
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

function buildExpectedPairs(manifest) {
  const pairs = [];
  for (const scene of manifest.scenes) {
    if (!scene?.id || typeof scene.id !== "string") {
      throw new Error("Calibration manifest scene.id must be a non-empty string.");
    }
    for (const calibrationCase of manifest.cases) {
      if (!calibrationCase?.id || typeof calibrationCase.id !== "string") {
        throw new Error("Calibration manifest case.id must be a non-empty string.");
      }
      pairs.push({
        sceneId: scene.id,
        caseId: calibrationCase.id,
      });
    }
  }
  return pairs;
}

function decodeJpegOrThrow(buffer, relativePath) {
  const decoded = jpeg.decode(buffer, { useTArray: true });
  if (!decoded || !decoded.width || !decoded.height) {
    throw new Error(`Invalid JPEG payload: ${relativePath}`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveSourceFilePath(sourceDir, sceneId, caseId) {
  const baseName = `${sceneId}__${caseId}`;
  const candidates = [
    `${baseName}.jpg`,
    `${baseName}.jpeg`,
    `${baseName}.JPG`,
    `${baseName}.JPEG`,
  ];

  for (const candidate of candidates) {
    const absolutePath = path.join(sourceDir, candidate);
    // eslint-disable-next-line no-await-in-loop
    if (await fileExists(absolutePath)) {
      return absolutePath;
    }
  }
  return null;
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, {
    recursive: true,
  });
}

async function run() {
  const options = parseArgs(process.argv);
  const manifestPath = resolveFromRoot(options.manifestPath);
  const sourceDir = resolveFromRoot(options.sourceDir);
  const oracleDir = resolveFromRoot(options.oracleDir);
  const oracleIndexPath = options.oracleIndexPath
    ? resolveFromRoot(options.oracleIndexPath)
    : path.join(oracleDir, "index.v1.json");

  const manifest = await readJson(manifestPath);
  assertManifestShape(manifest);
  const expectedPairs = buildExpectedPairs(manifest);

  const missingSources = [];
  const importedEntries = [];

  if (!options.dryRun) {
    await ensureDirectory(oracleDir);
  }

  for (const pair of expectedPairs) {
    // eslint-disable-next-line no-await-in-loop
    const sourceFilePath = await resolveSourceFilePath(
      sourceDir,
      pair.sceneId,
      pair.caseId,
    );
    if (!sourceFilePath) {
      missingSources.push(`${pair.sceneId}/${pair.caseId}`);
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const sourceRaw = await fs.readFile(sourceFilePath);
    decodeJpegOrThrow(sourceRaw, toRootRelative(sourceFilePath));

    const outputFileName = `${pair.sceneId}__${pair.caseId}.jpg`;
    const outputPath = path.join(oracleDir, outputFileName);
    if (!options.dryRun) {
      // eslint-disable-next-line no-await-in-loop
      await fs.writeFile(outputPath, sourceRaw);
    }

    importedEntries.push({
      scene_id: pair.sceneId,
      case_id: pair.caseId,
      file_path: toRootRelative(outputPath),
      sha256: sha256Hex(sourceRaw),
      source_type: options.sourceType,
      imported_from: toRootRelative(sourceFilePath),
    });
  }

  if (missingSources.length > 0) {
    throw new Error(
      `Missing camera oracle source files for ${missingSources.length} scene/case pairs: ${missingSources.join(", ")}`,
    );
  }

  const indexPayload = {
    version: 1,
    generated_at: new Date().toISOString(),
    generator: "scripts/import-camera-oracle.mjs",
    source_type: options.sourceType,
    oracle_dir: toRootRelative(oracleDir),
    import_source_dir: toRootRelative(sourceDir),
    manifest_path: toRootRelative(manifestPath),
    entries: importedEntries,
  };

  if (!options.dryRun) {
    await fs.writeFile(oracleIndexPath, `${JSON.stringify(indexPayload, null, 2)}\n`);
  }

  const validation = options.dryRun
    ? {
        pass: importedEntries.length === expectedPairs.length,
        validated_entry_count: importedEntries.length,
        failures: [],
      }
    : await validateOracleIndexContract({
        rootDir: ROOT_DIR,
        manifest,
        oracleDirPath: oracleDir,
        oracleIndexPath,
        requireOracleSource: "camera_engine",
        verifyHashes: true,
      });

  const expectedCount = expectedPairs.length;
  const importedCount = importedEntries.length;
  const output = {
    pass: validation.pass,
    dry_run: options.dryRun,
    source_type: options.sourceType,
    manifest_path: toRootRelative(manifestPath),
    source_dir: toRootRelative(sourceDir),
    oracle_dir: toRootRelative(oracleDir),
    oracle_index_path: toRootRelative(oracleIndexPath),
    expected_entries: expectedCount,
    imported_entries: importedCount,
    validated_entries: validation.validated_entry_count,
    validation_failures: validation.failures,
  };

  console.log(JSON.stringify(output, null, 2));

  if (!output.pass) {
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
