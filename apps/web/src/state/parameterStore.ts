import {
  getRecipeCompatibilityIssues,
  type Profile,
  type RecipeParams,
  validateProfile,
} from "@fuji/domain";
import { create } from "zustand";
import xtrans5ProfileJson from "../../../../profiles/xtrans5.json";

export type ParamKey = keyof RecipeParams;
type WbShiftAxis = keyof RecipeParams["wb_shift"];
type ParameterLocks = Record<ParamKey, boolean>;

const PARAM_KEYS: ParamKey[] = [
  "film_sim",
  "dynamic_range",
  "highlight",
  "shadow",
  "color",
  "chrome",
  "chrome_blue",
  "clarity",
  "sharpness",
  "noise_reduction",
  "grain",
  "grain_size",
  "wb",
  "wb_kelvin",
  "wb_shift",
];

const defaultLocks: ParameterLocks = {
  film_sim: false,
  dynamic_range: false,
  highlight: false,
  shadow: false,
  color: false,
  chrome: false,
  chrome_blue: false,
  clarity: false,
  sharpness: false,
  noise_reduction: false,
  grain: false,
  grain_size: false,
  wb: false,
  wb_kelvin: false,
  wb_shift: false,
};

export const defaultProfile = validateProfile(xtrans5ProfileJson);

function profileDefaultsToParams(profile: Profile): RecipeParams {
  return {
    ...profile.defaults,
    wb_shift: {
      ...profile.defaults.wb_shift,
    },
  };
}

function nearestValue(target: number, allowed: readonly number[]): number {
  return allowed.reduce((closest, candidate) => {
    if (Math.abs(candidate - target) < Math.abs(closest - target)) {
      return candidate;
    }
    return closest;
  }, allowed[0]);
}

function clampToRange(value: number, bounds: readonly [number, number]): number {
  return Math.round(Math.min(Math.max(value, bounds[0]), bounds[1]));
}

function normalizeEnum(value: string, options: readonly string[], fallback: string): string {
  return options.includes(value) ? value : fallback;
}

function randomFromList<T>(values: readonly T[]): T {
  const index = Math.floor(Math.random() * values.length);
  return values[index];
}

function randomFromMiddleBand(values: readonly number[]): number {
  if (values.length <= 2) {
    return randomFromList(values);
  }

  const start = Math.floor(values.length * 0.2);
  const end = Math.max(start, Math.ceil(values.length * 0.8) - 1);
  const band = values.slice(start, end + 1);
  return randomFromList(band);
}

function randomIntegerInRange(min: number, max: number): number {
  if (min >= max) {
    return min;
  }

  const value = min + Math.floor(Math.random() * (max - min + 1));
  return value;
}

function normalizeParamValue(
  profile: Profile,
  key: ParamKey,
  value: RecipeParams[ParamKey],
): RecipeParams[ParamKey] {
  const supported = profile.supported_params;
  const defaults = profile.defaults;

  switch (key) {
    case "film_sim":
      return normalizeEnum(String(value), supported.film_sim, defaults.film_sim);
    case "dynamic_range":
      return normalizeEnum(
        String(value),
        supported.dynamic_range,
        defaults.dynamic_range,
      );
    case "highlight":
      return nearestValue(Number(value), supported.highlight);
    case "shadow":
      return nearestValue(Number(value), supported.shadow);
    case "color":
      return nearestValue(Number(value), supported.color);
    case "chrome":
      return normalizeEnum(String(value), supported.chrome, defaults.chrome);
    case "chrome_blue":
      return normalizeEnum(String(value), supported.chrome_blue, defaults.chrome_blue);
    case "clarity":
      return nearestValue(Number(value), supported.clarity);
    case "sharpness":
      return nearestValue(Number(value), supported.sharpness);
    case "noise_reduction":
      return nearestValue(Number(value), supported.noise_reduction);
    case "grain":
      return normalizeEnum(String(value), supported.grain, defaults.grain);
    case "grain_size":
      return normalizeEnum(String(value), supported.grain_size, defaults.grain_size);
    case "wb":
      return normalizeEnum(String(value), supported.wb, defaults.wb);
    case "wb_kelvin":
      return clampToRange(Number(value), supported.wb_kelvin);
    case "wb_shift": {
      const wbShift = value as RecipeParams["wb_shift"];
      return {
        a_b: clampToRange(wbShift.a_b, supported.wb_shift.a_b),
        r_b: clampToRange(wbShift.r_b, supported.wb_shift.r_b),
      } as RecipeParams[ParamKey];
    }
    default:
      return value;
  }
}

function setParamValue<K extends ParamKey>(
  params: RecipeParams,
  key: K,
  value: RecipeParams[K],
): RecipeParams {
  if (key === "wb_shift") {
    return {
      ...params,
      wb_shift: {
        ...(value as RecipeParams["wb_shift"]),
      },
    };
  }

  return {
    ...params,
    [key]: value,
  } as RecipeParams;
}

function normalizeParams(profile: Profile, params: RecipeParams): RecipeParams {
  let normalized: RecipeParams = {
    ...params,
    wb_shift: {
      ...params.wb_shift,
    },
  };

  for (const key of PARAM_KEYS) {
    const normalizedValue = normalizeParamValue(profile, key, normalized[key]);
    normalized = setParamValue(normalized, key, normalizedValue);
  }

  return normalized;
}

function buildCompatibilityMessages(profile: Profile, params: RecipeParams): string[] {
  return getRecipeCompatibilityIssues(
    { profile_id: profile.profile_id, params },
    profile,
  ).map((issue) => `${issue.path}: ${issue.message}`);
}

export type ParameterStoreState = {
  profile: Profile;
  params: RecipeParams;
  locks: ParameterLocks;
  compatibilityIssues: string[];
  setParam: (key: ParamKey, value: RecipeParams[ParamKey]) => void;
  setWbShift: (axis: WbShiftAxis, value: number) => void;
  replaceParams: (params: RecipeParams) => void;
  randomizeWithinSafeBounds: () => void;
  resetParam: (key: ParamKey) => void;
  resetAll: () => void;
  toggleLock: (key: ParamKey) => void;
  applyProfile: (input: unknown) => void;
};

export function createParameterStore(initialProfile: Profile = defaultProfile) {
  const initialParams = normalizeParams(initialProfile, profileDefaultsToParams(initialProfile));

  return create<ParameterStoreState>((set, get) => ({
    profile: initialProfile,
    params: initialParams,
    locks: {
      ...defaultLocks,
    },
    compatibilityIssues: buildCompatibilityMessages(initialProfile, initialParams),
    setParam: (key, value) => {
      if (get().locks[key]) {
        return;
      }

      set((state) => {
        const normalizedValue = normalizeParamValue(state.profile, key, value);
        const nextParams = setParamValue(state.params, key, normalizedValue);

        return {
          params: nextParams,
          compatibilityIssues: buildCompatibilityMessages(state.profile, nextParams),
        };
      });
    },
    setWbShift: (axis, value) => {
      const current = get().params.wb_shift;
      const next = {
        ...current,
        [axis]: value,
      };
      get().setParam("wb_shift", next);
    },
    replaceParams: (params) => {
      set((state) => {
        const nextParams = normalizeParams(state.profile, params);

        return {
          params: nextParams,
          compatibilityIssues: buildCompatibilityMessages(state.profile, nextParams),
        };
      });
    },
    randomizeWithinSafeBounds: () => {
      set((state) => {
        const supported = state.profile.supported_params;
        const next = {
          ...state.params,
          wb_shift: {
            ...state.params.wb_shift,
          },
        };

        if (!state.locks.film_sim) {
          next.film_sim = randomFromList(supported.film_sim);
        }
        if (!state.locks.dynamic_range) {
          next.dynamic_range = randomFromList(supported.dynamic_range);
        }
        if (!state.locks.highlight) {
          next.highlight = randomFromMiddleBand(supported.highlight);
        }
        if (!state.locks.shadow) {
          next.shadow = randomFromMiddleBand(supported.shadow);
        }
        if (!state.locks.color) {
          next.color = randomFromMiddleBand(supported.color);
        }
        if (!state.locks.chrome) {
          next.chrome = randomFromList(supported.chrome);
        }
        if (!state.locks.chrome_blue) {
          next.chrome_blue = randomFromList(supported.chrome_blue);
        }
        if (!state.locks.clarity) {
          next.clarity = randomFromMiddleBand(supported.clarity);
        }
        if (!state.locks.sharpness) {
          next.sharpness = randomFromMiddleBand(supported.sharpness);
        }
        if (!state.locks.noise_reduction) {
          next.noise_reduction = randomFromMiddleBand(supported.noise_reduction);
        }
        if (!state.locks.grain) {
          next.grain = randomFromList(supported.grain);
        }
        if (!state.locks.grain_size) {
          next.grain_size =
            next.grain === "off"
              ? state.profile.defaults.grain_size
              : randomFromList(supported.grain_size);
        }
        if (!state.locks.wb) {
          next.wb = randomFromList(supported.wb);
        }
        if (!state.locks.wb_kelvin) {
          const kelvinMin = Math.round(
            supported.wb_kelvin[0] + (supported.wb_kelvin[1] - supported.wb_kelvin[0]) * 0.25,
          );
          const kelvinMax = Math.round(
            supported.wb_kelvin[0] + (supported.wb_kelvin[1] - supported.wb_kelvin[0]) * 0.85,
          );
          next.wb_kelvin = randomIntegerInRange(kelvinMin, kelvinMax);
        }
        if (!state.locks.wb_shift) {
          const [aMin, aMax] = supported.wb_shift.a_b;
          const [rMin, rMax] = supported.wb_shift.r_b;
          const safeAMin = Math.ceil(aMin * 0.6);
          const safeAMax = Math.floor(aMax * 0.6);
          const safeRMin = Math.ceil(rMin * 0.6);
          const safeRMax = Math.floor(rMax * 0.6);

          next.wb_shift = {
            a_b: randomIntegerInRange(safeAMin, safeAMax),
            r_b: randomIntegerInRange(safeRMin, safeRMax),
          };
        }

        const normalized = normalizeParams(state.profile, next);
        return {
          params: normalized,
          compatibilityIssues: buildCompatibilityMessages(state.profile, normalized),
        };
      });
    },
    resetParam: (key) => {
      set((state) => {
        const defaults = profileDefaultsToParams(state.profile);
        const nextParams = setParamValue(state.params, key, defaults[key]);

        return {
          params: nextParams,
          compatibilityIssues: buildCompatibilityMessages(state.profile, nextParams),
        };
      });
    },
    resetAll: () => {
      set((state) => {
        const nextParams = normalizeParams(
          state.profile,
          profileDefaultsToParams(state.profile),
        );

        return {
          params: nextParams,
          compatibilityIssues: buildCompatibilityMessages(state.profile, nextParams),
        };
      });
    },
    toggleLock: (key) => {
      set((state) => ({
        locks: {
          ...state.locks,
          [key]: !state.locks[key],
        },
      }));
    },
    applyProfile: (input) => {
      const nextProfile = validateProfile(input);

      set((state) => {
        const nextDefaults = normalizeParams(
          nextProfile,
          profileDefaultsToParams(nextProfile),
        );

        let nextParams: RecipeParams = {
          ...nextDefaults,
          wb_shift: {
            ...nextDefaults.wb_shift,
          },
        };

        for (const key of PARAM_KEYS) {
          if (!state.locks[key]) {
            continue;
          }

          const currentValue = state.params[key];
          const normalizedCurrentValue = normalizeParamValue(
            nextProfile,
            key,
            currentValue,
          );
          const isValidPreservedValue =
            JSON.stringify(normalizedCurrentValue) === JSON.stringify(currentValue);

          if (isValidPreservedValue) {
            nextParams = setParamValue(nextParams, key, currentValue);
          }
        }

        return {
          profile: nextProfile,
          params: nextParams,
          compatibilityIssues: buildCompatibilityMessages(nextProfile, nextParams),
        };
      });
    },
  }));
}

export const useParameterStore = createParameterStore();
