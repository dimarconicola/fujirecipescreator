# Next Iteration Backlog

Date: 2026-02-17  
Status: Proposed execution backlog for next delivery cycle  
Scope: Stabilization + product-contract alignment after latest UX/render updates

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
| NI-014 | P1 | Correct CI branch triggers to include the active default branch policy. | DevOps | S | none | `.github/workflows/ci.yml` triggers are aligned with active branch strategy and verified by test PR. | blocked |

Decision note (2026-02-17):
- NI-007 selected the procedural-only renderer contract (see `docs/engineering/renderer-contract-v1.md`), so NI-008 is blocked unless product direction changes to LUT-assisted rendering.
- NI-010 implemented profile scalar calibration in runtime render mapping and added unit coverage.
- NI-011 added explicit Playwright coverage for hover zoom controls, long-press before preview, and split-divider drag behavior.
- NI-012 added explicit Playwright share-link restoration coverage for same-profile and legacy-profile migration flows.
- NI-013 wired `test:acceptance` into CI after Playwright browser installation.
- NI-014 trigger alignment now covers `master`, `main`, and `codex/**`, with regression guard test `apps/web/src/ciWorkflow.test.ts`; task is blocked pending remote PR verification evidence (local clone currently has no `origin` remote).
- NI-015 completed with lazy + chunked preset preview rendering, telemetry, and Playwright responsiveness coverage across Chromium/Firefox/WebKit.
- NI-016 removed unused slider sweep component/logic/tests from the codebase.
- NI-017 added a dedicated footer QA diagnostics line with renderer mode, model/profile, compare mode, image, and zoom context.
- NI-018 added Playwright screenshot baselines for split-divider + hover-control states across Chromium/Firefox/WebKit.

## P2: Performance and UX Refinement

| ID | Priority | Task | Owner | Effort | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|
| NI-015 | P2 | Optimize preset gallery preview generation (lazy, chunked, or worker-based rendering). | Frontend/Rendering | M | NI-011 | Initial page responsiveness remains stable while preset previews load; no long main-thread stalls. | done |
| NI-016 | P2 | Remove or archive deprecated slider sweep feature if intentionally out of UX scope. | Frontend/Docs | S | NI-002 | No dead entry points/imports remain for sweep strips, and docs/backlog no longer claim it as active UX. | done |
| NI-017 | P2 | Add an explicit “render mode” diagnostics line for QA (WebGL2 vs CPU fallback + profile/model + compare mode). | Frontend | S | none | QA can capture a single status line with current rendering mode and viewer mode in bug reports. | done |
| NI-018 | P2 | Add visual baselines for split divider and hover controls in all three browsers. | QA | M | NI-011 | Snapshot or screenshot checks catch split jitter/overlay regressions before merge. | done |

## Sequence Recommendation

1. Sprint A (Stabilize Contract + State)
- NI-001, NI-002, NI-003, NI-004, NI-005, NI-006

2. Sprint B (Rendering Direction + Quality Gates)
- NI-007, then branch to NI-008 or NI-009, plus NI-010, NI-011, NI-012

3. Sprint C (CI + Performance)
- NI-013, NI-014, NI-015, NI-016, NI-017, NI-018

## Exit Criteria for This Backlog

1. No doc/product mismatch exists for compare/model behavior.
2. Profile/model restore flows are deterministic and tested.
3. Rendering contract is explicit and implemented consistently.
4. CI enforces both correctness and user-path stability.
5. Reported UX regressions are locked by automated tests.
