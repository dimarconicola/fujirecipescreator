# Next Iteration Backlog

Date: 2026-02-18
Status: Proposed execution backlog for next delivery cycle  
Scope: Stabilization + product-contract alignment after latest UX/render updates, plus research-driven realism roadmap

## Planning Assumptions

1. Priority scale:
- `P0`: must complete before next release cut.
- `P1`: high-value hardening for release confidence.
- `P2`: quality improvements that can follow.

2. Effort scale:
- `S`: <= 0.5 day
- `M`: 1-2 days
- `L`: 3-5 days

3. Status scale:
- `todo`
- `in_progress`
- `blocked`
- `done`

## P0: Release-Critical Alignment

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-001 | P0 | Update product requirements to match current compare UX (split toggle + press/hold before) and current model selector behavior. | Product/Docs | S | none | `docs/product/requirements-v1.md` no longer references removed before/after toggle mode or mandatory visible X-Trans IV selector path. | done |
| NI-002 | P0 | Update engineering backlog and acceptance docs to remove stale compare/profile assumptions. | Product/Docs | S | NI-001 | `docs/engineering/mvp-backlog.md`, `docs/engineering/acceptance-testing.md`, and `docs/qa/cross-browser-validation-2026-02-17.md` reflect current behavior and tests. | done |
| NI-003 | P0 | Fix runtime default-profile inconsistency (store default should match visible model options). | Frontend | S | none | App initial state does not start from hidden model profile; no auto-switch message appears on first load. | done |
| NI-004 | P0 | Apply shared profile/model mapping for share-link restore and cloud pull import flows. | Frontend | M | NI-003 | Incoming `xtrans4` payloads are safely normalized to supported visible model options with deterministic user messaging and no mismatch loop. | done |
| NI-005 | P0 | Align e2e fixtures with visible model strategy (avoid hidden profile IDs unless explicitly testing migration behavior). | QA/Frontend | S | NI-004 | E2E tests pass without relying on hidden model assumptions in normal-path scenarios. | done |
| NI-006 | P0 | Resolve metadata placeholder authors for Pexels assets and sync credits text. | Product/Docs | S | none | `assets/images/metadata/*.json` and `CREDITS.md` contain finalized attribution strings with no placeholder language. | done |

## P1: Product and Engineering Hardening

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-007 | P1 | Decide renderer truth model: procedural-only vs LUT-assisted. Document the selected strategy and constraints. | Product/Rendering | M | NI-001 | A single documented renderer contract exists and matches implementation and UI copy. | done |
| NI-008 | P1 | If LUT-assisted path is chosen, implement actual LUT ingestion in engine and wire `resolveActiveLut` output into render pipeline. | Rendering | L | NI-007 | Film-sim output path consumes LUT assets in runtime (or build-time baked equivalent) with tests proving effect changes by LUT selection. | blocked |
| NI-009 | P1 | If procedural-only path is chosen, remove or demote LUT “active usage” messaging to avoid implying LUT-based rendering. | Frontend/Docs | S | NI-007 | Footer/legal text accurately describes what LUT manifest does and does not affect in rendered output. | done |
| NI-010 | P1 | Apply `strength_scalars` from profile contracts into render parameter mapping. | Rendering | M | NI-007 | Switching profiles changes calibrated response curves through configured scalar multipliers; covered by unit tests. | done |
| NI-011 | P1 | Add targeted interaction tests for viewer behavior (hover zoom controls, long-press before, split drag). | QA/Frontend | M | NI-003 | Automated tests assert critical pointer interactions and prevent regressions on reported UX bugs. | done |
| NI-012 | P1 | Add e2e coverage for share-link restoration with model migration cases. | QA | M | NI-004 | E2E validates both same-profile restore and cross-profile fallback mapping behavior. | done |
| NI-013 | P1 | Expand CI to run acceptance gate (`test:acceptance`) on PRs or scheduled workflow. | DevOps/QA | M | NI-011, NI-012 | CI fails on e2e regressions, not only unit/build regressions. | done |
| NI-014 | P1 | Correct CI branch triggers to include the active default branch policy. | DevOps | S | none | `.github/workflows/ci.yml` triggers are aligned with active branch strategy and verified by test PR. | done |

Decision note (2026-02-17):
- NI-007 selected the procedural-only renderer contract (see `docs/engineering/renderer-contract-v1.md`) for v1 baseline; subsequent v2 work (`NI-024..NI-028`) introduced optional policy-gated LUT runtime stages.
- NI-010 implemented profile scalar calibration in runtime render mapping and added unit coverage.
- NI-011 added explicit Playwright coverage for hover zoom controls, long-press before preview, and split-divider drag behavior.
- NI-012 added explicit Playwright share-link restoration coverage for same-profile and legacy-profile migration flows.
- NI-013 wired `test:acceptance` into CI after Playwright browser installation.
- NI-014 verified via PR #1 (`codex/ci-trigger-probe -> main`) with successful `pull_request` CI run: https://github.com/dimarconicola/fujirecipescreator/actions/runs/22131422404; CI branch policy is now `main` + `codex/**`.
- NI-015 completed with lazy + chunked preset preview rendering, telemetry, and Playwright responsiveness coverage across Chromium/Firefox/WebKit.
- NI-016 removed unused slider sweep component/logic/tests from the codebase.
- NI-017 added a dedicated footer QA diagnostics line with renderer mode, model/profile, compare mode, image, and zoom context.
- NI-018 added Playwright screenshot baselines for split-divider + hover-control states across Chromium/Firefox/WebKit.
- NI-019 replaced split compare `clip-path` cropping with a mask-container implementation to reduce drag jitter/glitch artifacts across browsers.
- NI-020 strengthened Color Chrome / Color Chrome Blue response curves (CPU + WebGL parity) and tightened renderer tests to assert perceptible chroma shift magnitude.
- NI-021 enforced parameter lock behavior for direct manual edits and disabled locked controls in the parameter panel UI.
- NI-028 completed runtime LUT integration with policy-gated `off/bundled/user_supplied` mode controls, shared CPU/WebGL LUT stage helpers, and deterministic cache-key coverage.
- NI-029 began with explicit CPU operator graph decomposition (`tone_curve -> detail_spatial -> film_sim -> color_chrome -> control_coupling -> lut -> grain`) and stage metadata export for testability.
- NI-029 continuation added parameter-to-operator class mapping and explicit `color/spatial/conditional/grain` stage taxonomy.
- NI-029 continuation added CPU per-stage sample tracing (`evaluateCpuOperatorGraph`) and explicit WebGL stage-function ordering with parity tests guarding shader stage sequence.
- NI-029 continuation added shared runtime stage-path helpers consumed by app QA diagnostics, plus explicit WebGL stage-id -> shader-function mapping metadata.
- NI-030 started with a manifest-driven calibration harness bootstrap (`scripts/run-calibration-harness.mjs`) plus threshold/config files (`calibration/manifest.v1.json`, `calibration/thresholds.v1.json`) and run commands (`calibration:record`, `calibration:run`), now using DeltaE00 frame gates with optional baseline regression comparison.
- NI-030 bootstrap also adds CI smoke coverage via `calibration:dry-run` in `.github/workflows/ci.yml`.
- NI-030 adds baseline-governance tooling (`scripts/lock-calibration-baseline.mjs`, `calibration/baseline/*`) with lock/check commands for manual release-candidate regression validation.
- NI-030 now emits per-frame false-color diff strips (`artifacts/calibration/runs/<run>/diff/*.jpg`) and includes baseline refresh command (`calibration:baseline:refresh`) for controlled baseline promotion.
- NI-030 now writes/validates oracle index contracts (`artifacts/calibration/oracle-v1/index.v1.json`) with scene/case coverage and SHA256 integrity checks during evaluate runs.
- NI-030 now includes explicit oracle-source policy enforcement (`--require-oracle-source camera_engine`) and standalone index validation commands (`calibration:oracle:index:check*`) with CI oracle-index integrity checks.
- NI-030 now adds camera-engine oracle import tooling (`scripts/import-camera-oracle.mjs`) and strict camera-path scripts (`calibration:camera:*`) with CI camera gate modes: conditional-by-artifact or required via `CAMERA_CALIBRATION_REQUIRED=true`.
- NI-030 continuation hardens `calibration:camera:gate` with baseline metadata policy/path validation plus `--validate-only` and explicit artifact-path override options, and adds integration tests for both gate contract checks and camera-oracle import success/failure paths.
- NI-030 continuation adds `calibration:camera:bootstrap` to source missing canonical scene assets from approved metadata URLs and generate a full strict camera-oracle bootstrap dataset/baseline locally when first-party camera exports are unavailable.
- NI-030 continuation adds optional bootstrap-source rejection in camera gate (`--disallow-bootstrap-source`) and CI variable plumbing (`CAMERA_CALIBRATION_DISALLOW_BOOTSTRAP=true`) for release workflows that require non-bootstrap oracle provenance.
- UX follow-up applied immediate fixes: per-parameter inline info buttons, viewer image loading indicator, and stronger highlight tone response curve.
- NI-035 started with preview-first/full-source progressive settle in `ImageViewer`, including capped full-source settle dimension to preserve interaction/screenshot stability while increasing resolved detail.
- NI-035 continuation now prepares capped full-source settles via async `createImageBitmap` downsampling (canvas fallback), emits explicit `data-settle-source=full_resampled` telemetry when needed, adds full-source settle status telemetry/progress badge, and aligns cross-browser e2e assertions with this contract.

## P2: Performance and UX Refinement

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-015 | P2 | Optimize preset gallery preview generation (lazy, chunked, or worker-based rendering). | Frontend/Rendering | M | NI-011 | Initial page responsiveness remains stable while preset previews load; no long main-thread stalls. | done |
| NI-016 | P2 | Remove or archive deprecated slider sweep feature if intentionally out of UX scope. | Frontend/Docs | S | NI-002 | No dead entry points/imports remain for sweep strips, and docs/backlog no longer claim it as active UX. | done |
| NI-017 | P2 | Add an explicit “render mode” diagnostics line for QA (WebGL2 vs CPU fallback + profile/model + compare mode). | Frontend | S | none | QA can capture a single status line with current rendering mode and viewer mode in bug reports. | done |
| NI-018 | P2 | Add visual baselines for split divider and hover controls in all three browsers. | QA | M | NI-011 | Snapshot or screenshot checks catch split jitter/overlay regressions before merge. | done |
| NI-019 | P2 | Stabilize split compare rendering by replacing clip-path cropping with overflow mask composition. | Frontend | S | NI-011, NI-018 | Split drag remains visually stable in Chromium/Firefox/WebKit without clip jitter or tearing. | done |
| NI-020 | P2 | Increase Color Chrome perceptibility and enforce effect-size regression checks. | Rendering/QA | M | NI-010 | Strong Chrome settings produce a measurable saturated-pixel delta in tests and aligned CPU/WebGL behavior. | done |
| NI-021 | P2 | Make parameter locks authoritative for direct edits and expose lock state in control disablement. | Frontend/State | S | NI-011 | Locked parameters cannot be changed through sliders/selects, and unit tests cover lock enforcement. | done |

## Research Delta (2026-02-18)

Source document:
- `deep-research-report.md`

### P0: Contract, Compliance, and Architecture Gates

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-022 | P0 | Publish a v2 accuracy contract across product copy, README, footer messaging, and docs (educational visualizer + camera-engine-calibrated target; no bit-exact claim). | Product/Docs | S | none | All user-facing disclosures and engineering docs use the same accuracy language and avoid emulator wording. | done |
| NI-023 | P0 | Complete LUT licensing decision: bundled first-party LUTs vs user-supplied LUT workflow. | Product/Legal | M | none | Written legal decision with allowed distribution modes, attribution obligations, and prohibited flows. | done |
| NI-024 | P0 | Define `renderer-contract-v2` interfaces for color-managed pipeline stages (input domain, log/gamut transforms, LUT stage, operator stage, output transform). | Rendering/Architecture | M | NI-022 | `docs/engineering/renderer-contract-v2.md` exists with typed stage interfaces and acceptance constraints. | done |
| NI-025 | P0 | Define calibration oracle protocol using camera-engine outputs (X RAW STUDIO/in-camera RAW conversion) and legal provenance rules for calibration assets. | Rendering/QA/Legal | M | NI-022 | Calibration protocol doc includes capture matrix, scene classes, metadata requirements, and asset-rights checklist. | done |
| NI-026 | P0 | Specify conditional control coupling contract (e.g., DR-priority interactions with tone/dynamic range and model/mode availability rules). | Product/Rendering | M | NI-024 | Product requirements and state model explicitly encode coupled-control rules; no ambiguous UI behavior. | done |

### P1: Rendering Realism Implementation

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-027 | P1 | Implement F-Log/F-Log2/F-Log2C transfer functions and required gamut transforms in engine core (CPU + WebGL parity). | Rendering | L | NI-024 | Unit tests validate curve constants/ranges and parity thresholds between CPU/WebGL paths. | done |
| NI-028 | P1 | Implement 3D LUT runtime stage with `.cube` parsing and 17/33/65 support; support user-supplied LUT mode if bundling is restricted. | Rendering/Frontend | L | NI-023, NI-024, NI-027 | LUT stage can be enabled deterministically and materially changes rendered output under test. | done |
| NI-029 | P1 | Refactor recipe controls into explicit operator graph stages (color-only, spatial/detail, grain/noise, conditional logic). | Rendering | L | NI-024, NI-026 | Control operators are isolated and testable; docs and code identify operator class per parameter. | in_progress |
| NI-030 | P1 | Build calibration harness against camera-engine oracle outputs with per-control sweep metrics and CI thresholds. | Rendering/QA | L | NI-025, NI-029 | Calibration run produces reproducible metrics; CI fails when drift exceeds defined thresholds. | in_progress |
| NI-031 | P1 | Tune control mapping functions (tone/chrome/grain/clarity) using calibration data and scene-class coverage. | Rendering | M | NI-030 | Mapping updates improve aggregate calibration metrics and preserve interactive performance budgets. | todo |

### P2: Interoperability and Data Pipelines

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-032 | P2 | Add MakerNotes import MVP: upload image, parse recipe-relevant tags, map into app state with confidence flags. | Frontend/Domain | M | NI-022 | Users can import supported JPEG/RAF metadata and see mapped recipe controls with clear unsupported-field reporting. | done |
| NI-033 | P2 | Add per-asset provenance and licensing ledger for recipes/LUTs/reference assets used by app and calibration tooling. | Product/Docs/QA | M | NI-023, NI-025 | Every shipped/distributed asset has source, license, approval status, and usage scope documented. | done |
| NI-034 | P2 | Run camera connectivity spike (Fujifilm SDK/tether ecosystem) as optional R&D path, explicitly non-blocking for core visualizer. | R&D | M | NI-023 | Written feasibility memo with integration risk, legal constraints, and recommendation; no dependency for core release. | done |
| NI-035 | P2 | Add high-resolution canonical-image rendering path (full-res source decode + progressive settle strategy) without regressing interaction budgets. | Frontend/Rendering | L | NI-015, NI-029 | Viewer can settle from full-res assets with clear loading UX and no acceptance-budget regressions across Chromium/Firefox/WebKit. | in_progress |

## Sequence Recommendation

1. Sprint A (Stabilize Contract + State)
- NI-001, NI-002, NI-003, NI-004, NI-005, NI-006

2. Sprint B (Rendering Direction + Quality Gates)
- NI-007, then branch to NI-008 or NI-009, plus NI-010, NI-011, NI-012

3. Sprint C (CI + Performance)
- NI-013, NI-014, NI-015, NI-016, NI-017, NI-018
4. Sprint D (UX/Color Hardening)
- NI-019, NI-020
5. Sprint E (State Integrity)
- NI-021
6. Sprint F (Research Contract and Architecture Gates)
- NI-022, NI-023, NI-024, NI-025, NI-026
7. Sprint G (Color Pipeline and Calibration Buildout)
- NI-027, NI-028, NI-029, NI-030, NI-031
8. Sprint H (Interoperability and Compliance Operations)
- NI-032, NI-033, NI-034

## NI-022..034 Execution Board (Week-by-Week)

Execution rules:
1. This board is strict-gated: do not start downstream weeks early if prior week gates are not met.
2. One critical path at a time for rendering architecture (`NI-024 -> NI-027 -> NI-028 -> NI-029 -> NI-030 -> NI-031`).
3. Legal/compliance outputs (`NI-023`, `NI-033`) are release blockers for LUT distribution decisions.

| Week | Focus | Planned NI IDs | Required Deliverables | Gate to Advance |
|---|---|---|---|---|
| W1 | Product contract + legal kickoff | NI-022 (complete), NI-023 (start), NI-024 (draft) | Unified v2 accuracy wording merged across README/product copy/footer/docs; legal issue list for LUT distribution paths; renderer-contract-v2 draft skeleton. | NI-022 marked `done`; NI-023 has owner + decision timeline; NI-024 draft reviewed by rendering lead. |
| W2 | Close architecture gates | NI-023 (complete), NI-024 (complete), NI-025 (start) | Written LUT policy decision (bundled vs user-supplied); finalized renderer-contract-v2 stage interfaces; calibration protocol v1 draft with capture matrix. | NI-023 and NI-024 marked `done`; NI-025 draft approved by QA + rendering + product. |
| W3 | Control semantics + calibration protocol | NI-025 (complete), NI-026 (complete) | Final calibration oracle protocol; explicit DR-priority and coupled-control behavior spec with model/mode availability rules. | NI-025 and NI-026 marked `done`; implementation backlog for NI-027..031 decomposed into concrete tasks. |
| W4 | Core color math implementation I | NI-027 (start) | Engine implementation of F-Log/F-Log2/F-Log2C transfer functions and baseline gamut transform layer in both CPU and WebGL paths; initial unit tests. | NI-027 at >=70% with passing math/unit suite for implemented paths. |
| W5 | Core color math implementation II + LUT foundation | NI-027 (complete), NI-028 (start) | NI-027 finalized; `.cube` parser and 3D LUT data model integrated in engine with 17/33/65 validation tests. | NI-027 marked `done`; NI-028 parser tests pass and performance budget documented. |
| W6 | LUT runtime integration + operator graph start | NI-028 (complete), NI-029 (start) | Runtime LUT stage wired to render pipeline with deterministic toggles and measurable visual effect; operator graph refactor plan implemented for first control classes. | NI-028 marked `done`; NI-029 has color-only operators migrated and parity tests green. |
| W7 | Operator graph completion + harness bootstrap | NI-029 (complete), NI-030 (start) | Full operator decomposition complete (color/spatial/grain/conditional); calibration harness CLI + fixtures + metrics schema running locally. | NI-029 marked `done`; NI-030 produces reproducible metric outputs in CI dry run. |
| W8 | Calibration enforcement + mapping tune pass | NI-030 (complete), NI-031 (start/complete if feasible) | CI calibration thresholds enforced; first tuning pass for tone/chrome/grain/clarity mappings across target scene classes. | NI-030 marked `done`; NI-031 shows measurable metric improvement with no perf regressions. |
| W9 | Interoperability MVP | NI-032 (complete), NI-033 (start) | MakerNotes import MVP (image upload -> parsed recipe mapping -> confidence/unsupported indicators). | NI-032 marked `done`; import fixtures + tests added for representative metadata variants. |
| W10 | Compliance closure + R&D spike | NI-033 (complete), NI-034 (complete) | Asset provenance/licensing ledger complete for distributed assets; camera connectivity feasibility memo delivered with go/no-go recommendation. | NI-033 and NI-034 marked `done`; release readiness review passes compliance and architecture checks. |

### Calendar Baseline (Absolute Dates)

| Week | Date Range |
|---|---|
| W1 | 2026-02-23 to 2026-02-27 |
| W2 | 2026-03-02 to 2026-03-06 |
| W3 | 2026-03-09 to 2026-03-13 |
| W4 | 2026-03-16 to 2026-03-20 |
| W5 | 2026-03-23 to 2026-03-27 |
| W6 | 2026-03-30 to 2026-04-03 |
| W7 | 2026-04-06 to 2026-04-10 |
| W8 | 2026-04-13 to 2026-04-17 |
| W9 | 2026-04-20 to 2026-04-24 |
| W10 | 2026-04-27 to 2026-05-01 |

### NI-022..034 Tracker

Update this table at least twice weekly (mid-week and end-week).

| ID | Week | Owner | Target Start | Target End | Actual End | Status | Notes |
|---|---|---|---|---|---|---|---|
| NI-022 | W1 | Product/Docs | 2026-02-23 | 2026-02-24 | 2026-02-18 | done | Accuracy contract wording aligned in README, requirements, technical spec, and footer copy. |
| NI-023 | W1-W2 | Product/Legal | 2026-02-23 | 2026-03-05 | 2026-02-19 | done | Finalized policy matrix and runtime-mode constraints in `docs/research/lut-policy-decision-v2-draft.md` with traceability to legal decision + manifest. |
| NI-024 | W1-W2 | Rendering/Architecture | 2026-02-24 | 2026-03-06 | 2026-02-18 | done | Draft contract delivered with typed interfaces and acceptance checklist (`docs/engineering/renderer-contract-v2.md`). |
| NI-025 | W2-W3 | Rendering/QA/Legal | 2026-03-03 | 2026-03-12 | 2026-02-19 | done | Final v1 protocol published with numeric pre-baseline gates, rights checklist, and signoff template (`docs/engineering/calibration-oracle-protocol-v1.md`). |
| NI-026 | W3 | Product/Rendering | 2026-03-10 | 2026-03-13 | 2026-02-19 | done | Coupling rules implemented in state normalization and panel disable-reason UX (`apps/web/src/state/parameterStore.ts`, `apps/web/src/components/parameterPanelConfig.ts`, `apps/web/src/components/ParameterPanel.tsx`). |
| NI-027 | W4-W5 | Rendering | 2026-03-16 | 2026-03-26 | 2026-02-19 | done | F-Log/F-Log2/F-Log2C math and gamut transforms implemented with CPU/WebGL parity helpers and optional renderer path wiring (`packages/engine-webgl/src/colorManagement.ts`, `packages/engine-webgl/src/approxRenderer.ts`, `packages/engine-webgl/src/cpuRenderer.ts`). |
| NI-028 | W5-W6 | Rendering/Frontend | 2026-03-24 | 2026-04-02 | 2026-02-19 | done | Runtime LUT stage wired in WebGL + CPU with policy-gated mode controls (`off/bundled/user_supplied`), bundled LUT resolution, and user-supplied `.cube` parsing (`packages/engine-webgl/src/lutStage.ts`, `apps/web/src/data/luts.ts`, `apps/web/src/components/ParameterPanel.tsx`). |
| NI-029 | W6-W7 | Rendering | 2026-03-31 | 2026-04-10 |  | in_progress | CPU pipeline now routes through explicit stage graph metadata + execution path (`packages/engine-webgl/src/operatorGraph.ts`) with param-to-operator classification map and stage-sample tracing; WebGL shader now executes named stage functions in explicit order with stage-id/function mapping metadata and helper-driven QA stage paths, while remaining single-pass and pending deeper calibration-driven decomposition. |
| NI-030 | W7-W8 | Rendering/QA | 2026-04-07 | 2026-04-17 |  | in_progress | Bootstrap harness CLI now renders manifest sweeps, records/evaluates oracle artifacts, computes frame + directional metrics, enforces DeltaE00 threshold gates, supports optional baseline-regression compare (`--baseline-metrics`), and includes baseline lock/check tooling (`calibration:baseline:lock`, `calibration:baseline:check`) with CI smoke via `calibration:dry-run`; oracle index contract validation is explicit (hash + coverage + source policy), camera-engine import/gate scripts are implemented, integration coverage includes camera gate metadata/preflight validation plus import script success/failure paths, a `calibration:camera:bootstrap` path seeds strict camera-oracle assets from approved scene metadata sources, and optional bootstrap-source rejection is now supported for stricter CI policy; remaining work is ingestion of true camera-engine exports + turning on required non-bootstrap camera gate in CI policy. |
| NI-031 | W8 | Rendering | 2026-04-14 | 2026-04-17 |  | todo | Tune parameter mappings from calibration results without violating perf budgets. |
| NI-032 | W9 | Frontend/Domain | 2026-04-20 | 2026-04-24 | 2026-02-19 | done | Local photo import MVP shipped with MakerNotes parsing, mapping report UI, and tests (`apps/web/src/photoImport.ts`, `apps/web/src/components/RecipeToolbar.tsx`). |
| NI-033 | W9-W10 | Product/Docs/QA | 2026-04-22 | 2026-04-30 | 2026-02-19 | done | Ledger baseline and automated provenance validation shipped (`docs/research/asset-provenance-ledger-v1.md`, `scripts/verify-provenance.mjs`, `npm run verify:provenance`). |
| NI-034 | W10 | R&D | 2026-04-27 | 2026-05-01 | 2026-02-19 | done | Camera-connectivity feasibility memo delivered with non-blocking recommendation (`docs/research/camera-connectivity-feasibility-v1.md`). |
| NI-035 | W11 | Frontend/Rendering | 2026-05-04 | 2026-05-15 |  | in_progress | Preview-first/full-source progressive settle is now active in `ImageViewer` with capped settle dimensions for responsiveness; settle prep now uses async `createImageBitmap` downsampling (canvas fallback), telemetry/e2e support `full` and `full_resampled` settle sources plus explicit full-source status attributes (`loading/preparing/settling/ready`), and remaining work is larger-source performance tuning + UX refinement. |

### Critical Path Notes

1. `NI-023` is the policy gate for any bundled LUT path; if unresolved, force `user-supplied LUT only` mode and continue NI-028 with that constraint.
2. `NI-025` calibration protocol must be locked before NI-030 metrics are considered valid.
3. `NI-029` decomposition is required before NI-031 tuning; otherwise control coupling will produce unstable calibration deltas.

## Exit Criteria for This Backlog

1. No doc/product mismatch exists for compare/model behavior.
2. Profile/model restore flows are deterministic and tested.
3. Rendering contract is explicit and implemented consistently.
4. CI enforces both correctness and user-path stability.
5. Reported UX regressions are locked by automated tests.
6. Accuracy contract and disclosure copy are consistent across product/docs.
7. Renderer v2 stages are validated against camera-engine calibration metrics.
8. Asset/license provenance is auditable for all distributed LUT and recipe artifacts.
