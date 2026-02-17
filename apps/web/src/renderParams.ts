import type { Profile, RecipeParams } from "@fuji/domain";
import {
  DEFAULT_APPROX_STRENGTH_SCALARS,
  type ApproxRenderParams,
} from "@fuji/engine-webgl";

type ProfileStrengthScalars = Profile["strength_scalars"];

function toApproxStrengthScalars(
  strengthScalars?: ProfileStrengthScalars,
): NonNullable<ApproxRenderParams["strengthScalars"]> {
  if (!strengthScalars) {
    return DEFAULT_APPROX_STRENGTH_SCALARS;
  }

  return {
    toneCurve: strengthScalars.tone_curve,
    chrome: strengthScalars.chrome,
    clarity: strengthScalars.clarity,
    nr: strengthScalars.nr,
    grain: strengthScalars.grain,
  };
}

export function toApproxRenderParams(
  params: RecipeParams,
  strengthScalars?: ProfileStrengthScalars,
): ApproxRenderParams {
  return {
    filmSim: params.film_sim,
    dynamicRange: params.dynamic_range as ApproxRenderParams["dynamicRange"],
    highlight: params.highlight,
    shadow: params.shadow,
    color: params.color,
    chrome: params.chrome,
    chromeBlue: params.chrome_blue,
    clarity: params.clarity,
    sharpness: params.sharpness,
    noiseReduction: params.noise_reduction,
    grain: params.grain,
    grainSize: params.grain_size,
    wbMode: params.wb,
    wbKelvin: params.wb_kelvin,
    wbShift: params.wb_shift,
    strengthScalars: toApproxStrengthScalars(strengthScalars),
  };
}
