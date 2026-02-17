# Product Requirements v1 (Current Baseline)

Date: 2026-02-17  
Status: Active baseline aligned with current implementation  
Primary inputs:
- `/Users/nicoladimarco/code/fujirecipescreator/Project description.md`
- `/Users/nicoladimarco/code/fujirecipescreator/todos.md`
- `/Users/nicoladimarco/code/fujirecipescreator/docs/research/source-validation-2026-02-16.md`

## 1) Product Summary

Fuji Recipe Lab is an interactive, model-aware parameter sandbox that teaches users how Fujifilm recipe controls influence look and tone on a fixed set of reference images.

The app is explicitly educational and approximate, not a camera JPEG engine emulator.

## 2) Goals and Non-Goals

### Goals

1. Deliver immediate visual feedback when adjusting recipe-style controls.
2. Teach parameter behavior using a consistent set of canonical images.
3. Enforce model-aware parameter availability and ranges.
4. Export recipe states in human-readable and machine-readable formats.

### Non-Goals

1. Bit-accurate recreation of Fujifilm in-camera JPEG output.
2. RAW development parity with camera/desktop software.
3. Mandatory camera/device integration in MVP.
4. User photo upload in MVP.

## 3) Target Users

1. Existing Fuji users who want to understand recipe knobs.
2. New Fuji users learning DR/highlight/shadow/WB/chrome/grain/clarity interactions.
3. Creators sketching recipe concepts before manual camera entry.

## 4) MVP Functional Requirements

### Viewer and Compare

- `FR-001`: Fixed image selector with exactly three canonical images (landscape, portrait, night).
- `FR-002`: Press-and-hold before preview in viewer (no persistent before/after toggle mode).
- `FR-003`: Split view with draggable divider.
- `FR-004`: Zoom/pan interactions with stable behavior across compare modes; zoom is controlled by explicit overlay buttons.

### Model and Parameter System

- `FR-005`: Camera model selector for visible launch models, with safe mapping for legacy profile IDs in imported/shared state.
- `FR-006`: Parameter panel generated from profile schema (show/hide by support).
- `FR-007`: Parameter-level reset.
- `FR-008`: Parameter-level lock behavior that persists through profile/base look changes.
- `FR-009`: Global reset to profile defaults.

### Rendering and Responsiveness

- `FR-010`: Real-time preview updates while dragging controls.
- `FR-011`: Two-resolution strategy (interactive preview + final settle render).
- `FR-012`: Deterministic processing order for consistent outputs.

### Recipe Lifecycle

- `FR-013`: Save recipe locally in browser storage.
- `FR-014`: Duplicate recipe.
- `FR-015`: A/B state slots and comparison.
- `FR-016`: Export as Fuji-style text block.
- `FR-017`: Export as JSON.
- `FR-018`: Share link with versioned state encoding and state restoration.

### Trust and Messaging

- `FR-019`: Persistent "Approx" disclosure badge with tooltip.
- `FR-020`: Explicitly avoid language implying camera-accurate simulation.

## 5) Non-Functional Requirements

- `NFR-001`: Interactive preview target <60 ms at preview resolution on target desktop browsers.
- `NFR-002`: Final settle render target 200-400 ms after interaction stop.
- `NFR-003`: Deterministic output for identical input state hash.
- `NFR-004`: Stable URL share decode with schema versioning.
- `NFR-005`: Graceful fallback when WebGL unavailable (reduced feature set acceptable).

## 6) Data and Content Requirements

- `CR-001`: 3 licensed reference images redistributable for app/repo usage.
- `CR-002`: Metadata JSON for each image including license, attribution, source URL.
- `CR-003`: Central credits/attribution artifact.
- `CR-004`: Profile catalog (`profiles/*.json`) as source of truth for defaults/ranges/availability and profile compatibility mapping.
- `CR-005`: LUT pack + manifest containing source/licensing metadata.
- `CR-006`: Strings file for disclaimers/tooltips/export labels.

## 7) Legal and Compliance Requirements

- `LR-001`: All shipped assets (images, LUTs) must have clear redistribution/commercial usage rights.
- `LR-002`: Attribution must be included where required by license.
- `LR-003`: Product copy must preserve "approximate visualizer" framing.
- `LR-004`: Avoid implied Fujifilm endorsement in product wording.

## 8) Acceptance Criteria (MVP Release Gate)

1. User can select one of three fixed images and one model profile.
2. Only profile-supported parameters are exposed and editable.
3. Parameter edits produce immediate visible changes and stable final output.
4. Press/hold before preview and split mode function correctly at all zoom levels.
5. Save/duplicate/reset/A-B compare work without state corruption.
6. Exported text and JSON exactly match current state.
7. Share link restores exact encoded state with deterministic profile/model mapping for unsupported profile IDs.
8. Approximate disclosure is always accessible in the UI.

## 9) Out-of-Scope for MVP

1. Cloud accounts/sync.
2. Camera tethering or direct camera setting writes.
3. User-uploaded images.
4. Full multi-profile parity beyond initial launch baseline.
5. Mobile-first optimization.

## 10) Requirement Traceability to Existing Specs

- Product UX and behavior baseline: `/Users/nicoladimarco/code/fujirecipescreator/Project description.md`
- Missing artifacts checklist: `/Users/nicoladimarco/code/fujirecipescreator/todos.md`
- External-source constraints and corrections: `/Users/nicoladimarco/code/fujirecipescreator/docs/research/source-validation-2026-02-16.md`
