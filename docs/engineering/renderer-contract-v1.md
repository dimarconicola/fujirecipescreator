# Renderer Contract v1 (NI-007)

Date: 2026-02-17  
Status: Accepted  
Backlog item: `NI-007`

## Decision

The renderer truth model for v1 is **procedural-only approximation**.

This means:
- Runtime output is produced by procedural math in `@fuji/engine-webgl` (WebGL2 or CPU fallback).
- Profile `strength_scalars` are part of the procedural runtime calibration path.
- Runtime output does **not** currently ingest `.cube` LUT files.
- LUT manifest data remains in scope for legal gating, attribution, and policy-safe messaging.

## Why This Decision

1. Current implementation already uses procedural rendering only.
2. Current legal policy blocks official Fujifilm LUT redistribution.
3. Product framing is educational and approximate, not camera JPEG emulation.
4. Maintaining one explicit truth model avoids user and engineering ambiguity.

## Contract Rules

1. Any UI copy must not imply LUT files are actively applied in render output unless NI-008 is implemented.
2. Renderer behavior must be defined by:
- `apps/web/src/renderParams.ts`
- `packages/engine-webgl/src/approxMath.ts`
- `packages/engine-webgl/src/approxRenderer.ts`
- `packages/engine-webgl/src/cpuRenderer.ts`
3. LUT data behavior must be defined by:
- `packages/domain/src/lut.ts`
- `apps/web/src/data/luts.ts`
- `luts/manifest.json`
4. Approximation disclosure must remain visible and consistent with non-emulation framing.

## Non-Goals Under This Contract

1. No direct LUT texture sampling stage in the shader pipeline.
2. No claim of camera-JPEG matching accuracy.
3. No per-profile official LUT bundles in shipped runtime assets.

## Validation Checklist

- [x] Renderer pipeline docs match implementation (`docs/engineering/technical-spec.md`).
- [x] Footer/legal copy reflects legal gate behavior without implying LUT-based rendering.
- [x] Backlog updated to mark NI-007 complete and branch follow-up via NI-009/NI-008.

## Future Change Gate

If LUT-assisted rendering is pursued later:
- Implement NI-008 first (runtime LUT ingestion + tests proving visual effect differences by LUT choice).
- Then update this contract to v2 and revise product copy accordingly.
