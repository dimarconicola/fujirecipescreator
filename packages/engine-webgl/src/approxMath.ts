export type ApproxRenderParams = {
  filmSim: string;
  dynamicRange: "dr100" | "dr200" | "dr400";
  highlight: number;
  shadow: number;
  color: number;
  chrome: string;
  chromeBlue: string;
  clarity: number;
  sharpness: number;
  noiseReduction: number;
  grain: string;
  grainSize: string;
  wbMode: string;
  wbKelvin: number;
  wbShift: {
    a_b: number;
    r_b: number;
  };
  strengthScalars?: ApproxStrengthScalars;
};

export type ApproxUniforms = {
  wbMultipliers: [number, number, number];
  saturation: number;
  shadow: number;
  highlight: number;
  dynamicRangeCompression: number;
  filmSimId: number;
  clarity: number;
  sharpness: number;
  noiseReduction: number;
  chromeStrength: number;
  chromeBlueStrength: number;
  grainAmount: number;
  grainSize: number;
};

export type ApproxStrengthScalars = {
  toneCurve: number;
  chrome: number;
  clarity: number;
  nr: number;
  grain: number;
};

export const DEFAULT_APPROX_STRENGTH_SCALARS: ApproxStrengthScalars = {
  toneCurve: 1,
  chrome: 1,
  clarity: 1,
  nr: 1,
  grain: 1,
};

const WB_PRESET_TO_KELVIN: Record<string, number> = {
  auto: 5600,
  daylight: 5600,
  shade: 7000,
  tungsten: 3200,
  fluorescent: 4300,
  kelvin: 5600,
};

const FILM_SIM_TO_ID: Record<string, number> = {
  provia: 0,
  velvia: 1,
  astia: 2,
  classic_chrome: 3,
  classic_neg: 4,
  eterna: 5,
  acros: 6,
  mono: 7,
};

const DYNAMIC_RANGE_COMPRESSION: Record<ApproxRenderParams["dynamicRange"], number> = {
  dr100: 0,
  dr200: 0.15,
  dr400: 0.28,
};

const GRAIN_AMOUNT_BY_SETTING: Record<string, number> = {
  off: 0,
  weak: 0.022,
  strong: 0.042,
};

const GRAIN_SIZE_TO_VALUE: Record<string, number> = {
  small: 0,
  large: 1,
};

const CHROME_STRENGTH_BY_SETTING: Record<string, number> = {
  off: 0,
  weak: 0.5,
  strong: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveStrengthScalars(params: ApproxRenderParams): ApproxStrengthScalars {
  const input = params.strengthScalars;

  if (!input) {
    return DEFAULT_APPROX_STRENGTH_SCALARS;
  }

  return {
    toneCurve: clamp(input.toneCurve, 0.5, 1.5),
    chrome: clamp(input.chrome, 0.5, 1.5),
    clarity: clamp(input.clarity, 0.5, 1.5),
    nr: clamp(input.nr, 0.5, 1.5),
    grain: clamp(input.grain, 0.5, 1.5),
  };
}

function resolveKelvin(params: ApproxRenderParams): number {
  if (params.wbMode === "kelvin") {
    return params.wbKelvin;
  }

  return WB_PRESET_TO_KELVIN[params.wbMode] ?? 5600;
}

export function computeWbMultipliers(params: ApproxRenderParams): [number, number, number] {
  const kelvin = resolveKelvin(params);
  const kelvinNorm = clamp((kelvin - 5600) / 4400, -1, 1);
  const amberBlue = clamp(params.wbShift.a_b / 9, -1, 1);
  const redBlue = clamp(params.wbShift.r_b / 9, -1, 1);

  const r = clamp(1 + kelvinNorm * 0.2 + amberBlue * 0.12 + redBlue * 0.08, 0.7, 1.3);
  const g = clamp(1 - amberBlue * 0.04, 0.75, 1.25);
  const b = clamp(1 - kelvinNorm * 0.2 - amberBlue * 0.12 - redBlue * 0.08, 0.7, 1.3);

  return [r, g, b];
}

export function resolveFilmSimId(filmSim: string): number {
  return FILM_SIM_TO_ID[filmSim] ?? FILM_SIM_TO_ID.provia;
}

export function buildApproxUniforms(params: ApproxRenderParams): ApproxUniforms {
  const strengthScalars = resolveStrengthScalars(params);
  const noiseReduction = clamp(
    (0.28 + params.noiseReduction * 0.09) * strengthScalars.nr,
    0,
    1,
  );
  const clarity = clamp((params.clarity / 8) * strengthScalars.clarity, -0.75, 0.75);
  const sharpnessBase = clamp(0.35 + params.sharpness * 0.1, 0, 1);
  const clarityPenalty = clarity < 0 ? Math.abs(clarity) * 0.35 : 0;
  const sharpness = clamp(
    sharpnessBase * (1 - noiseReduction * 0.4) * (1 - clarityPenalty),
    0,
    1,
  );

  const grainBase = GRAIN_AMOUNT_BY_SETTING[params.grain] ?? GRAIN_AMOUNT_BY_SETTING.off;
  const grainAmount = clamp(
    grainBase * (1 - noiseReduction * 0.45) * strengthScalars.grain,
    0,
    0.08,
  );
  const grainSize = grainAmount === 0 ? 0 : GRAIN_SIZE_TO_VALUE[params.grainSize] ?? 0;
  const chromeStrength = clamp(
    (CHROME_STRENGTH_BY_SETTING[params.chrome] ?? 0) * strengthScalars.chrome,
    0,
    1,
  );
  const chromeBlueStrength = clamp(
    (CHROME_STRENGTH_BY_SETTING[params.chromeBlue] ?? 0) * strengthScalars.chrome,
    0,
    1,
  );
  const toneCurveScalar = strengthScalars.toneCurve;
  const baseDynamicRangeCompression =
    DYNAMIC_RANGE_COMPRESSION[params.dynamicRange] ?? DYNAMIC_RANGE_COMPRESSION.dr100;

  return {
    wbMultipliers: computeWbMultipliers(params),
    saturation: clamp(1 + params.color * 0.12, 0.2, 2.0),
    shadow: clamp((params.shadow / 4) * toneCurveScalar, -1.0, 1.0),
    highlight: clamp((params.highlight / 4) * toneCurveScalar, -1.0, 1.0),
    dynamicRangeCompression: clamp(baseDynamicRangeCompression * toneCurveScalar, 0, 0.6),
    filmSimId: resolveFilmSimId(params.filmSim),
    clarity,
    sharpness,
    noiseReduction,
    chromeStrength,
    chromeBlueStrength,
    grainAmount,
    grainSize,
  };
}
