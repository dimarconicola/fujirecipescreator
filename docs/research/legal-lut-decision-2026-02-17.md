# LUT Legal Decision - 2026-02-17

Scope: official Fujifilm LUT redistribution decision for repository/app bundling.

## Sources reviewed

1. Fujifilm LUT download index:
- `https://www.fujifilm-x.com/global/support/download/lut/`

2. Fujifilm global terms:
- `https://www.fujifilm.com/terms_of_use/`

## Decision

Official Fujifilm LUT packs are marked **not approved for redistribution** in this project.

Rationale:
1. Current public terms for website content/downloads indicate personal, noncommercial usage unless separately permitted.
2. No explicit LUT redistribution grant was found in the reviewed sources.
3. We apply a conservative policy gate and keep official LUT entries blocked in `luts/manifest.json`.

## Implementation impact

1. Official LUT entries remain `approval_status: blocked`.
2. `redistribution_allowed` and `commercial_use_allowed` are set to `no` for official entries.
3. App runtime currently remains procedural-only; approved community LUT entries are retained for legal metadata, attribution, and future optional integration.

## Note

This is a product policy decision for safe distribution and is not legal advice.
