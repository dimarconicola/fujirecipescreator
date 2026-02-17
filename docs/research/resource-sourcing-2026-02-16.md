# Resource Sourcing Log - 2026-02-16

This log records external resources sourced for MVP preparation and their current legal/technical status.

## 1) Images Downloaded

### landscape_v1 (approved)
- Source page: `https://commons.wikimedia.org/wiki/File:Landscape_Picture.jpg`
- Direct file: `https://upload.wikimedia.org/wikipedia/commons/c/cc/Landscape_Picture.jpg`
- License: CC BY-SA 4.0
- Stored files:
  - `assets/images/full/landscape_v1.jpg` (4640x3472)
  - `assets/images/preview/landscape_v1.jpg` (1600x1197)

### portrait_v1 (approved)
- Source page: `https://www.pexels.com/photo/415829/`
- Direct file: `https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg`
- License: Pexels License
- Stored files:
  - `assets/images/full/portrait_v1.jpg` (5760x5075)
  - `assets/images/preview/portrait_v1.jpg` (1600x1409)

### night_v1 (approved)
- Source page: `https://www.pexels.com/photo/3075993/`
- Direct file: `https://images.pexels.com/photos/3075993/pexels-photo-3075993.jpeg`
- License: Pexels License
- Stored files:
  - `assets/images/full/night_v1.jpg` (6000x4000)
  - `assets/images/preview/night_v1.jpg` (1600x1066)

## 2) LUT Resources

### Community fallback LUTs (approved)
- Source repo: `https://github.com/jonmatifa/a6000-LUTs`
- License: CC0 1.0
- Local extraction:
  - `luts/community/a6000-LUTs-master/a6000 vivid_1.C0006.cube`
  - `luts/community/a6000-LUTs-master/a6000 slog2_1.C0006.cube`
  - `luts/community/a6000-LUTs-master/a6000 slog3_1.C0006.cube`

### Official Fujifilm LUT packs (rejected for redistribution)
- Source index: `https://www.fujifilm-x.com/global/support/download/lut/`
- Candidate direct links:
  - `https://dl.fujifilm-x.com/support/lut/x-t4/x-t4-3d-lut-v12.zip`
  - `https://dl.fujifilm-x.com/support/lut/x-t30_ii_iii/x-t30_ii_iii-3d-lut-v101.zip`
- Current issue: direct automated fetch returns `AccessDenied`.
- Policy decision (2026-02-17): do not redistribute official LUT downloads in this project.
- Decision record: `/Users/nicoladimarco/code/fujirecipescreator/docs/research/legal-lut-decision-2026-02-17.md`

## 3) Profile-Reference Sources (for model gating)

1. X-T30 manual, image quality settings:
`https://fujifilm-dsc.com/en/manual/x-t30/menu_shooting/image_quality_setting/index.html`

2. X-T30 II/X-T30 III manual, image quality settings:
`https://fujifilm-dsc.com/en/manual/x-t30-2/menu_shooting/image_quality_setting/index.html`

3. X RAW STUDIO framing:
`https://www.fujifilm-x.com/global/products/software/x-raw-studio/`

4. Camera Control SDK reference:
`https://www.fujifilm-x.com/en-us/products/software/sdk/`

## 4) Notes

1. Image metadata is now in `assets/images/metadata/*.json`.
2. LUT status and legal fields are tracked in `luts/manifest.json`.
3. Credits are centralized in `/Users/nicoladimarco/code/fujirecipescreator/CREDITS.md`.
