# Calibration Harness v1 (Bootstrap)

Date: 2026-02-19
Status: Bootstrap implementation (`NI-030` started)

## 1. Purpose

Provide a reproducible, manifest-driven calibration harness that:

1. renders deterministic CPU approximation outputs for scene/control sweeps
2. records or evaluates oracle artifacts
3. produces machine-readable metrics + markdown summary
4. applies threshold gates for CI-style evaluation

This is a bootstrap harness to operationalize `docs/engineering/calibration-oracle-protocol-v1.md`.

## 2. Entry Points

Root scripts:

1. `npm run calibration:record`
2. `npm run calibration:run`
3. `npm run calibration:dry-run`
4. `npm run calibration:baseline:lock`
5. `npm run calibration:baseline:refresh`
6. `npm run calibration:baseline:check`
7. `npm run calibration:oracle:index:check`
8. `npm run calibration:oracle:index:check:camera-engine`

Implementation:

1. `scripts/run-calibration-harness.mjs`
2. `calibration/manifest.v1.json`
3. `calibration/thresholds.v1.json`
4. `artifacts/calibration/oracle-v1/index.v1.json` (generated in `record` mode)

## 3. Modes

1. `record`
 - renders all manifest scene/case combinations
 - writes oracle JPEGs to `artifacts/calibration/oracle-v1`
 - writes oracle index contract to `artifacts/calibration/oracle-v1/index.v1.json` (scene/case -> file/hash/source)
 - writes run artifacts under `artifacts/calibration/runs/<timestamp>`

2. `evaluate`
 - renders manifest scene/case combinations
 - compares against existing oracle JPEGs
 - if oracle index exists, validates scene/case coverage and hash integrity
 - supports oracle source policy enforcement:
   - `npm run calibration:run -- --require-oracle-source camera_engine`
   - fails when index/source entries are not camera-engine tagged (`camera_engine*`)
 - writes metrics + summary artifacts under `artifacts/calibration/runs/<timestamp>`
 - exits non-zero when thresholds fail or oracle files are missing
 - optional regression compare:
   - `npm run calibration:run -- --baseline-metrics <path/to/metrics.json>`
   - fails when aggregate error metrics drift above `calibration/thresholds.v1.json` regression limits
   - fails when directional axis score drops beyond configured tolerance

3. `dry-run`
 - executes `record` then `evaluate`
 - intended as CI smoke coverage for harness reproducibility and threshold-check execution path

4. `baseline:check`
 - runs `evaluate` against locked baseline `calibration/baseline/metrics.v1.json`
 - intended for manual/local release-candidate validation before promoting CI gate strictness

5. `baseline:refresh`
 - executes `dry-run` and then locks latest run as baseline
 - intended for controlled baseline updates when rendering changes are intentionally accepted

6. `oracle:index:check`
 - validates `artifacts/calibration/oracle-v1/index.v1.json` against current manifest scene/case matrix
 - verifies hash integrity and file-path containment in oracle directory
 - optional strict source policy:
   - `npm run calibration:oracle:index:check:camera-engine`
   - fails when index/global source is not camera-engine tagged

## 4. Metrics (Current Bootstrap Set)

Per frame:

1. `mean_delta_e00`
2. `p95_delta_e00`
3. `luma_rmse`
4. `mean_chroma_error`
5. `mean_hue_drift_deg`
6. `mean_delta_e76` (legacy diagnostic)
7. `p95_delta_e76` (legacy diagnostic)
8. `mean_abs_rgb` (diagnostic)

Directional:

1. luma-direction correctness against baseline case for each axis
2. axis score by class (`critical`/`secondary`) using threshold config

## 5. Artifacts

Per run:

1. `metrics.json` (full machine-readable output)
2. `summary.md` (human-readable table summary)
3. `rendered/*.jpg` (candidate renders for trace/debug)
4. `diff/*.jpg` (candidate-vs-oracle false-color difference maps)

Baseline lock artifacts:

1. `calibration/baseline/metrics.v1.json`
2. `calibration/baseline/metadata.v1.json`

## 6. Known Gaps (Planned Follow-up)

1. Oracle sources are currently bootstrap file-based by default (`bootstrap_cpu_record`) and do not yet ingest X RAW STUDIO exports directly.
2. CI runs oracle-index integrity checks, but strict camera-engine source policy is not yet enabled as the default gate.
