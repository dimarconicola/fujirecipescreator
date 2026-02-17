# Engineering Implementation Plan v1

Date: 2026-02-16  
Status: Pre-implementation plan  
Depends on: `/Users/nicoladimarco/code/fujirecipescreator/docs/product/requirements-v1.md`

Note:
- This document is a pre-implementation planning artifact.
- For current implementation truth, use:
  - `/Users/nicoladimarco/code/fujirecipescreator/docs/engineering/technical-spec.md`
  - `/Users/nicoladimarco/code/fujirecipescreator/docs/engineering/renderer-contract-v1.md`

## 1) Delivery Strategy

Execution model: documentation-first, vertical-slice-first, then expand to full MVP.

Guiding priorities:
1. Product truthfulness and legal safety first.
2. Fast interactive feedback second.
3. Feature breadth third.

## 2) Proposed Technical Architecture

### Frontend Stack

1. React + TypeScript (UI composition, stateful controls).
2. Zustand (parameter and session state).
3. Vite (build/dev server).
4. WebGL2 renderer for image processing passes.

### Module Boundaries

1. `domain` module
Contains profile schema, recipe schema, validation, serialization, and mapping logic.

2. `engine-webgl` module
Contains render graph, shader pass orchestration, LUT ingestion, and frame cache.

3. `ui` module
Contains layout, parameter groups, compare modes, bottom-bar recipe actions, overlays.

4. `assets` module
Contains image registry, LUT manifest, attribution metadata, and static lookup tables.

## 3) Data Contracts (Must Exist Before UI Wiring)

1. Profile schema contract (`FR-005`, `FR-006`, `CR-004`)
Defines supported controls, discrete ranges, defaults, and profile scalar tuning.

2. Recipe schema contract (`FR-013` to `FR-018`)
Defines stable serializable recipe object with versioning and migration path.

3. Share URL payload contract (`FR-018`, `NFR-004`)
Defines compact encoded state with `v` field for backward compatibility.

## 4) Rendering Pipeline Plan

Ordered pass graph (deterministic):
1. Input decode + linearization.
2. White balance and shift.
3. Tone/DR shaping.
4. Film simulation LUT.
5. Chroma controls (color/chrome/chrome-blue and optional mono toning path).
6. Local contrast/clarity.
7. Noise reduction.
8. Sharpening.
9. Grain.
10. Output encode to sRGB display target.

Performance model:
1. Interaction render target at reduced resolution while sliders move (`FR-010`, `NFR-001`).
2. Debounced full-quality settle render (`FR-011`, `NFR-002`).
3. Cache key by image + profile + parameter hash (`NFR-003`).

## 5) Phase Plan

### Phase 0 - Foundation and Contracts

Deliverables:
1. Repo scaffold and lint/test tooling.
2. Typed schemas for profiles/recipes/share payload.
3. Static placeholder profile and strings files.

Exit criteria:
1. Invalid parameter states are rejected by schema validation.
2. Contracts are test-covered.

### Phase 1 - Vertical Slice

Deliverables:
1. One image, one profile, core controls (film sim, highlight, shadow, color, WB).
2. Viewer with before/after mode.
3. Basic render pass chain and live update loop.

Exit criteria:
1. End-to-end recipe state modifies render deterministically.
2. Preview interaction is visually immediate on target desktop.

### Phase 2 - Full MVP Control Surface

Deliverables:
1. Full parameter panel from schema (all groups).
2. Lock/reset semantics.
3. Split view and draggable divider.

Exit criteria:
1. UI does not expose unsupported parameters for active profile.
2. Lock behavior survives profile/base look changes.

### Phase 3 - Recipe Lifecycle and Export

Deliverables:
1. Save/duplicate/reset flows.
2. A/B slots and compare mode toggles.
3. Export text/JSON + share URL restore.

Exit criteria:
1. Export output exactly matches in-app state.
2. Shared link reconstructs state without loss.

### Phase 4 - Hardening and Launch Readiness

Deliverables:
1. Performance instrumentation and profiling scripts.
2. QA matrix and regression tests.
3. Legal/attribution checklist and release notes.

Exit criteria:
1. Non-functional targets are met or explicitly waived.
2. Legal and trust requirements are all green.

## 6) Quality Plan

### Automated Tests

1. Unit: mapping functions, interaction rules, serializer/deserializer.
2. Integration: profile gating, lock/reset behavior, compare-mode state sync.
3. Snapshot: deterministic export text and URL payload roundtrips.
4. E2E: user flows for save/export/share/restore.

### Manual QA Focus

1. Split view alignment at multiple zoom levels.
2. Edge slider values and clipping/banding behavior.
3. Cross-browser behavior (Chrome, Safari, Edge desktop).
4. Approximate disclosure presence and clarity.

## 7) Risk Register and Mitigations

1. Asset licensing ambiguity (`CR-001`, `CR-005`, `LR-001`)
Mitigation: require approved license metadata before inclusion.

2. WebGL variability across browsers (`NFR-001`, `NFR-005`)
Mitigation: fallback paths and browser-specific QA gates.

3. Over-complex MVP scope
Mitigation: strict phase gates, ship vertical slice first, defer non-critical overlays.

4. Parameter feel inconsistency
Mitigation: central mapping table and calibration iterations with canonical image set.

## 8) Pre-Implementation Checklist

1. Confirm final set of licensed images and attribution records.
2. Confirm legal stance for every LUT planned for distribution.
3. Freeze initial profile JSON for X-Trans IV.
4. Freeze strings/disclaimer baseline.
5. Freeze acceptance tests for MVP release.
