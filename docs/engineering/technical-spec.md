# Fuji Recipe Lab - Technical Specification (As Built)

Date: 2026-02-18
Status: Active implementation spec (as-built) + research-informed target direction

## 1. Product Boundary

Fuji Recipe Lab is a browser-based, educational approximation tool for exploring recipe-style controls on fixed reference images.

Hard boundary:
- It is not a Fujifilm JPEG emulator.
- It currently renders with a procedural approximation pipeline.

Accuracy contract (research-aligned wording):
- The product should be positioned as an educational visualizer anchored to first-party references and empirical calibration against camera-engine outputs.
- The product must not claim bit-exact parity with Fujifilm in-camera JPEG rendering.

## 2. Runtime and Build Stack

## Workspace

- Monorepo: npm workspaces
- Root package: `fujirecipescreator@0.1.0`

## Packages

- `apps/web`: React app (`@fuji/web`)
- `packages/domain`: domain contracts (`@fuji/domain`)
- `packages/engine-webgl`: render engine (`@fuji/engine-webgl`)

## Core Dependencies

- React `18.3.1`
- Zustand `5.0.3`
- Vite `5.4.10`
- TypeScript `5.7.3`
- Zod `3.24.2`
- Vitest `2.1.8`
- Playwright `1.58.2`
- exifr `7.1.3` (MakerNotes extraction)
- fuji-recipes `1.0.2` (Fujifilm MakerNotes decoding)

## Entry and Build

- App entry: `apps/web/src/main.tsx`
- Vite aliases:
  - `@fuji/domain -> packages/domain/src/index.ts`
  - `@fuji/engine-webgl -> packages/engine-webgl/src/index.ts`
- Static assets served from workspace `assets` directory via Vite `publicDir`.

## 3. Application Composition

Top-level app composition (`apps/web/src/App.tsx`):

1. Header (`Fuji Recipe Lab`) + Learn button + Approx badge
2. Notice panel(s):
- share restore status
- compatibility warnings
3. Main two-column layout:
- `ImageViewer`
- `ParameterPanel`
4. `RecipeToolbar`
5. `PresetGallery`
6. `CreditsPanel`
7. `LearnOverlay`
8. Footer diagnostics/disclosure

Layout behavior:
- switches to single column below `1180px` viewport width via `matchMedia`.
- preset preview rendering is lazy (starts when gallery opens) and chunked to reduce main-thread pressure.

## 4. State Architecture

## 4.1 Parameter Store (`apps/web/src/state/parameterStore.ts`)

Library: Zustand (non-persisted)

State:
- `profile`
- `params`
- `locks` for each param key
- `compatibilityIssues`

Actions:
- `setParam`, `setWbShift`
- `replaceParams`
- `randomizeWithinSafeBounds`
- `resetParam`, `resetAll`
- `toggleLock`
- `applyProfile`

Behavior rules:
- All param writes are normalized against active profile constraints.
- Locked params are preserved across profile switches only if still valid in target profile.
- Default startup profile is `xtrans5`.
- Coupled auto-management is enforced in normalization:
  - `grain=off` forces default `grain_size`.
  - `wb != kelvin` forces default `wb_kelvin`.
  - monochrome film sims (`acros`/`mono`) force neutral color-family controls (`color`, `chrome`, `chrome_blue`).

## 4.2 Viewer Store (`apps/web/src/state/viewerStore.ts`)

Library: Zustand + `persist`
Storage: `sessionStorage` key `fuji-viewer-session-v2`

State:
- `selectedImageId`
- per-image transform `{ scale, offsetX, offsetY }`
- `compareMode`: `"after"` or `"split"`
- `splitPosition` clamped to `[0.1, 0.9]`

Persisted fields:
- `selectedImageId`
- `compareMode`
- `splitPosition`

Non-persisted (runtime-only):
- per-image transforms (zoom/pan)

Transform rules:
- scale clamped to `[1, 4]`
- reset sets transform to `{ scale: 1, offsetX: 0, offsetY: 0 }`

## 4.3 Recipe Store (`apps/web/src/state/recipeStore.ts`)

Library: Zustand + `persist`
Storage: `localStorage` key `fuji-recipes-v1`

State:
- `recipes[]` (validated `Recipe`)
- `activeRecipeId`
- `recipeName`
- A/B slot snapshots (`A`, `B`)

Capabilities:
- save/update active recipe
- duplicate recipe
- load recipe
- store/apply A/B slots
- export/import snapshot payload for cloud sync

## 5. Data Contracts

## 5.1 Profiles

Profile schema defined in `packages/domain/src/profile.ts`.

Loaded profile files:
- `profiles/xtrans3.json`
- `profiles/xtrans4.json`
- `profiles/xtrans5.json`

Visible model selector options in UI:
- `xtrans5` -> label `X-T5 / X-H2 / X-S20`
- `xtrans3` -> label `X-T3 / X-T30`

Legacy mapping:
- incoming `xtrans4` is normalized to `xtrans5` for restore/import flows.

## 5.2 Recipe Params

Canonical recipe param keys:
- `film_sim`
- `dynamic_range`
- `highlight`
- `shadow`
- `color`
- `chrome`
- `chrome_blue`
- `clarity`
- `sharpness`
- `noise_reduction`
- `grain`
- `grain_size`
- `wb`
- `wb_kelvin`
- `wb_shift { a_b, r_b }`

## 5.3 Share Payload

Version: `v=1` (`SHARE_PAYLOAD_VERSION`)

Schema (`packages/domain/src/share.ts`):
- `v`
- `profile_id`
- `base_image_id`
- `params`

Encoding:
- JSON -> base64url
- query params:
  - `v`: version
  - `s`: encoded payload

## 5.4 Render Cache Key

`computeRenderCacheKey` uses stable deterministic serialization over:
- `imageId`
- `profileId`
- `params`
- `mode` (`interactive` or `settle`)

`RenderFrameCache` is an in-memory LRU-like map with max 32 entries.

## 6. Viewer and UX Interaction Contract

`ImageViewer` behavior:

- image source strategy:
  - preview-first decode for responsive first paint
  - background full-source decode when available
  - settle pass upgrades to full-source data when loaded
- compare modes:
  - default `after`
  - split mode with draggable divider
  - press-and-hold before preview (only when not in split mode)
- zoom:
  - mouse wheel zoom is not implemented
  - zoom is button-driven only (`+`, `-`, `Reset`)
  - controls are rendered inside the viewport overlay
  - controls become interactive only while viewer is hovered
- pan:
  - drag-to-pan only active when `scale > 1`
- split interaction:
  - divider drag updates normalized split position
- loading:
  - viewer shows an in-viewport loading indicator while the selected source image is decoding

Image tab strip:
- exactly 3 canonical image thumbnails
- compact cards (image-only thumbnails, no visible title text)

Parameter panel UX:
- each parameter row has an inline info button (`i`) that toggles explanatory help text

## 7. Rendering Pipeline Spec (Current)

Primary path:
- `ApproxWebglRenderer` (`webgl2` context required)

Fallback path:
- `ApproxCpuRenderer` (2D canvas)

Quality strategy:
- interactive render: scale `0.6`
- settle render: runs after `260ms` debounce with capped max source dimension (`2400`) to preserve responsiveness while increasing resolved detail over preview-only rendering
- settled frames may be restored from cache when key matches

Uniform generation:
- `buildApproxUniforms` in `packages/engine-webgl/src/approxMath.ts`
- active profile `strength_scalars` are passed through render params and applied to:
  - tone curve response (`highlight`, `shadow`, `dynamic range compression`)
  - color chrome response
  - clarity response
  - noise-reduction response
  - grain response

Current operator stages:

1. `detail_spatial` (local blur/noise-reduction + clarity/sharpness)
2. `tone_curve` (WB multipliers, highlight/shadow zonal shaping, DR compression, saturation)
3. `film_sim` (`provia`, `velvia`, `astia`, `classic_chrome`, `classic_neg`, `eterna`, `acros`, `mono`)
4. `color_chrome` (Color Chrome + Color Chrome Blue approximations)
5. `control_coupling` (explicit no-op stage in renderer; coupling logic remains state-normalization-driven)
6. `lut` (optional runtime LUT stage: `off`, `bundled`, `user_supplied`)
7. `grain` (amount + size modulation)
8. Clamp and output encode

Renderer status surfaced to footer:
- mode (`WebGL2` or `CPU fallback`)
- quality (`interactive` or settled)
- fallback warnings/errors
- QA diagnostics line with renderer mode, model/profile, compare mode, image id, zoom level, LUT mode key, active operator stage path, and (for WebGL) shader stage-function path.

Color-management primitives (engine core, not yet wired into active runtime render path):
- `packages/engine-webgl/src/colorManagement.ts`
- Implements:
  - F-Log / F-Log2 / F-Log2C encode/decode transfer functions
  - Rec.709 <-> F-Gamut / F-Gamut C matrix transforms
  - CPU and WebGL-reference parity helpers for staged color-space roundtrip checks
- Covered by unit tests:
  - `packages/engine-webgl/test/color-management.test.ts`

Operator-graph observability:
- CPU path exposes ordered per-stage samples via `evaluateCpuOperatorGraph(...)` in `packages/engine-webgl/src/operatorGraph.ts`.
- WebGL shader path now uses explicit stage functions (`stageDetailSpatial` -> `stageToneCurve` -> `stageFilmSim` -> `stageColorChrome` -> `stageControlCoupling` -> `stageLut` -> `stageGrain`), with source-order checks in `packages/engine-webgl/test/operator-graph.test.ts`.
- Runtime diagnostics now use shared helpers (`getOperatorStagePath(...)`, `getWebglOperatorShaderStagePath(...)`) to prevent App/footer stage drift from engine definitions.

## 8. LUT Manifest and Legal Gate (Current)

Manifest source:
- `luts/manifest.json`

Domain gate:
- approved only when:
  - `approval_status = approved`
  - redistribution/modification/commercial flags are all `yes`

UI usage today:
- manifest data drives legal/credits messaging, approval reporting, and bundled runtime LUT resolution
- approved bundled entries are wired into runtime render path through policy-gated LUT mode controls (`off`/`bundled`/`user_supplied`)

## 9. Assets

Canonical image IDs:
- `landscape_v1`
- `portrait_v1`
- `night_v1`

Metadata source:
- `assets/images/metadata/*.json`

Image registry:
- `apps/web/src/data/images.ts`

Credits surfaces:
- in-app panel (`CreditsPanel`)
- repository file `CREDITS.md`

## 10. Export, Share, and Cloud Sync

Export:
- text export via `formatRecipeExportAsText`
- JSON export via `formatRecipeExportAsJson`
- toolbar supports both clipboard copy and file download:
  - text (`.txt`)
  - JSON (clipboard)
  - approximate LUT (`.cube`) generated from current approximation uniforms (educational export, not camera-accurate LUT output)

Share:
- `buildShareLink` appends `v` and `s`
- on load, app decodes and applies payload
- unsupported legacy model IDs are normalized (`xtrans4 -> xtrans5`)

Cloud sync:
- GitHub Gist `PATCH` for push, `GET` for pull
- config fields:
  - token
  - gist ID (or gist URL, normalized at runtime)
  - filename (default `fuji-recipes-sync-v1.json`)
- validation:
  - gist input must normalize to a hex gist ID
  - filename must not include path separators
  - truncated gist `raw_url` pulls are restricted to trusted GitHub raw hosts over HTTPS
- pulled payload supports wrapper format:
  - `{ version: 1, exported_at, data }`
  - or raw snapshot object

Photo metadata import (MakerNotes MVP):
- local-only file input path in `RecipeToolbar`
- parser chain:
  - `exifr.parse(..., { makerNote: true })`
  - `fuji-recipes` decode of MakerNotes payload
- mapped output:
  - partial recipe patch + per-field mapping status (`mapped_exact`, `mapped_normalized`, `unsupported`, `missing`)
  - suggested model hint (currently `xtrans5` when imported settings require unsupported `xtrans3` controls)
- apply flow:
  - preview mapping report, optional copy report text, apply normalized patch into active recipe state.

LUT runtime (policy-gated):
- LUT sources:
  - bundled approved assets declared in `luts/manifest.json` and bundled into `apps/web/src/data/luts.ts`
  - user-supplied local `.cube` files parsed client-side
- runtime controls:
  - viewer-panel mode selector: `off` | `bundled` | `user_supplied`
  - user LUT file picker + clear action
- render integration:
  - `.cube` parsing + trilinear sampling support (17/33/65)
  - WebGL path uses a packed strip texture + shader trilinear LUT stage
  - CPU fallback path applies same LUT stage through shared sampler helpers
  - render cache key includes LUT mode signature to prevent stale frame reuse
  - CPU render path is decomposed through explicit operator graph stages (`packages/engine-webgl/src/operatorGraph.ts`)
  - operator ownership mapping is explicit in code (`APPROX_PARAM_OPERATOR_CLASS`) to classify controls by `color/spatial/conditional/grain`

## 11. Error Handling and Recovery

- Root `AppErrorBoundary` catches runtime errors and shows recovery UI.
- Recovery actions:
  - clear persisted state (`fuji-viewer-session-v1` legacy, `fuji-viewer-session-v2`, `fuji-recipes-v1`) and reload
  - reload only
- Share restore notice includes explicit "Recover Safe Defaults" flow.

## 12. Test and QA Contract

Root scripts:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run test:acceptance`
- `npm run calibration:record`
- `npm run calibration:run`
- `npm run calibration:dry-run`
- `npm run calibration:oracle:index:check`
- `npm run calibration:oracle:index:check:camera-engine`
- `npm run calibration:baseline:lock`
- `npm run calibration:baseline:refresh`
- `npm run calibration:baseline:check`

E2E:
- Playwright config runs Chromium, Firefox, WebKit
- base URL `http://127.0.0.1:4174`
- tests in `e2e/mvp-acceptance.spec.ts`

Unit coverage highlights:
- profile/recipe/lut/share schema behavior
- render math and render-dimension logic
- cache key stability and frame cache behavior
- app-level data adapters (credits/presets/luts)
- operator-graph stage-path helpers and WebGL stage-function ordering parity checks
- calibration harness (NI-030 bootstrap) computes DeltaE00 frame metrics and supports optional baseline regression comparison via `--baseline-metrics`
- calibration harness record/evaluate flow now writes and validates oracle index contracts (`index.v1.json`) with scene/case hash integrity checks
- calibration harness/source validator supports explicit oracle source policy gating (`--require-oracle-source camera_engine`) for camera-engine-only enforcement

## 13. Explicit Known Gaps

1. Full-source settle is currently capped by a max settle dimension (`2400`) and does not yet run true uncapped full-resolution rendering for very large sources.
2. Bundled LUT coverage is intentionally limited to manifest-approved, distributable assets; blocked entries are legal-only metadata and never loaded at runtime.
3. CPU and WebGL paths are intentionally approximate and not bit-identical.

## 14. Research-Aligned V2 Direction (Proposed)

Reference:
- `deep-research-report.md` (2026-02-18)
- `docs/engineering/renderer-contract-v2.md`
- `docs/engineering/calibration-oracle-protocol-v1.md`
- `docs/engineering/calibration-harness-v1.md`

### 14.1 Target Color Pipeline Contract

Proposed high-fidelity pipeline stages:

1. Input normalization to a documented source domain.
2. Optional Fujifilm log encoding stage (`F-Log` / `F-Log2` / `F-Log2C`) and matching gamut assumptions (`F-Gamut` / `F-Gamut C`).
3. Film Simulation 3D LUT stage (`.cube`, 17/33/65 support).
4. Separable recipe-operator stages (tone, chrome, clarity/sharpness, grain, etc.).
5. Output transform to display-referred target (documented monitor/output assumptions).

### 14.2 Operator Decomposition Rules

Controls should be modeled by operation class, not a single monolithic LUT:

- Color transforms: film simulation, tone curve response, color/chrome adjustments.
- Spatial/detail operators: clarity/sharpness style operations.
- Noise synthesis: grain amount/size.
- Conditional/coupled logic: DR priority style automatic interactions with tone/dynamic range controls.

### 14.3 Calibration Contract

Calibration should use camera-engine outputs as the oracle (X RAW STUDIO and/or in-camera RAW conversion outputs):

- Build controlled parameter sweeps across representative scenes.
- Compare Lab output against camera-engine output per control change.
- Fit per-control mapping functions for directional and magnitude realism.
- Enforce regression thresholds in automated tests.

### 14.4 Metadata and Interoperability Direction

Planned feature direction:

- Import recipe settings from JPEG/RAF metadata (MakerNotes), mapping known tags (film mode, highlight/shadow, DR, WB shifts, grain/chrome settings where available) into app state.
- Keep parsing contract explicit and versioned; treat MakerNotes mapping tables as canonical references.

### 14.5 Legal and Compliance Contract

Implementation constraints:

- Treat "publicly downloadable LUT" and "redistributable LUT" as separate legal states.
- Maintain per-asset provenance and license metadata for LUT/recipe/media artifacts.
- Keep runtime modes explicit:
  - bundled LUT mode (only legally cleared assets),
  - user-provided LUT mode (if redistribution is restricted).
