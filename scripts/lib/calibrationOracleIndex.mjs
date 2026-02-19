import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const ORACLE_SOURCE_POLICIES = Object.freeze(["any", "camera_engine"]);

export function isOracleSourcePolicySupported(policy) {
  return ORACLE_SOURCE_POLICIES.includes(policy);
}

export function isOracleSourceTypeAllowed(sourceType, policy) {
  if (policy === "any") {
    return true;
  }
  if (policy === "camera_engine") {
    return typeof sourceType === "string" && sourceType.startsWith("camera_engine");
  }
  return false;
}

export function buildOracleSceneCaseKey(sceneId, caseId) {
  return `${sceneId}::${caseId}`;
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function resolvePath(rootDir, relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.resolve(rootDir, relativeOrAbsolutePath);
}

function toRootRelative(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath);
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function isPathInsideDirectory(directoryPath, candidatePath) {
  const relative = path.relative(directoryPath, candidatePath);
  if (!relative) {
    return true;
  }
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export async function validateOracleIndexContract({
  rootDir,
  manifest,
  oracleDirPath,
  oracleIndexPath,
  requireOracleSource = "any",
  verifyHashes = true,
}) {
  if (!isOracleSourcePolicySupported(requireOracleSource)) {
    throw new Error(
      `Unsupported oracle source policy "${requireOracleSource}". Use "any" or "camera_engine".`,
    );
  }

  const oracleDirAbsolute = resolvePath(rootDir, oracleDirPath);
  const oracleIndexAbsolute = resolvePath(rootDir, oracleIndexPath);
  const oracleIndexRelative = toRootRelative(rootDir, oracleIndexAbsolute);
  const failures = [];
  const entryByKey = new Map();
  const expectedKeys = new Set();
  let indexedEntryCount = 0;
  let validatedEntryCount = 0;
  let indexPayload = null;

  for (const scene of manifest.scenes ?? []) {
    const sceneId = typeof scene?.id === "string" ? scene.id : null;
    if (!sceneId) {
      failures.push("[oracle_index_manifest] scene.id missing or invalid.");
      continue;
    }
    for (const calibrationCase of manifest.cases ?? []) {
      const caseId = typeof calibrationCase?.id === "string" ? calibrationCase.id : null;
      if (!caseId) {
        failures.push("[oracle_index_manifest] case.id missing or invalid.");
        continue;
      }
      expectedKeys.add(buildOracleSceneCaseKey(sceneId, caseId));
    }
  }

  try {
    indexPayload = await readJson(oracleIndexAbsolute);
  } catch (error) {
    failures.push(
      `[oracle_index_load] ${oracleIndexRelative}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      pass: false,
      failures,
      index: null,
      entryByKey,
      source_policy: requireOracleSource,
      oracle_index_path: oracleIndexRelative,
      expected_entry_count: expectedKeys.size,
      indexed_entry_count: 0,
      validated_entry_count: 0,
    };
  }

  if (!indexPayload || typeof indexPayload !== "object") {
    failures.push(`[oracle_index_shape] ${oracleIndexRelative} must be a JSON object.`);
  }

  if (!Array.isArray(indexPayload?.entries)) {
    failures.push(`[oracle_index_shape] ${oracleIndexRelative} must include entries array.`);
  }
  const entries = Array.isArray(indexPayload?.entries) ? indexPayload.entries : [];
  indexedEntryCount = entries.length;

  if (
    requireOracleSource !== "any" &&
    !isOracleSourceTypeAllowed(indexPayload?.source_type, requireOracleSource)
  ) {
    failures.push(
      `[oracle_source_policy] index source_type "${indexPayload?.source_type ?? "missing"}" violates policy ${requireOracleSource}`,
    );
  }

  entries.forEach((entry, entryIndex) => {
    if (!entry || typeof entry !== "object") {
      failures.push(
        `[oracle_index_entry_invalid] entry[${entryIndex}] must be an object.`,
      );
      return;
    }

    const sceneId = typeof entry.scene_id === "string" ? entry.scene_id : null;
    const caseId = typeof entry.case_id === "string" ? entry.case_id : null;
    const filePath =
      typeof entry.file_path === "string" && entry.file_path.trim()
        ? entry.file_path
        : null;
    const sha256 =
      typeof entry.sha256 === "string" && entry.sha256.trim() ? entry.sha256 : null;
    const sourceType =
      typeof entry.source_type === "string" && entry.source_type.trim()
        ? entry.source_type
        : null;

    if (!sceneId || !caseId) {
      failures.push(
        `[oracle_index_entry_invalid] entry[${entryIndex}] missing scene_id/case_id.`,
      );
      return;
    }

    const key = buildOracleSceneCaseKey(sceneId, caseId);
    if (entryByKey.has(key)) {
      failures.push(`[oracle_index_duplicate_entry] ${sceneId}/${caseId} duplicated.`);
      return;
    }
    entryByKey.set(key, entry);

    if (!filePath) {
      failures.push(`[oracle_index_entry_invalid] ${sceneId}/${caseId} missing file_path.`);
    }
    if (!sha256) {
      failures.push(`[oracle_index_entry_invalid] ${sceneId}/${caseId} missing sha256.`);
    }
    if (!sourceType) {
      failures.push(
        `[oracle_index_entry_invalid] ${sceneId}/${caseId} missing source_type.`,
      );
    } else if (!isOracleSourceTypeAllowed(sourceType, requireOracleSource)) {
      failures.push(
        `[oracle_source_policy] ${sceneId}/${caseId} source_type "${sourceType}" violates policy ${requireOracleSource}`,
      );
    }

    if (!expectedKeys.has(key)) {
      failures.push(`[oracle_index_unexpected_entry] ${sceneId}/${caseId} not in manifest.`);
    }
  });

  expectedKeys.forEach((key) => {
    if (!entryByKey.has(key)) {
      const [sceneId, caseId] = key.split("::");
      failures.push(
        `[oracle_index_missing_entry] ${sceneId}/${caseId} missing from ${oracleIndexRelative}`,
      );
    }
  });

  for (const [key, entry] of entryByKey.entries()) {
    if (!verifyHashes) {
      continue;
    }

    const [sceneId, caseId] = key.split("::");
    const filePath =
      typeof entry.file_path === "string" && entry.file_path.trim()
        ? entry.file_path
        : null;
    const expectedSha =
      typeof entry.sha256 === "string" && entry.sha256.trim() ? entry.sha256 : null;

    if (!filePath) {
      continue;
    }

    const absoluteFilePath = resolvePath(rootDir, filePath);
    const relativeFilePath = toRootRelative(rootDir, absoluteFilePath);
    if (!isPathInsideDirectory(oracleDirAbsolute, absoluteFilePath)) {
      failures.push(
        `[oracle_index_file_outside_oracle_dir] ${sceneId}/${caseId} -> ${relativeFilePath}`,
      );
      continue;
    }

    let oracleRaw;
    try {
      oracleRaw = await fs.readFile(absoluteFilePath);
    } catch (error) {
      failures.push(
        `[oracle_index_missing_file] ${sceneId}/${caseId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (expectedSha) {
      const actualSha = sha256Hex(oracleRaw);
      if (actualSha !== expectedSha) {
        failures.push(
          `[oracle_index_hash_mismatch] ${sceneId}/${caseId} expected=${expectedSha} actual=${actualSha}`,
        );
        continue;
      }
    }

    validatedEntryCount += 1;
  }

  return {
    pass: failures.length === 0,
    failures,
    index: indexPayload,
    entryByKey,
    source_policy: requireOracleSource,
    oracle_index_path: oracleIndexRelative,
    expected_entry_count: expectedKeys.size,
    indexed_entry_count: indexedEntryCount,
    validated_entry_count: validatedEntryCount,
  };
}
