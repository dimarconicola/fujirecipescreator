# MVP Backlog v1

Date: 2026-02-16  
Status: Historical MVP backlog; see `docs/engineering/next-iteration-backlog.md` for current execution plan  
Source docs:
- `/Users/nicoladimarco/code/fujirecipescreator/docs/product/requirements-v1.md`
- `/Users/nicoladimarco/code/fujirecipescreator/docs/engineering/implementation-plan-v1.md`
- `/Users/nicoladimarco/code/fujirecipescreator/docs/research/source-validation-2026-02-16.md`

## Prioritization Model

- `P0`: required to ship MVP.
- `P1`: high leverage for beta quality and stability.
- `P2`: post-MVP optimization and expansion.

Status values:
- `todo`
- `in_progress`
- `blocked`
- `done`

## Critical Path (P0)

| ID | Priority | Item | Requirement Links | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| BL-001 | P0 | Create repo scaffold (`apps/web`, `packages/domain`, `packages/engine-webgl`) | FR-010..FR-012 | none | Buildable project skeleton | done |
| BL-002 | P0 | Define profile schema + runtime validator | FR-005, FR-006, CR-004 | BL-001 | `profiles/*.json` validation layer | done |
| BL-003 | P0 | Define recipe schema + migrations | FR-013..FR-018 | BL-001 | Typed recipe contract | done |
| BL-004 | P0 | Define share-url payload contract (`v=1`) | FR-018, NFR-004 | BL-003 | Encoder/decoder contract | done |
| BL-005 | P0 | Build parameter state store (defaults, bounds, locks, reset) | FR-007..FR-009 | BL-002 | Central validated state store | done |
| BL-006 | P0 | Implement viewer shell (zoom/pan + image tabs) | FR-001, FR-004 | BL-001 | Stage component with image switching | done |
| BL-007 | P0 | Implement compare modes (after, press/hold before preview, split) | FR-002, FR-003 | BL-006 | Working compare UI modes | done |
| BL-008 | P0 | Implement render graph vertical slice (WB, tone, procedural film-sim, output) | FR-010..FR-012 | BL-001, BL-005 | First live GPU render chain | done |
| BL-009 | P0 | Add two-resolution strategy (interactive + settle) | FR-011, NFR-001, NFR-002 | BL-008 | Smooth drag + settle renders | done |
| BL-010 | P0 | Implement full parameter panel from schema groups | FR-006 | BL-002, BL-005 | Dynamic grouped controls | done |
| BL-011 | P0 | Add clarity/NR/sharpness/grain passes + interaction rules | FR-010, FR-012 | BL-008 | Full pass pipeline + couplings | done |
| BL-012 | P0 | Implement local save, duplicate, global reset, A/B slots | FR-013..FR-015 | BL-005 | Recipe lifecycle UX working | done |
| BL-013 | P0 | Implement export text and JSON (deterministic order) | FR-016, FR-017 | BL-003 | Clipboard-ready deterministic exports | done |
| BL-014 | P0 | Implement share link round-trip | FR-018, NFR-004 | BL-004, BL-013 | URL copy/restore exact state | done |
| BL-015 | P0 | Integrate trust disclosure (`Approx`) and policy-safe copy | FR-019, FR-020, LR-003, LR-004 | BL-001 | Persistent disclosure in UI | done |
| BL-016 | P0 | Wire canonical images + metadata registry | CR-001, CR-002 | BL-006 | Asset manifest-backed image selector | done |
| BL-017 | P0 | Wire LUT manifest loader with legal gating | CR-005, LR-001 | BL-008 | LUT legal-gate metadata integration with approval status check | done |
| BL-018 | P0 | Add credits/about attribution surface | CR-003, LR-002 | BL-016 | In-app or static credits display | done |
| BL-019 | P0 | Add CPU fallback mode for non-WebGL | NFR-005 | BL-008 | Graceful reduced feature mode | done |
| BL-020 | P0 | Ship MVP acceptance test suite (unit + e2e core path) | MVP acceptance section | BL-010..BL-019 | Green acceptance run | done |

## Asset and Legal Track (P0)

| ID | Priority | Item | Requirement Links | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| BL-021 | P0 | Freeze 3 reference images and preview derivatives | CR-001 | none | Full/preview image set in repo | done |
| BL-022 | P0 | Produce per-image metadata JSON | CR-002 | BL-021 | `assets/images/metadata/*.json` | done |
| BL-023 | P0 | Maintain credits file with required attributions | CR-003, LR-002 | BL-022 | `/Users/nicoladimarco/code/fujirecipescreator/CREDITS.md` | done |
| BL-024 | P0 | Build LUT manifest with approval states | CR-005, LR-001 | none | `/Users/nicoladimarco/code/fujirecipescreator/luts/manifest.json` | done |
| BL-025 | P0 | Resolve official Fujifilm LUT redistribution terms | LR-001 | BL-024 | Approved/rejected legal decision per LUT pack | done |
| BL-026 | P0 | Prepare approved Fuji-like fallback LUT set | CR-005 | BL-024 | Licensed LUTs available for MVP | done |

## Stability and Hardening (P1)

| ID | Priority | Item | Requirement Links | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| BL-027 | P1 | Performance HUD (preview ms, settle ms, cache hit) | NFR-001..NFR-003 | BL-009 | Dev perf overlay | done |
| BL-028 | P1 | Render cache keyed by image/profile/param hash | NFR-003 | BL-009 | Stable cache layer | done |
| BL-029 | P1 | Visual regression snapshots for canonical states | NFR-003 | BL-011 | Golden snapshot suite | done |
| BL-030 | P1 | Cross-browser QA matrix (Chrome/Safari/Edge) | NFR-001, NFR-005 | BL-020 | Browser validation report | done |
| BL-031 | P1 | Error boundaries and invalid-state recovery UI | FR-006, FR-018 | BL-010, BL-014 | User-safe recovery flows | done |
| BL-032 | P1 | Parameter glossary overlay and guided tips | FR-019 | BL-010 | Learn overlay baseline | done |
| BL-033 | P1 | CI pipeline for lint/test/build | release readiness | BL-001, BL-020 | Automated quality gate | done |

## Growth and Post-MVP (P2)

| ID | Priority | Item | Requirement Links | Dependencies | Deliverable | Status |
|---|---|---|---|---|---|---|
| BL-034 | P2 | Preset gallery (10-20 curated recipes) | V1.1 features | BL-012 | Preset browser and apply flow | done |
| BL-035 | P2 | Slider sweep strips | V1.1 features | BL-010, BL-011 | Comparative strips for key controls | done |
| BL-036 | P2 | Randomize within safe bounds | V1.1 features | BL-005 | Exploration helper | done |
| BL-037 | P2 | Additional profiles (X-Trans III/V) | V2 features | BL-002 | Extended profile pack | done |
| BL-038 | P2 | Account sync/cloud recipes | V2 features | BL-012 | Synced recipe storage | done |

## Sequenced Sprint Plan

### Sprint 1 (Foundation + Vertical Slice)
1. BL-001, BL-002, BL-003, BL-005, BL-006, BL-008
2. Exit: one image + one profile + live controls rendering.

### Sprint 2 (MVP Control Surface)
1. BL-007, BL-009, BL-010, BL-011
2. Exit: full controls + compare modes + responsive rendering.

### Sprint 3 (Recipe Lifecycle + Export/Share)
1. BL-012, BL-013, BL-014, BL-015
2. Exit: save/duplicate/A-B/export/share all working.

### Sprint 4 (Release Gates)
1. BL-017, BL-018, BL-019, BL-020, BL-027, BL-030, BL-033
2. Exit: MVP acceptance + legal/trust/performance gates green.

## Blockers

1. No active MVP blockers.
