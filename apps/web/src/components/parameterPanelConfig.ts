import type { Profile, RecipeParams } from "@fuji/domain";
import type { ParamKey } from "../state/parameterStore";

type EnumParamKey = Extract<
  ParamKey,
  "film_sim" | "dynamic_range" | "chrome" | "chrome_blue" | "grain" | "grain_size" | "wb"
>;
type NumberParamKey = Extract<
  ParamKey,
  "highlight" | "shadow" | "color" | "clarity" | "sharpness" | "noise_reduction" | "wb_kelvin"
>;

export type EnumControl = {
  kind: "enum";
  key: EnumParamKey;
  label: string;
  options: readonly string[];
  hidden?: boolean;
};

export type NumberControl = {
  kind: "number";
  key: NumberParamKey;
  label: string;
  min: number;
  max: number;
  step?: number;
  hidden?: boolean;
};

export type WbShiftControl = {
  kind: "wb_shift";
  key: "wb_shift";
  label: string;
  minA: number;
  maxA: number;
  minR: number;
  maxR: number;
};

export type ParameterControl = EnumControl | NumberControl | WbShiftControl;

export type ParameterGroup = {
  id: string;
  label: string;
  controls: ParameterControl[];
};

function rangeFromValues(values: readonly number[]): { min: number; max: number } {
  return {
    min: values[0],
    max: values[values.length - 1],
  };
}

function buildEnumControl(
  key: EnumParamKey,
  label: string,
  options: readonly string[],
  hidden = false,
): EnumControl | null {
  if (options.length <= 1) {
    return null;
  }

  return {
    kind: "enum",
    key,
    label,
    options,
    hidden,
  };
}

function buildNumberControl(
  key: NumberParamKey,
  label: string,
  values: readonly number[],
  step = 1,
  hidden = false,
): NumberControl | null {
  if (values.length === 0) {
    return null;
  }

  const range = rangeFromValues(values);
  if (range.min === range.max) {
    return null;
  }
  return {
    kind: "number",
    key,
    label,
    min: range.min,
    max: range.max,
    step,
    hidden,
  };
}

function buildBoundedNumberControl(
  key: NumberParamKey,
  label: string,
  bounds: readonly [number, number],
  step = 1,
  hidden = false,
): NumberControl | null {
  if (bounds[0] > bounds[1] || bounds[0] === bounds[1]) {
    return null;
  }

  return {
    kind: "number",
    key,
    label,
    min: bounds[0],
    max: bounds[1],
    step,
    hidden,
  };
}

function withControls(id: string, label: string, controls: Array<ParameterControl | null>) {
  return {
    id,
    label,
    controls: controls.filter((control): control is ParameterControl => control !== null),
  };
}

export function buildParameterGroups(profile: Profile, params: RecipeParams): ParameterGroup[] {
  const supported = profile.supported_params;

  const groups: ParameterGroup[] = [
    withControls("film", "Film Sim / Base Look", [
      buildEnumControl("film_sim", "Film Simulation", supported.film_sim),
    ]),
    withControls("tone", "Tone", [
      buildEnumControl("dynamic_range", "Dynamic Range", supported.dynamic_range),
      buildNumberControl("highlight", "Highlight", supported.highlight),
      buildNumberControl("shadow", "Shadow", supported.shadow),
    ]),
    withControls("color", "Color", [
      buildNumberControl("color", "Color", supported.color),
      buildEnumControl("chrome", "Color Chrome Effect", supported.chrome),
      buildEnumControl("chrome_blue", "Color Chrome FX Blue", supported.chrome_blue),
    ]),
    withControls("wb", "White Balance", [
      buildEnumControl("wb", "WB Mode", supported.wb),
      buildBoundedNumberControl(
        "wb_kelvin",
        "WB Kelvin",
        supported.wb_kelvin,
        100,
        params.wb !== "kelvin",
      ),
      {
        kind: "wb_shift",
        key: "wb_shift",
        label: "WB Shift",
        minA: supported.wb_shift.a_b[0],
        maxA: supported.wb_shift.a_b[1],
        minR: supported.wb_shift.r_b[0],
        maxR: supported.wb_shift.r_b[1],
      },
    ]),
    withControls("detail", "Detail", [
      buildNumberControl("clarity", "Clarity", supported.clarity),
      buildNumberControl("sharpness", "Sharpness", supported.sharpness),
      buildNumberControl("noise_reduction", "Noise Reduction", supported.noise_reduction),
    ]),
    withControls("grain", "Grain", [
      buildEnumControl("grain", "Grain Effect", supported.grain),
      buildEnumControl("grain_size", "Grain Size", supported.grain_size, params.grain === "off"),
    ]),
  ];

  return groups.filter((group) => group.controls.length > 0);
}
