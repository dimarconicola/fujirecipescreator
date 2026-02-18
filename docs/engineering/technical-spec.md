# Fuji Recipe Lab - Technical Specification (As Built)

Date: 2026-02-17  
Status: Active implementation spec (source-of-truth for current behavior)

## 1. Product Boundary

Fuji Recipe Lab is a browser-based, educational approximation tool for exploring recipe-style controls on fixed reference images.

Hard boundary:
- It is not a Fujifilm JPEG emulator.
- It currently renders with a procedural approximation pipeline.

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

## 4.2 Viewer Store (`apps/web/src/state/viewerStore.ts`)

Library: Zustand + `persist`
Storage: `sessionStorage` key `fuji-viewer-session-v1`

State:
- `selectedImageId`
- per-image transform `{ scale, offsetX, offsetY }`
- `compareMode`: `"after"` or `"split"`
- `splitPosition` clamped to `[0.1, 0.9]`

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

- image source: selected canonical image preview
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

Image tab strip:
- exactly 3 canonical image thumbnails
- compact cards (image-only thumbnails, no visible title text)

## 7. Rendering Pipeline Spec (Current)

Primary path:
- `ApproxWebglRenderer` (`webgl2` context required)

Fallback path:
- `ApproxCpuRenderer` (2D canvas)

Quality strategy:
- interactive render: scale `0.6`
- settle render: scale `1.0` after `260ms` debounce
- settled frames may be restored from cache when key matches

Uniform generation:
- `buildApproxUniforms` in `packages/engine-webgl/src/approxMath.ts`
- active profile `strength_scalars` are passed through render params and applied to:
  - tone curve response (`highlight`, `shadow`, `dynamic range compression`)
  - color chrome response
  - clarity response
  - noise-reduction response
  - grain response

Current procedural stages (no external LUT file ingestion):

1. Decode input (WebGL path linearizes by gamma 2.2)
2. Local blur/noise-reduction mix
3. Detail shaping (clarity + sharpness terms)
4. White balance multipliers from WB mode/kelvin + shifts
5. Highlight/shadow zonal shaping
6. Dynamic range compression (`dr100/dr200/dr400`)
7. Saturation adjustment from `color`
8. Film simulation branch (`provia`, `velvia`, `astia`, `classic_chrome`, `classic_neg`, `eterna`, `acros`, `mono`)
9. Color Chrome + Color Chrome Blue approximations
10. Grain injection (strength + size)
11. Clamp and output encode

Renderer status surfaced to footer:
- mode (`WebGL2` or `CPU fallback`)
- quality (`interactive` or settled)
- fallback warnings/errors
- QA diagnostics line with renderer mode, model/profile, compare mode, image id, and zoom level.

## 8. LUT Manifest and Legal Gate (Current)

Manifest source:
- `luts/manifest.json`

Domain gate:
- approved only when:
  - `approval_status = approved`
  - redistribution/modification/commercial flags are all `yes`

UI usage today:
- manifest data drives legal/credits messaging and approval reporting
- resolved LUT entries are **not** currently wired into the render shader/pipeline

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
- both clipboard-first in toolbar

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

## 11. Error Handling and Recovery

- Root `AppErrorBoundary` catches runtime errors and shows recovery UI.
- Recovery actions:
  - clear persisted state (`fuji-viewer-session-v1`, `fuji-recipes-v1`) and reload
  - reload only
- Share restore notice includes explicit "Recover Safe Defaults" flow.

## 12. Test and QA Contract

Root scripts:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run test:acceptance`

E2E:
- Playwright config runs Chromium, Firefox, WebKit
- base URL `http://127.0.0.1:4174`
- tests in `e2e/mvp-acceptance.spec.ts`

Unit coverage highlights:
- profile/recipe/lut/share schema behavior
- render math and render-dimension logic
- cache key stability and frame cache behavior
- app-level data adapters (credits/presets/luts)

## 13. Explicit Known Gaps

1. Runtime rendering uses canonical preview image assets, not full-resolution originals.
2. LUT files are not yet ingested into GPU/CPU render pipeline stages.
3. CPU and WebGL paths are intentionally approximate and not bit-identical.
