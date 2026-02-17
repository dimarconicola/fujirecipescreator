import { describe, expect, it } from "vitest";
import { createParameterStore, defaultProfile } from "./parameterStore";

describe("parameter store", () => {
  it("normalizes out-of-range numeric values", () => {
    const store = createParameterStore();
    store.getState().setParam("highlight", 999);
    store.getState().setParam("color", -999);

    expect(store.getState().params.highlight).toBe(4);
    expect(store.getState().params.color).toBe(-4);
  });

  it("resets individual params and all params", () => {
    const store = createParameterStore();

    store.getState().setParam("shadow", 4);
    store.getState().setWbShift("a_b", 8);
    store.getState().resetParam("shadow");
    expect(store.getState().params.shadow).toBe(defaultProfile.defaults.shadow);

    store.getState().resetAll();
    expect(store.getState().params.wb_shift).toEqual(defaultProfile.defaults.wb_shift);
  });

  it("preserves locked values when applying a new compatible profile", () => {
    const store = createParameterStore();
    store.getState().setParam("highlight", 3);
    store.getState().toggleLock("highlight");

    const nextProfile = {
      ...defaultProfile,
      defaults: {
        ...defaultProfile.defaults,
        highlight: -2,
      },
    };

    store.getState().applyProfile(nextProfile);

    expect(store.getState().params.highlight).toBe(3);
  });

  it("uses incoming defaults when values are unlocked during profile apply", () => {
    const store = createParameterStore();
    store.getState().setParam("highlight", 3);

    const nextProfile = {
      ...defaultProfile,
      defaults: {
        ...defaultProfile.defaults,
        highlight: -2,
      },
    };

    store.getState().applyProfile(nextProfile);

    expect(store.getState().params.highlight).toBe(-2);
  });

  it("normalizes and applies a full params snapshot", () => {
    const store = createParameterStore();

    store.getState().replaceParams({
      ...defaultProfile.defaults,
      highlight: 999,
      grain: "unsupported",
      wb_shift: {
        a_b: 22,
        r_b: -22,
      },
    });

    const state = store.getState();
    expect(state.params.highlight).toBe(4);
    expect(state.params.grain).toBe(defaultProfile.defaults.grain);
    expect(state.params.wb_shift).toEqual({ a_b: 9, r_b: -9 });
  });

  it("randomizes safely within supported profile bounds and honors locks", () => {
    const store = createParameterStore();
    const { profile } = store.getState();

    store.getState().setParam("highlight", 2);
    store.getState().toggleLock("highlight");
    store.getState().randomizeWithinSafeBounds();

    const { params } = store.getState();

    expect(params.highlight).toBe(2);
    expect(profile.supported_params.film_sim).toContain(params.film_sim);
    expect(profile.supported_params.dynamic_range).toContain(params.dynamic_range);
    expect(profile.supported_params.shadow).toContain(params.shadow);
    expect(profile.supported_params.color).toContain(params.color);
    expect(profile.supported_params.chrome).toContain(params.chrome);
    expect(profile.supported_params.chrome_blue).toContain(params.chrome_blue);
    expect(profile.supported_params.clarity).toContain(params.clarity);
    expect(profile.supported_params.sharpness).toContain(params.sharpness);
    expect(profile.supported_params.noise_reduction).toContain(params.noise_reduction);
    expect(profile.supported_params.grain).toContain(params.grain);
    expect(profile.supported_params.grain_size).toContain(params.grain_size);
    expect(profile.supported_params.wb).toContain(params.wb);
    expect(params.wb_kelvin).toBeGreaterThanOrEqual(profile.supported_params.wb_kelvin[0]);
    expect(params.wb_kelvin).toBeLessThanOrEqual(profile.supported_params.wb_kelvin[1]);
    expect(params.wb_shift.a_b).toBeGreaterThanOrEqual(profile.supported_params.wb_shift.a_b[0]);
    expect(params.wb_shift.a_b).toBeLessThanOrEqual(profile.supported_params.wb_shift.a_b[1]);
    expect(params.wb_shift.r_b).toBeGreaterThanOrEqual(profile.supported_params.wb_shift.r_b[0]);
    expect(params.wb_shift.r_b).toBeLessThanOrEqual(profile.supported_params.wb_shift.r_b[1]);
  });
});
