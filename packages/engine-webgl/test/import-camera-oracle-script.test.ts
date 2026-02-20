import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const IMPORT_CAMERA_ORACLE_SCRIPT = fileURLToPath(
  new URL("../../../scripts/import-camera-oracle.mjs", import.meta.url),
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
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "fuji-camera-import-test-"));
  tempDirs.push(directoryPath);
  return directoryPath;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

async function writeJpeg(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), {
    recursive: true,
  });
  const encoded = jpeg.encode(
    {
      width: 1,
      height: 1,
      data: Buffer.from([120, 180, 220, 255]),
    },
    90,
  );
  await writeFile(filePath, encoded.data);
}

function runImportScript(args: string[]) {
  return spawnSync("node", [IMPORT_CAMERA_ORACLE_SCRIPT, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
  });
}

describe("import camera oracle script", () => {
  it("imports manifest scene/case JPEG pairs and writes strict index", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const manifestPath = path.join(fixtureRoot, "calibration", "manifest.v1.json");
    const sourceDir = path.join(fixtureRoot, "camera-engine-exports");
    const oracleDir = path.join(fixtureRoot, "oracle-camera-engine-v1");
    const oracleIndexPath = path.join(oracleDir, "index.v1.json");

    await writeJson(manifestPath, {
      scenes: [
        {
          id: "scene_a",
        },
      ],
      cases: [
        {
          id: "base",
        },
        {
          id: "tone_highlight_plus2",
        },
      ],
    });
    await writeJpeg(path.join(sourceDir, "scene_a__base.jpg"));
    await writeJpeg(path.join(sourceDir, "scene_a__tone_highlight_plus2.jpg"));

    const result = runImportScript([
      "--manifest",
      manifestPath,
      "--source-dir",
      sourceDir,
      "--oracle-dir",
      oracleDir,
      "--oracle-index",
      oracleIndexPath,
      "--source-type",
      "camera_engine_test_fixture",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.pass).toBe(true);
    expect(output.expected_entries).toBe(2);
    expect(output.imported_entries).toBe(2);
    expect(output.validated_entries).toBe(2);

    const indexPayload = JSON.parse(await readFile(oracleIndexPath, "utf8"));
    expect(indexPayload.source_type).toBe("camera_engine_test_fixture");
    expect(indexPayload.entries).toHaveLength(2);
    indexPayload.entries.forEach((entry: { source_type: string }) => {
      expect(entry.source_type).toContain("camera_engine");
    });
  });

  it("fails when one or more manifest pairs are missing from source exports", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const manifestPath = path.join(fixtureRoot, "calibration", "manifest.v1.json");
    const sourceDir = path.join(fixtureRoot, "camera-engine-exports");
    const oracleDir = path.join(fixtureRoot, "oracle-camera-engine-v1");
    const oracleIndexPath = path.join(oracleDir, "index.v1.json");

    await writeJson(manifestPath, {
      scenes: [
        {
          id: "scene_missing",
        },
      ],
      cases: [
        {
          id: "base",
        },
        {
          id: "tone_shadow_plus2",
        },
      ],
    });
    await writeJpeg(path.join(sourceDir, "scene_missing__base.jpg"));

    const result = runImportScript([
      "--manifest",
      manifestPath,
      "--source-dir",
      sourceDir,
      "--oracle-dir",
      oracleDir,
      "--oracle-index",
      oracleIndexPath,
      "--source-type",
      "camera_engine_test_fixture",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Missing camera oracle source files");
    expect(result.stderr).toContain("scene_missing/tone_shadow_plus2");
  });
});
