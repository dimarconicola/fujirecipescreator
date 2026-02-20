# Asset Provenance Ledger v1

Date: 2026-02-19  
Status: Active ledger (`NI-033` baseline)

Purpose:
1. Track provenance, licensing, approval, and runtime usage scope for distributed image/LUT assets.
2. Separate "downloadable" from "redistributable" policy outcomes.
3. Support auditability for release gating.

## 1. Canonical Image Assets

| Asset ID | Local Paths | Source URL | License | Attribution Requirement | Redistribution/Commercial | Approval | Runtime Usage Scope | Notes |
|---|---|---|---|---|---|---|---|---|
| `landscape_v1` | `assets/images/full/landscape_v1.jpg`, `assets/images/preview/landscape_v1.jpg`, `assets/images/metadata/landscape_v1.json` | [Wikimedia source](https://commons.wikimedia.org/wiki/File:Landscape_Picture.jpg) | CC BY-SA 4.0 | Required | Allowed with license terms | approved | Canonical viewer input image | Author: `Smith609` |
| `portrait_v1` | `assets/images/full/portrait_v1.jpg`, `assets/images/preview/portrait_v1.jpg`, `assets/images/metadata/portrait_v1.json` | [Pexels photo 415829](https://www.pexels.com/photo/415829/) | Pexels License | Not required (source retained) | Allowed under Pexels terms | approved | Canonical viewer input image | Author string tracked in metadata |
| `night_v1` | `assets/images/full/night_v1.jpg`, `assets/images/preview/night_v1.jpg`, `assets/images/metadata/night_v1.json` | [Pexels photo 3075993](https://www.pexels.com/photo/3075993/) | Pexels License | Not required (source retained) | Allowed under Pexels terms | approved | Canonical viewer input image | Author string tracked in metadata |

## 2. LUT Manifest Assets

Source of truth: `luts/manifest.json`.

| LUT ID | Local Path | Source URL | License Basis | Redistribution/Commercial | Approval | Runtime Usage Scope | Notes |
|---|---|---|---|---|---|---|---|
| `official_fuji_xt4_pack_v12` | not bundled | [Fujifilm LUT index](https://www.fujifilm-x.com/global/support/download/lut/) | Fujifilm website terms | no / no | blocked | Legal reference only | Explicitly blocked by policy decision record |
| `official_fuji_xt30iiiii_pack_v101` | not bundled | [Fujifilm LUT index](https://www.fujifilm-x.com/global/support/download/lut/) | Fujifilm website terms | no / no | blocked | Legal reference only | Explicitly blocked by policy decision record |
| `community_a6000_vivid_1` | `luts/community/a6000-LUTs-master/a6000 vivid_1.C0006.cube` | [GitHub source](https://github.com/jonmatifa/a6000-LUTs) | CC0-1.0 | yes / yes | approved | Legal/education manifest scope | Not Fuji-branded, teaching fallback |
| `community_a6000_slog2_1` | `luts/community/a6000-LUTs-master/a6000 slog2_1.C0006.cube` | [GitHub source](https://github.com/jonmatifa/a6000-LUTs) | CC0-1.0 | yes / yes | approved | Legal/education manifest scope | Not currently applied in renderer |
| `community_a6000_slog3_1` | `luts/community/a6000-LUTs-master/a6000 slog3_1.C0006.cube` | [GitHub source](https://github.com/jonmatifa/a6000-LUTs) | CC0-1.0 | yes / yes | approved | Legal/education manifest scope | Not currently applied in renderer |

## 3. Calibration Asset Status

Calibration oracle datasets are not distributed in-repo (`artifacts/` is ignored), but local bootstrap generation is supported.

Bootstrap camera-oracle seed:
1. Command: `npm run calibration:camera:bootstrap`
2. Inputs: approved canonical scene assets from Section 1 (Wikimedia + Pexels licenses).
3. Generated outputs: scene/case calibration JPEG set under `artifacts/calibration/oracle-camera-engine-v1`.
4. Source tag: `camera_engine_bootstrap_seed` (explicitly educational seed, not first-party camera-engine parity evidence).
5. Approval: allowed for local CI/dev strict-gate bootstrapping only; not a replacement for true camera-engine export dataset in release accuracy claims.

Release rule:
1. Any new calibration image, LUT, or reference artifact must be added here before merge.
2. Entries must include source URL, license basis, approval status, and runtime/tooling usage scope.

## 4. Audit Checklist

Before release:
1. Every shipped asset has `approved` status.
2. Every blocked asset has explicit rationale and non-runtime scope.
3. Credits and required attribution text match source metadata records.
4. LUT policy doc and manifest state are consistent.
