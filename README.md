# Fuji Recipe Lab

Fuji Recipe Lab is an educational, approximate visualizer for exploring Fujifilm-style recipe controls on a fixed set of licensed reference images.

It does **not** emulate Fujifilm in-camera JPEG output.

## Current Product Scope

- 3 canonical images with quick thumbnail switching.
- Camera model selector (`xtrans5`, `xtrans3`) with legacy import/share mapping for `xtrans4`.
- Parameter panel generated from profile contracts.
- Parameter locks are enforced for direct edits (locked controls are disabled).
- Press-and-hold before preview and split screen compare.
- Hover-only in-view zoom controls (+ / - / reset).
- Recipe lifecycle: save, duplicate, A/B slots, copy text export, copy JSON export, share link.
- Optional cloud sync via GitHub Gist push/pull (accepts gist ID or gist URL with input validation and trusted raw-host checks).
- Credits/attribution and LUT legal manifest visibility.

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
npm run test
npm run test:e2e
npm run test:acceptance
```

## Technical Notes

- Renderer truth model (current): procedural approximation only.
- LUT manifest is used for legal gating/attribution and policy messaging; LUT files are not currently ingested into the runtime render pipeline.
- WebGL2 is primary rendering path with CPU fallback when WebGL2 is unavailable.

See:
- `docs/engineering/technical-spec.md`
- `docs/engineering/renderer-contract-v1.md`
- `docs/engineering/next-iteration-backlog.md`
