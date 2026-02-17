---
title: todos

---

## 1) Licensed reference images + metadata

### What you need

A fixed set of 3 canonical images (landscape / portrait / night) you can legally ship inside the product.

### Why it matters

If the images aren’t distributable, you cannot ship. Also, consistent images are the foundation of “credible learning.”

### What to produce (concrete)

**A. Image files**

* `landscape_v1_source.tif` (16-bit, internal master)
* `portrait_v1_source.tif`
* `night_v1_source.tif`
* Derived “app assets”:

  * `landscape_v1.webp` + fallback `jpg`
  * same for portrait/night
* 2 sizes per image:

  * `full` (e.g., 3000–4500px long edge)
  * `preview` (e.g., 1600px long edge) for fast initial render

**B. Metadata JSON per image**

```json
{
  "image_id": "landscape_v1",
  "title": "Landscape Daylight",
  "description": "Sky highlights + foliage saturation + texture.",
  "license": "CC BY 4.0",
  "source_url": "…",
  "author": "…",
  "required_attribution": "Photo by … / CC BY 4.0",
  "capture_notes": "Neutral exposure, no heavy grade.",
  "white_point_hint": "D65",
  "exposure_hint": 0.0,
  "tags": ["daylight","sky","foliage"]
}
```

**C. Attribution bundle**

* A single `CREDITS.md` or “About” modal text that satisfies license requirements.

### Acceptance check

* You can publish the app and repo without takedown risk.
* Attribution is correct and visible if required.

---

## 2) Profile JSON for at least X-Trans IV

### What you need

A machine-readable definition of what parameters exist and their ranges for your selected “camera profile” (X-Trans IV / X-T30 class).

### Why it matters

Your UI must be model-aware. Without this you’ll:

* show controls that don’t exist on that generation,
* export recipes that can’t be entered,
* create invalid combinations.

### What to produce (concrete)

A single file like:

* `profiles/xtrans4.json`

It should include:

* **supported film sims list**
* **supported effects** (Chrome, Blue, Grain size, Clarity, etc.)
* **allowed discrete ranges** for each slider
* **defaults** (baseline)
* **internal strength scalars** (how “strong” your approximation behaves for this profile)

This JSON is also the source of truth for:

* what to show/hide in the panel,
* how to validate recipe state,
* how to format export.

### Acceptance check

* You can generate the entire parameter panel from this file.
* Any recipe state is validated against it.

---

## 3) Initial LUT pack (8–12 base looks)

### What you need

A small set of base looks to anchor the “Film Simulation” dropdown. LUTs are the fastest way to produce plausible color/tone behavior without writing a massive color science system.

### Why it matters

Your procedural sliders (tone, clarity, grain) won’t create “Classic Chrome” by themselves. Users expect the base sim to matter.

### What to produce (concrete)

* Folder: `luts/xtrans4/`
* Files:

  * `provia.cube`
  * `velvia.cube`
  * `astia.cube`
  * `classic_chrome.cube`
  * `eterna.cube`
  * `classic_neg.cube` (optional / approximate)
  * `acros.cube` or handle B&W procedurally
  * plus a few “teaching” looks (neutral, warm, cool)

**Specs**

* Prefer **.cube 3D LUT** at 33³ minimum, 65³ ideal.
* LUTs should assume a known input space:

  * “sRGB -> LUT -> sRGB” for MVP (simplest).
* Include a `luts/manifest.json` describing:

  * LUT size
  * intended input/output
  * licensing/source

### Acceptance check

* Switching Film Sim yields a clearly different look even with all other sliders at default.
* LUT licensing is clean.

---

## 4) Parameter mapping table (Fuji discrete → internal coefficients)

### What you need

A document that translates Fuji-style discrete knobs (e.g., Highlight -2..+4) into the continuous numbers your rendering engine uses (curve strength, sigma, etc.).

### Why it matters

Without a mapping spec you’ll get:

* inconsistent feel across parameters,
* impossible-to-tune slider behavior,
* no shared reference between product/design/engineering.

### What to produce (concrete)

A single table (CSV/Markdown) like:

| Parameter      | Fuji values     | Internal variable(s) | Mapping function        | Notes                          |
| -------------- | --------------- | -------------------- | ----------------------- | ------------------------------ |
| Highlight      | -2..+4          | `k_shoulder`         | `k = base * exp(v * a)` | + compress/bright? define sign |
| Shadow         | -2..+4          | `k_toe`              | `k = base * exp(v * b)` | toe lift/crush                 |
| Color          | -4..+4          | `sat_mult`           | `1 + 0.12*v`            | clamp 0.2–2.0                  |
| Clarity        | -5..+5          | `lc_amount`          | `0.08*v` (asym)         | neg gentler                    |
| NR             | -4..+4          | `nr_sigma`           | `base * 2^(v/2)`        | cap                            |
| Sharpness      | -4..+4          | `usm_amount`         | `base * 2^(v/3)`        | adjust threshold               |
| Chrome         | off/weak/strong | `chrome_k`           | {0,0.35,0.7}            | sat compression                |
| Grain strength | off/weak/strong | `grain_amp`          | {0,0.04,0.08}           | modulate by luma               |
| Grain size     | small/large     | `grain_scale`        | {1.0, 1.8}              |                                |

Also define **interaction rules** here, with exact numbers.

### Acceptance check

* An engineer can implement behavior without guessing.
* Tuning can happen by editing this table and reloading.

---

## 5) UI wireframe (single screen)

### What you need

A concrete layout that communicates:

* control grouping,
* interaction states,
* compare modes,
* export flows.

### Why it matters

If you start coding without wireframes, you’ll build the wrong hierarchy, then refactor.

### What to produce (concrete)

A single page wireframe (Figma or even ASCII) showing:

**Top bar**

* Model selector
* Image selector tabs
* Before/after/split toggles
* Reset

**Left panel**

* Image viewer
* Zoom controls
* Histogram toggle
* Clipping toggle

**Right panel**

* Sections with collapsible headers
* Each control row includes: label, slider/segmented control, reset, lock, tooltip

**Bottom bar**

* Recipe name
* Save / Duplicate
* A/B store + compare
* Export buttons

Include 2–3 states:

* default
* split view active
* export modal open

### Acceptance check

* All MVP features have a place on screen.
* No ambiguity about where recipe is saved/exported.

---

## 6) Copy strings (disclaimers, tooltips, export labels)

### What you need

A single “strings” file that contains all text. This includes the crucial trust framing (approximate), plus tooltips that teach.

### Why it matters

This product’s credibility depends on the wording. Also you don’t want text scattered across code.

### What to produce (concrete)

* `strings/en.json` (and optionally `it.json`)
* Sections:

**A. Disclaimers**

* Badge tooltip:

  * “Approximate visualizer for learning. Results won’t match your camera exactly.”
* About modal paragraph.

**B. Tooltips** (short, factual)

* Highlight: “Compresses/expands bright tones (shoulder).”
* Shadow: “Lifts/crushes dark tones (toe).”
* Chrome: “Restrains saturation in intense colors for denser look.”
* Clarity: “Local contrast; increases texture separation.”

**C. Export labels**

* “Copy recipe text”
* “Copy JSON”
* “Share link”
* “Reset all”
* “Reset section”
* Error messages (invalid state, unsupported param, etc.)

### Acceptance check

* You can ship without writing any UI text in code.
* The “approximate” framing is always accessible.

---

## Minimal “package” you should end up with

* `/assets/images/*` (3 images × full/preview + metadata + credits)
* `/profiles/xtrans4.json`
* `/luts/xtrans4/*.cube` + `/luts/manifest.json`
* `/spec/parameter-mapping.md` (or .csv)
* `/design/wireframe.png` (or Figma link)
* `/strings/en.json` (and it.json if needed)
