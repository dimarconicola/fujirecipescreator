import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { afterEach, describe, expect, it } from "vitest";

const WORKSPACE_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const BOOTSTRAP_CAMERA_ASSETS_SCRIPT = fileURLToPath(
  new URL("../../../scripts/bootstrap-camera-calibration-assets.mjs", import.meta.url),
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
  const directoryPath = await mkdtemp(path.join(os.tmpdir(), "fuji-camera-bootstrap-test-"));
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
      data: Buffer.from([80, 140, 200, 255]),
    },
    90,
  );
  await writeFile(filePath, encoded.data);
}

function runBootstrapScript(args: string[]) {
  return spawnSync("node", [BOOTSTRAP_CAMERA_ASSETS_SCRIPT, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
  });
}

describe("bootstrap camera calibration assets script", () => {
  it("passes in dry-run mode when manifest source images already exist", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const manifestPath = path.join(fixtureRoot, "calibration", "manifest.v1.json");
    const metadataIndexPath = path.join(fixtureRoot, "assets", "images", "metadata", "index.json");
    const metadataPath = path.join(
      fixtureRoot,
      "assets",
      "images",
      "metadata",
      "scene_bootstrap.json",
    );
    const sourceImagePath = path.join(
      fixtureRoot,
      "assets",
      "images",
      "full",
      "scene_bootstrap.jpg",
    );

    await writeJpeg(sourceImagePath);
    await writeJson(manifestPath, {
      scenes: [
        {
          id: "scene_bootstrap",
          source_path: sourceImagePath,
        },
      ],
      cases: [
        {
          id: "baseline",
          overrides: {},
        },
      ],
    });
    await writeJson(metadataIndexPath, {
      images: [
        {
          image_id: "scene_bootstrap",
          metadata_path: metadataPath,
        },
      ],
    });
    await writeJson(metadataPath, {
      image_id: "scene_bootstrap",
      direct_asset_url: "https://example.test/scene_bootstrap.jpg",
      source_url: "https://example.test/scene_bootstrap",
    });

    const result = runBootstrapScript([
      "--dry-run",
      "--manifest",
      manifestPath,
      "--metadata-index",
      metadataIndexPath,
      "--record-oracle-dir",
      path.join(fixtureRoot, "oracle-record"),
      "--camera-oracle-dir",
      path.join(fixtureRoot, "oracle-camera"),
      "--skip-gate-validate",
    ]);

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.pass).toBe(true);
    expect(output.dry_run).toBe(true);
    expect(output.executed_steps).toContain("calibration:record");
    expect(output.executed_steps).toContain("camera:oracle:import");
    expect(output.scene_sources.existing.length).toBe(1);
  });

  it("fails when source image is missing and download is disabled", async () => {
    const fixtureRoot = await createTempFixtureDir();
    const manifestPath = path.join(fixtureRoot, "calibration", "manifest.v1.json");
    const metadataIndexPath = path.join(fixtureRoot, "assets", "images", "metadata", "index.json");
    const metadataPath = path.join(
      fixtureRoot,
      "assets",
      "images",
      "metadata",
      "scene_missing.json",
    );
    const missingSourcePath = path.join(
      fixtureRoot,
      "assets",
      "images",
      "full",
      "scene_missing.jpg",
    );

    await writeJson(manifestPath, {
      scenes: [
        {
          id: "scene_missing",
          source_path: missingSourcePath,
        },
      ],
      cases: [
        {
          id: "baseline",
          overrides: {},
        },
      ],
    });
    await writeJson(metadataIndexPath, {
      images: [
        {
          image_id: "scene_missing",
          metadata_path: metadataPath,
        },
      ],
    });
    await writeJson(metadataPath, {
      image_id: "scene_missing",
      direct_asset_url: "https://example.test/scene_missing.jpg",
      source_url: "https://example.test/scene_missing",
    });

    const result = runBootstrapScript([
      "--dry-run",
      "--skip-download",
      "--manifest",
      manifestPath,
      "--metadata-index",
      metadataIndexPath,
      "--skip-gate-validate",
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unable to resolve");
    expect(result.stderr).toContain("scene_missing");
  });
});
