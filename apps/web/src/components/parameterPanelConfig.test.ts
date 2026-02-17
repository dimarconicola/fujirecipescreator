import { describe, expect, it } from "vitest";
import { validateProfile, type RecipeParams } from "@fuji/domain";
import xtrans4ProfileJson from "../../../../profiles/xtrans4.json";
import { buildParameterGroups } from "./parameterPanelConfig";

const profile = validateProfile(xtrans4ProfileJson);

function createParams(overrides: Partial<RecipeParams> = {}): RecipeParams {
  return {
    ...profile.defaults,
    ...overrides,
    wb_shift: {
      ...profile.defaults.wb_shift,
      ...(overrides.wb_shift ?? {}),
    },
  };
}

function findControl(groups: ReturnType<typeof buildParameterGroups>, key: string) {
  for (const group of groups) {
    for (const control of group.controls) {
      if (control.key === key) {
        return control;
      }
    }
  }

  return null;
}

describe("buildParameterGroups", () => {
  it("builds the expected grouped control surface from profile schema", () => {
    const groups = buildParameterGroups(profile, createParams());

    expect(groups.map((group) => group.id)).toEqual([
      "film",
      "tone",
      "color",
      "wb",
      "detail",
      "grain",
    ]);
    expect(findControl(groups, "film_sim")).not.toBeNull();
    expect(findControl(groups, "dynamic_range")).not.toBeNull();
    expect(findControl(groups, "chrome_blue")).not.toBeNull();
    expect(findControl(groups, "wb_shift")).not.toBeNull();
    expect(findControl(groups, "noise_reduction")).not.toBeNull();
  });

  it("only shows kelvin slider when wb mode is kelvin", () => {
    const autoGroups = buildParameterGroups(profile, createParams({ wb: "auto" }));
    const autoKelvinControl = findControl(autoGroups, "wb_kelvin");
    expect(autoKelvinControl).toMatchObject({ hidden: true });

    const kelvinGroups = buildParameterGroups(profile, createParams({ wb: "kelvin" }));
    const kelvinControl = findControl(kelvinGroups, "wb_kelvin");
    expect(kelvinControl).toMatchObject({ hidden: false });
  });

  it("hides grain size control when grain effect is off", () => {
    const grainOffGroups = buildParameterGroups(profile, createParams({ grain: "off" }));
    const grainSizeOff = findControl(grainOffGroups, "grain_size");
    expect(grainSizeOff).toMatchObject({ hidden: true });

    const grainOnGroups = buildParameterGroups(profile, createParams({ grain: "strong" }));
    const grainSizeOn = findControl(grainOnGroups, "grain_size");
    expect(grainSizeOn).toMatchObject({ hidden: false });
  });

  it("omits controls that have only one supported fixed value", () => {
    const limitedProfile = {
      ...profile,
      supported_params: {
        ...profile.supported_params,
        chrome_blue: ["off"],
        clarity: [0],
        grain_size: ["small"],
      },
    };

    const groups = buildParameterGroups(limitedProfile, createParams());

    expect(findControl(groups, "chrome_blue")).toBeNull();
    expect(findControl(groups, "clarity")).toBeNull();
    expect(findControl(groups, "grain_size")).toBeNull();
  });
});
