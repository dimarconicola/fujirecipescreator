# Source Validation - 2026-02-16

This document validates the links listed in `/Users/nicoladimarco/code/fujirecipescreator/links and resources.md` and captures implications for product scope.

## Scope

Reviewed all referenced URLs [1]-[7] plus official Fujifilm Camera Control SDK pages discovered during validation.

## Confirmed Findings

### 1) Official Fujifilm LUT downloads exist and are usable as seed base looks

- Fujifilm provides downloadable Film Simulation LUT packages on its support website.
- The page includes downloadable files for ETERNA and named Film Simulation looks.
- Product implication: use official LUTs as first-party seed looks for the Film Sim dropdown where licensing permits redistribution.

Sources:
- [Fujifilm Film Simulation LUT support page](https://www.fujifilm-x.com/global/support/download/lut/)

### 2) X RAW STUDIO confirms in-camera processing model

- Fujifilm describes that X RAW STUDIO uses the camera engine for RAW conversion.
- Product implication: exact JPEG engine behavior is not exposed as a public algorithm; the app should remain explicitly "approximate visualizer for learning."

Sources:
- [Fujifilm X RAW STUDIO page](https://www.fujifilm-x.com/global/products/software/x-raw-studio/)

### 3) XApp is user software with documented features, not a developer API surface

- XApp pages describe transfer/remote/backups and compatibility behavior.
- No public developer API docs were identified for third-party recipe manipulation through XApp.
- Product implication: keep MVP fully local/browser-based and avoid dependency on XApp integration.

Sources:
- [Fujifilm XApp page (IT)](https://www.fujifilm-x.com/it-it/products/software/xapp/)
- [Fujifilm XApp page (US)](https://www.fujifilm-x.com/en-us/products/software/xapp/)
- [XApp camera compatibility chart](https://www.fujifilm-x.com/en-us/support/compatibility/software/xapp/)

### 4) Important correction: Fujifilm does provide a Camera Control SDK

- Fujifilm has an official Camera Control SDK page with separate downloads for individuals/businesses and an EULA flow.
- This is distinct from XApp and should not be treated as a casual integration dependency.
- Product implication: camera connectivity is possible in future phases but should remain out of MVP due scope, complexity, and licensing/EULA obligations.

Sources:
- [Fujifilm Camera Control SDK page](https://www.fujifilm-x.com/en-us/products/software/sdk/)
- [Camera Control SDK for Individuals](https://dl.fujifilm-x.com/support/sdk/)

### 5) Community resources exist, but licensing/quality vary

- The cited GitHub repository contains community camera profiles/LUT-related resources.
- Product implication: community resources can accelerate prototyping but require explicit license checks before inclusion.

Sources:
- [abpy/FujifilmCameraProfiles repository](https://github.com/abpy/FujifilmCameraProfiles)

### 6) gphoto/libgphoto2 ecosystem exists; Fuji support is mixed

- gphoto has a supported camera list and remote-control capability docs.
- Existing issue history includes Fuji X-T30 protocol instability reports.
- Product implication: optional future track only; do not block MVP on camera connectivity stack.

Sources:
- [libgphoto2 supported cameras](https://www.gphoto.org/proj/libgphoto2/support.php)
- [gphoto remote control docs](https://gphoto.sourceforge.io/doc/remote/)
- [libgphoto2 issue #1144](https://github.com/gphoto/libgphoto2/issues/1144)

## Requirements Impact (Decisions)

1. MVP remains a fixed-image, browser-native, no-camera-connectivity product.
2. "Approximate visualizer" disclosure remains non-negotiable across product surfaces.
3. LUT usage policy:
   - Official Fujifilm downloads are blocked for redistribution by default policy unless explicit redistributable terms are provided.
   - Community LUTs/profiles allowed only with explicit license compatibility.
4. Profile gating should be built from static profile JSONs informed by official manuals/specs and compatibility pages.

## Open Questions (Must Resolve Before Asset Freeze)

1. Build a machine-readable `luts/manifest.json` containing source URL, license terms, and approved usage status.
2. Confirm final camera profile matrix and value ranges from primary sources for X-Trans IV baseline.

## Confidence Notes

- High confidence:
  - Availability of official LUT downloads.
  - X RAW STUDIO in-camera processing framing.
  - Existence of official Camera Control SDK.
- Medium confidence:
  - Completeness of model capability ranges without manual-by-manual extraction.
