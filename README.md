# Fuji Recipe Lab

Fuji Recipe Lab is an educational visual lab for exploring Fujifilm-style recipe controls on a fixed set of licensed reference images.

The goal is to help people understand how recipe choices affect tone, color, contrast, and texture before applying those ideas in real shooting workflows.

It is intentionally an **approximate** preview tool and does **not** emulate Fujifilm in-camera JPEG output.

## Product Intent

This project is intended to be:

- A fast recipe exploration workspace for desktop and iPad landscape use.
- A practical learning environment where parameter changes are immediately visible and comparable.
- A recipe development and sharing utility (save, compare, export, share) with transparent limitations.
- A legally-aware tool that exposes LUT attribution/policy state without claiming camera-accurate rendering.

This project is intentionally **not**:

- A camera JPEG emulator.
- A claim of 1:1 Fujifilm processing parity.
- A replacement for testing recipes on real photos and real camera output.

## Current Product Scope

- 3 canonical images with quick thumbnail switching.
- Camera model selector (`xtrans5`, `xtrans3`) with legacy import/share mapping for `xtrans4`.
- Parameter panel generated from profile contracts.
- Parameter locks are enforced for direct edits (locked controls are disabled).
- Coupled controls are auto-managed with explicit disable reasons (Kelvin-only WB Kelvin, grain-size coupling, monochrome color controls).
- Press-and-hold before preview and split screen compare.
- Hover-only in-view zoom controls (+ / - / reset).
- Recipe lifecycle: save, duplicate, A/B slots, copy/export text, copy JSON export, export LUT (`.cube`), share link.
- Photo metadata import: parse Fujifilm MakerNotes from local JPEG/RAF, review field mapping report, and apply normalized settings.
- Optional cloud sync via GitHub Gist push/pull (accepts gist ID or gist URL with input validation and trusted raw-host checks).
- Credits/attribution and LUT legal manifest visibility.
- Policy-gated LUT runtime controls (Off, Bundled Approved, User-Supplied `.cube`).

## Monorepo Layout

- `apps/web`: React + Vite web app.
- `packages/domain`: Zod-backed domain contracts (profiles, recipes, share payloads, LUT manifest).
- `packages/engine-webgl`: WebGL2 + CPU fallback approximation renderer.
- `profiles`: profile JSON contracts.
- `assets/images`: canonical image sources, previews, metadata.
- `luts`: LUT manifest + licensed community LUT files for legal/attribution tracking.
- `docs`: product, engineering, QA, and research documentation.

## Local Development

Requirements:
- Node.js 20+ (recommended)
- npm 10+

Install:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Quality gates:

```bash
npm run typecheck
npm run lint
npm run verify:provenance
npm run calibration:record
npm run calibration:run
npm run calibration:dry-run
npm run calibration:oracle:index:check
npm run calibration:oracle:index:check:camera-engine
npm run calibration:camera:oracle:import
npm run calibration:camera:oracle:import:dry-run
npm run calibration:camera:oracle:check
npm run calibration:camera:run
npm run calibration:camera:baseline:check
npm run calibration:camera:baseline:lock
npm run calibration:camera:baseline:refresh
npm run calibration:camera:gate
npm run calibration:baseline:lock
npm run calibration:baseline:refresh
npm run calibration:baseline:check
npm run test
npm run test:e2e
npm run test:acceptance
```

## Technical Notes

- Renderer truth model (current): procedural approximation with optional policy-gated LUT stage.
- LUT runtime modes:
  - `off` (default procedural-only behavior)
  - `bundled` (approved manifest entries with bundled assets)
  - `user_supplied` (local `.cube` import, not redistributed)
- WebGL2 is primary rendering path with CPU fallback when WebGL2 is unavailable.
- Calibration harness writes oracle index metadata (`artifacts/calibration/oracle-v1/index.v1.json`) for scene/case traceability.
- Oracle source policy can be enforced in calibration runs (`--require-oracle-source camera_engine`) to block non-camera-engine oracle entries.
- Camera-engine oracle workflow:
  - import camera exports into strict oracle index via `npm run calibration:camera:oracle:import`
  - validate strict policy via `npm run calibration:camera:oracle:check`
  - run evaluate path against camera oracle via `npm run calibration:camera:run`
  - enforce release gate (oracle + baseline required) via `npm run calibration:camera:gate`
- CI strictness:
  - set repository variable `CAMERA_CALIBRATION_REQUIRED=true` to require camera gate on every CI run

See:
- `docs/engineering/technical-spec.md`
- `docs/engineering/renderer-contract-v1.md`
- `docs/engineering/renderer-contract-v2.md`
- `docs/engineering/calibration-oracle-protocol-v1.md`
- `docs/engineering/calibration-harness-v1.md`
- `docs/engineering/makernotes-import-mvp-spec.md`
- `docs/research/asset-provenance-ledger-v1.md`
- `docs/research/camera-connectivity-feasibility-v1.md`
- `docs/engineering/next-iteration-backlog.md`
