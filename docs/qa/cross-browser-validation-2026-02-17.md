# Cross-Browser Validation Report

Date: 2026-02-17
Suite: `/Users/nicoladimarco/code/fujirecipescreator/e2e/mvp-acceptance.spec.ts`
Playwright: 1.58.2
Command:

```bash
PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npm run test:e2e
```

## Matrix Results

| Browser Project | Result | Duration | Notes |
|---|---|---:|---|
| chromium | pass | 0.97s | Core path completed without visual/control regressions. |
| firefox | pass | 2.6s | Core path completed; no interaction differences observed. |
| webkit | pass | 2.0s | Core path completed; split mode and press/hold before preview behaved as expected. |

## Covered Checks

1. App shell and persistent Approx disclosure visible.
2. Compare mode switching (`after`, `split`) and temporary before preview on press/hold.
3. Share-link restoration path (same-profile restore + legacy profile migration mapping).
4. Hover-only zoom control visibility and in-view zoom interactions.
5. Split-divider drag updates compare position.
6. Parameter slider update path.
7. Recipe save flow and saved-count update.
8. A/B slot store/toggle flow.
9. Credits/attribution surface accessibility.
10. Footer QA diagnostics line visibility.
11. Snapshot baseline validation for split-divider + hover-control viewport state.

## Current Status

Cross-browser MVP smoke path is green for desktop Chromium, Firefox, and WebKit in the current environment.
