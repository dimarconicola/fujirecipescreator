---
title: Project description

---

# Fuji Recipe Lab (Approx) — Product Description + Full Build Spec

## 1) Product definition

**Name:** Fuji Recipe Lab (Approx)
**Category:** Interactive recipe parameter sandbox (educational / exploratory)
**Purpose:** Teach users what Fujifilm “recipe” parameters do by providing an immediate, consistent visual preview on a fixed set of canonical demo images.
**Non-goal:** Accurate emulation of any specific Fujifilm camera output.

**One-line:** A fast, model-aware slider lab that shows the directional visual effect of Fuji recipe parameters on a few curated reference photos.

## 2) Target users

1. **Fuji owners** who use Fuji X Weekly / recipe blogs and want to understand parameters instead of copy/pasting blindly.
2. **New Fuji users** learning core recipe knobs (highlight/shadow/DR/WB shift/chrome/grain/clarity).
3. **Creators** building their own recipes who need a rapid “concept sketch” before dialing in on-camera.

## 3) Value proposition

* **Consistent learning environment:** same images, same baseline, predictable comparisons.
* **Immediate feedback:** sliders update preview in real time.
* **Model-aware constraints:** the UI only shows parameters available on the selected Fujifilm camera generation/model (as a UX framing device, not accuracy claim).
* **Exportable recipe:** produces a Fuji-style recipe text block and JSON for sharing or later manual entry on camera.

## 4) Product principles (hard constraints)

1. **Credibility through framing:** never imply accuracy; explicitly state “approximate visualizer for learning.”
2. **Consistency:** fixed reference images only; no user upload.
3. **Fast iteration:** slider changes render instantly (with graceful quality scaling).
4. **Model-aware:** selection changes parameter availability/ranges and baseline looks.
5. **No clutter:** one screen, two panels, no wizard questionnaire.

## 5) Core UX / IA

### Single-screen layout

**Left (70% width): Preview stage**

* Image viewport with zoom/pan.
* Modes:

  * **After only** (default)
  * **Before/After toggle**
  * **Split view** with draggable divider (left=before, right=after)
* Overlays (toggles):

  * Histogram (Luma + RGB)
  * Clipping warnings (highlight/shadow)
  * Info: current model profile + recipe name

**Right (30% width): Parameters panel**

* Organized in collapsible groups:

  1. Film Sim / Base Look
  2. Tone (DR / Highlight / Shadow)
  3. Color (Color / Chrome / Blue / B&W toning)
  4. White Balance (Kelvin / preset / shift grid)
  5. Detail (Clarity / Sharpness / NR)
  6. Grain
* Each control has:

  * Label, value, range ticks
  * Reset button (per-control)
  * “Lock” toggle (prevents changes when switching models or base looks)
  * Tooltip (short: “what it does”)

**Bottom bar: Recipe management**

* Recipe name (editable)
* Save / Duplicate / Reset to baseline
* A/B slots:

  * Store A, Store B
  * Compare A/B (toggle, split)
* Export:

  * “Copy as Fuji recipe text”
  * “Copy JSON”
  * “Share link” (encodes state in URL)

### Navigation

* No multi-page flow.
* Optional “Learn” overlay: parameter glossary and a guided set of 3–5 “try this” presets.

## 6) Reference images (fixed set)

Provide **3 canonical images**, licensed for redistribution (critical). They must be high-resolution, balanced, and chosen to expose parameter effects:

1. **Landscape daylight**

   * Sky highlights + foliage saturation + midtone texture.
2. **Portrait daylight / open shade**

   * Accurate skin tones + subtle background colors.
3. **Night / low light**

   * Noise presence + colored lights + deep shadows.

**Requirements**

* Minimum 3000 px long edge.
* Neutral baseline exposure (no heavy grading).
* Include a color chart region if possible (small, subtle crop or second version used only internally).
* Store as:

  * Source: 16-bit TIFF/PNG (internal)
  * Delivery: optimized JPEG + optional WebP/AVIF.

**Image selector**

* Tabs: Landscape / Portrait / Night.
* Lock zoom per image.
* Remember last selected image per user session.

## 7) Camera model / sensor profiles (UX framing)

### Why profiles exist

Not to “match output,” but to:

* limit which parameters appear,
* tune default strengths/ranges,
* swap base LUT variants (subtle),
* set baseline starting points users recognize.

### MVP profile list

* **X-Trans III**
* **X-Trans IV** (covers X-T30)
* **X-Trans V**
* **Bayer (X-A series)** optional

### Model selection UI

* Dropdown:

  * “X-T30 (X-Trans IV)”
  * “X-T3 (X-Trans IV)”
  * “Generic X-Trans IV”
* Internally map to a **Profile ID**.

### Profile schema (JSON)

```json
{
  "profile_id": "xtrans4",
  "display_name": "X-Trans IV",
  "supported_params": {
    "film_sim": ["provia","velvia","astia","classic_chrome","classic_neg","eterna","acros","mono"],
    "dynamic_range": ["dr100","dr200","dr400"],
    "highlight": [-2,-1,0,1,2,3,4],
    "shadow": [-2,-1,0,1,2,3,4],
    "color": [-4,-3,-2,-1,0,1,2,3,4],
    "wb": ["auto","daylight","shade","tungsten","fluorescent","kelvin"],
    "wb_kelvin": [2500,10000],
    "wb_shift": {"a_b":[-9,9],"r_b":[-9,9]},
    "chrome": ["off","weak","strong"],
    "chrome_blue": ["off","weak","strong"],
    "clarity": [-5,-4,-3,-2,-1,0,1,2,3,4,5],
    "sharpness": [-4,-3,-2,-1,0,1,2,3,4],
    "noise_reduction": [-4,-3,-2,-1,0,1,2,3,4],
    "grain": ["off","weak","strong"],
    "grain_size": ["small","large"]
  },
  "defaults": {
    "film_sim": "provia",
    "dynamic_range": "dr100",
    "highlight": 0,
    "shadow": 0,
    "color": 0,
    "chrome": "off",
    "chrome_blue": "off",
    "clarity": 0,
    "sharpness": 0,
    "noise_reduction": 0,
    "grain": "off",
    "grain_size": "small",
    "wb": "auto",
    "wb_kelvin": 5600,
    "wb_shift": {"a_b":0,"r_b":0}
  },
  "strength_scalars": {
    "tone_curve": 1.0,
    "chrome": 1.0,
    "clarity": 1.0,
    "nr": 1.0,
    "grain": 1.0
  }
}
```

## 8) Rendering engine specification (approx pipeline)

### Input

* Fixed images in sRGB.
* Convert to linear RGB for processing.

### Processing order (deterministic)

1. **White balance**

   * If preset: map to target white point.
   * If Kelvin: compute white point along Planckian locus approximation.
   * WB shift: small chromatic adaptation tweak (LMS or OKLab offsets).
2. **Exposure normalization** (internal)

   * Keep overall brightness stable when DR changes.
3. **Tone curve**

   * Parametric curve with toe + shoulder.
   * Controls:

     * Shadow: toe lift/crush
     * Highlight: shoulder roll-off
     * DR: increases shoulder compression + mid lift
4. **Film sim / base look**

   * 3D LUT (33³ minimum; 65³ preferred for quality).
   * One LUT per film sim per profile (can reuse with minor variants).
5. **Color controls**

   * Color slider: saturation adjustment in OKLab / Lab
   * Chrome: saturation compression for high-sat regions + mild local chroma contrast
   * Chrome Blue: same but hue-masked to blues
   * B&W toning (if mono/acros): split-tone approximation (shadows/hi)
6. **Clarity**

   * Local contrast on luminance: radius 8–25 px depending on image scale.
7. **Noise reduction**

   * Edge-preserving smoothing on luminance:

     * guided filter / bilateral approximation
   * Strength mapped to slider.
8. **Sharpening**

   * Unsharp mask on luminance with threshold to avoid noise amplification.
9. **Grain**

   * Add film grain in luminance channel:

     * size: controls noise spatial frequency
     * strength: amplitude
     * modulate stronger in shadows
10. **Output**

* Convert back to sRGB, clamp, apply subtle dithering.

### Parameter mapping (important)

Fuji-style discrete values map into continuous internal coefficients. Example mappings:

* Highlight (−2..+4):

  * affects shoulder strength `k_shoulder`
  * exponential mapping so changes near 0 are noticeable, extremes compress harder.
* Shadow (−2..+4):

  * toe strength `k_toe`
* Color (−4..+4):

  * saturation multiplier `sat = 1 + 0.12*value` (tune)
* Clarity (−5..+5):

  * local contrast amount `lc = value * 0.08` with asymmetric scaling (negative should be gentler)
* NR (−4..+4):

  * smoothing sigma `sigma = base * 2^(value/2)` with clamp
* Sharpness (−4..+4):

  * unsharp amount `amount = base * 2^(value/3)` with threshold adjustments
* Chrome:

  * apply saturation compression coefficient `k = {0, 0.35, 0.7}`
* Grain:

  * `amp = {0, 0.04, 0.08}`; size selects grain scale

### Interactions layer (rule-based)

Apply these deterministic couplings after user input to produce “mix impacts output”:

* If NR ≥ +2: reduce effective sharpness by 15–35%.
* If Highlight ≥ +3: reduce clarity slightly to prevent harsh halos in bright edges.
* If Chrome = Strong and Color ≥ +2: cap saturation of high-sat pixels more aggressively (avoid candy colors).
* If DR400: apply stronger shoulder + slight mid lift + slight shadow lift to keep the image from looking underexposed.

## 9) Performance requirements

### Target devices

* Desktop first (Chrome, Edge, Safari).
* Mobile optional later; do not depend on mobile for MVP.

### FPS / latency

* Slider drag should feel immediate:

  * **Preview render < 60 ms** at half-res.
  * Full-res finalize within **200–400 ms** after user stops dragging.

### Multi-resolution strategy

* Render two pipelines:

  * **Interactive preview:** downscaled to viewport resolution.
  * **Final:** full resolution or 2× viewport, cached.

### Caching

Cache results by:

* image_id
* profile_id
* parameter hash (stable string)

## 10) Data model (recipes)

### Recipe object

```json
{
  "id": "uuid",
  "name": "Soft Chrome Night",
  "profile_id": "xtrans4",
  "base_image_id": "night_v1",
  "params": {
    "film_sim": "classic_chrome",
    "dynamic_range": "dr200",
    "highlight": -1,
    "shadow": 2,
    "color": -1,
    "chrome": "strong",
    "chrome_blue": "weak",
    "clarity": -2,
    "sharpness": -1,
    "noise_reduction": 1,
    "grain": "weak",
    "grain_size": "large",
    "wb": "kelvin",
    "wb_kelvin": 4300,
    "wb_shift": {"a_b": -2, "r_b": 3}
  },
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "tags": ["night","street","soft"]
}
```

### Export formats

1. **Fuji-style text block**

* Exactly formatted for copying into notes.
* Example output:

  * Film Sim: Classic Chrome
  * DR: DR200
  * Highlight: -1
  * Shadow: +2
  * Color: -1
  * Color Chrome: Strong
  * Color Chrome Blue: Weak
  * Clarity: -2
  * Sharpness: -1
  * NR: +1
  * Grain: Weak / Large
  * WB: 4300K, Shift A-2 R+3

2. **JSON**

* Full object above.

3. **URL share**

* Base64url-encoded params + profile + image id.
* Versioned schema: `v=1` for future compatibility.

## 11) Feature list (MVP vs later)

### MVP (ship this)

* Fixed 3 images
* Profile selection (X-Trans IV at minimum)
* Parameter panel with full set (gated by profile)
* Real-time preview (half-res interactive + full-res settle)
* Before/after toggle + split view
* Reset controls (per param + all)
* Save recipe locally (browser localStorage)
* Export recipe text + JSON
* Share link (state-in-URL)
* A/B compare two stored states

### V1.1 (high leverage)

* Preset gallery (10–20 curated example recipes)
* Parameter glossary overlay
* Sweep strips for key sliders (highlight/shadow/color/clarity)
* “Randomize within sane bounds” for exploration

### V2 (optional)

* More images (indoor tungsten, foliage close-up)
* More profiles (X-Trans III/V)
* Account sync (cloud recipes)
* Batch thumbnail compare (grid of recipes on one image)

## 12) Content + legal/licensing requirements

* All reference images must be **properly licensed** for redistribution and modification (commercial-safe).
* Provide attribution if required by license.
* If using any LUTs not authored internally, ensure their license permits:

  * redistribution,
  * modification,
  * commercial use.

## 13) Trust / messaging (must be explicit)

### In-product disclosure (non-negotiable)

A persistent “Approx” badge with tooltip:

* “This is an approximate visualizer for learning. Results are not guaranteed to match your camera. Use exports as starting points.”

### Avoid claims

* Do not say “simulate Fuji JPEG engine.”
* Do not claim per-model accuracy.
* Do not use Fujifilm trademarks in a way that implies endorsement.

## 14) Tech stack recommendation (pragmatic MVP)

### Web app (recommended)

* Rendering: **WebGL2** (widest support)

  * LUT via 3D texture emulation (2D atlas) or 3D textures where supported.
* UI: React + lightweight state (Zustand)
* Storage: localStorage + optional export/import file
* Build: Vite

### Why WebGL2

* Fast per-pixel operations (curves, LUT, chroma ops).
* Enough for local contrast via multi-pass blur.
* Avoid CPU-heavy image processing.

### CPU fallback

* If WebGL unavailable: disable clarity/NR (or provide simplified CPU versions), keep tone + LUT.

## 15) Engineering tasks breakdown (implementation spec)

### A) Rendering pipeline (WebGL)

Passes:

1. Linearize + WB
2. Tone curve (1D LUT texture)
3. Film sim (3D LUT)
4. Color ops (saturation + chrome + hue masks)
5. Local contrast (blur + high-pass)
6. NR (optional approximation; or skip in MVP if too heavy)
7. Sharpen
8. Grain
9. Output to screen

### B) Parameter system

* Central parameter store with:

  * validation against profile ranges,
  * serialization,
  * diffing for UI.

### C) Profiles

* Static JSON definitions shipped with app.
* UI binds controls dynamically based on profile schema.

### D) Presets

* A few shipped recipes per profile.
* Toggle “apply preset” without overwriting locked params.

### E) Export

* Deterministic formatting and ordering.
* Copy-to-clipboard.

### F) QA checklist

* Slider edges: no clipping artifacts / banding
* Split view correct alignment at all zoom levels
* Performance: no stutter while dragging
* Share links stable across reloads
* Profile gating prevents impossible states

## 16) Acceptance criteria (definition of done)

1. User can pick one of 3 images and one camera profile.
2. User can adjust every displayed parameter and see immediate visual change.
3. UI never exposes parameters not supported by the chosen profile.
4. Before/After and Split view work at any zoom.
5. User can save, duplicate, reset, A/B compare.
6. Exported text matches the UI values exactly and is copyable.
7. Share link reproduces exact state.
8. App clearly states it’s approximate and not camera-accurate.

## 17) Concrete parameter glossary (for tooltips)

* **Highlight:** compresses or boosts bright tones; affects sky/bright skin.
* **Shadow:** lifts or deepens dark tones; affects contrast and mood.
* **Dynamic Range:** protects highlights by compressing top end and remapping midtones.
* **Color:** global saturation.
* **Color Chrome:** reduces “neon” saturation in intense colors; adds density.
* **Color Chrome Blue:** same but targeted to blues.
* **Clarity:** local contrast; increases texture and edge “bite.”
* **Sharpness:** edge enhancement; increases perceived detail.
* **Noise Reduction:** smooths noise; can remove fine detail.
* **Grain:** adds film-like texture; stronger in shadows.
* **WB Kelvin:** warms/cools overall color temperature.
* **WB Shift:** nudges tint along amber/blue and magenta/green axes.


