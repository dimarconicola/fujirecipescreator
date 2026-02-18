# MVP Acceptance Testing

Date: 2026-02-17

## Scope

This acceptance suite covers:

1. Workspace-level unit/integration checks (`npm run test`).
2. Browser e2e core-path scenario (`npm run test:e2e`).
3. CI acceptance gate (`npm run test:acceptance`) with Playwright browser install step.

## Commands

1. Run all unit/integration tests:

```bash
npm run test
```

2. Run e2e acceptance flow:

```bash
PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npm run test:e2e
```

3. Run complete acceptance gate:

```bash
PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npm run test:acceptance
```

## E2E Coverage

File: `/Users/nicoladimarco/code/fujirecipescreator/e2e/mvp-acceptance.spec.ts`

Core path checks:

1. App shell and persistent Approx disclosure render.
2. Split-screen compare toggle and press/hold before preview behavior function.
3. Parameter slider interaction updates state.
4. Recipe save flow works.
5. A/B slot storage and compare toggle are enabled.
6. Credits/attribution panel is accessible.
7. Camera model selector switches between visible launch models and hides fixed-value controls.
8. Share-link restoration is covered for both same-profile payloads and legacy-profile migration payloads.
9. Viewer interaction contract is covered (hover-only zoom controls, press/hold before preview, split-divider drag updates).
10. Cloud sync push/pull flow works against mocked GitHub Gist APIs.
11. Footer exposes a QA diagnostics status line with renderer/model/compare context.
12. Cross-browser viewport screenshot baselines cover split-divider + hover-control states.
13. Screenshot baseline assertions are pinned to macOS snapshot artifacts and are skipped on non-darwin runners.

## Environment Notes

E2E requires:

1. Playwright Chromium, Firefox, and WebKit browser binaries installed.
2. Local port binding for Vite dev server (default `127.0.0.1:4174`).

If browser download or local port binding is blocked by sandbox/network policy, unit/integration checks still run, but e2e must be executed in a less restricted environment.

## CI Trigger Verification (NI-014)

CI trigger policy lives in `/Users/nicoladimarco/code/fujirecipescreator/.github/workflows/ci.yml` and must include:

1. `push` on `master`, `main`, and `codex/**`.
2. `pull_request` on `master`, `main`, and `codex/**`.

Verification checklist (remote GitHub):

1. Create a test branch from default branch: `codex/ci-trigger-probe`.
2. Push a no-op commit and open a PR into default branch `main`.
3. Confirm a `CI` workflow run is created from `pull_request` event and executes acceptance gate.
4. Confirm run succeeds (typecheck, build, Playwright install, `test:acceptance`).
5. Record run URL in QA log and close/merge probe PR.

Verification result (2026-02-17):

1. Probe PR: https://github.com/dimarconicola/fujirecipescreator/pull/1
2. `pull_request` CI run: https://github.com/dimarconicola/fujirecipescreator/actions/runs/22131422404
3. Conclusion: success
