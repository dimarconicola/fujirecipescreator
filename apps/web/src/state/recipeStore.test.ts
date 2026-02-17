import { beforeEach, describe, expect, it } from "vitest";
import type { RecipeParams } from "@fuji/domain";
import { defaultProfile } from "./parameterStore";
import { useRecipeStore } from "./recipeStore";

function createParams(overrides: Partial<RecipeParams> = {}): RecipeParams {
  return {
    ...defaultProfile.defaults,
    ...overrides,
    wb_shift: {
      ...defaultProfile.defaults.wb_shift,
      ...(overrides.wb_shift ?? {}),
    },
  };
}

function resetRecipeStore(): void {
  useRecipeStore.setState({
    recipes: [],
    activeRecipeId: null,
    recipeName: "Untitled Recipe",
    slots: {
      A: null,
      B: null,
    },
  });
}

describe("recipe store", () => {
  beforeEach(() => {
    resetRecipeStore();
  });

  it("saves and loads recipes", () => {
    useRecipeStore.getState().setRecipeName("Night Lab");

    const saved = useRecipeStore.getState().saveCurrentRecipe({
      profileId: defaultProfile.profile_id,
      baseImageId: "night_v1",
      params: createParams({ film_sim: "classic_chrome" }),
    });

    expect(saved.name).toBe("Night Lab");
    expect(useRecipeStore.getState().recipes).toHaveLength(1);

    const loaded = useRecipeStore.getState().loadRecipe(saved.id);

    expect(loaded?.base_image_id).toBe("night_v1");
    expect(loaded?.params.film_sim).toBe("classic_chrome");
  });

  it("duplicates the active recipe", () => {
    useRecipeStore.getState().setRecipeName("Base");

    const saved = useRecipeStore.getState().saveCurrentRecipe({
      profileId: defaultProfile.profile_id,
      baseImageId: "landscape_v1",
      params: createParams(),
    });

    const duplicated = useRecipeStore.getState().duplicateActiveRecipe();

    expect(duplicated).not.toBeNull();
    expect(duplicated?.id).not.toBe(saved.id);
    expect(duplicated?.name).toContain("Base");
    expect(useRecipeStore.getState().recipes).toHaveLength(2);
  });

  it("stores and applies A/B slot states as immutable snapshots", () => {
    const paramsA = createParams({ highlight: -2, wb_shift: { a_b: -4, r_b: 2 } });
    const paramsB = createParams({ highlight: 4, wb_shift: { a_b: 5, r_b: -3 } });

    useRecipeStore.getState().storeSlot({ slot: "A", params: paramsA });
    useRecipeStore.getState().storeSlot({ slot: "B", params: paramsB });

    paramsA.wb_shift.a_b = 9;

    const appliedA = useRecipeStore.getState().readSlotParams("A");
    const appliedB = useRecipeStore.getState().readSlotParams("B");

    expect(appliedA?.highlight).toBe(-2);
    expect(appliedA?.wb_shift.a_b).toBe(-4);
    expect(appliedB?.highlight).toBe(4);
    expect(appliedB?.wb_shift.a_b).toBe(5);
  });

  it("exports and imports recipe snapshots", () => {
    useRecipeStore.getState().setRecipeName("Cloud Candidate");
    const saved = useRecipeStore.getState().saveCurrentRecipe({
      profileId: defaultProfile.profile_id,
      baseImageId: "portrait_v1",
      params: createParams({ color: 2 }),
    });
    useRecipeStore.getState().storeSlot({
      slot: "A",
      params: createParams({ highlight: -1, wb_shift: { a_b: -2, r_b: 3 } }),
      recipeId: saved.id,
    });

    const snapshot = useRecipeStore.getState().exportSnapshot();
    expect(snapshot.recipes).toHaveLength(1);
    expect(snapshot.slots.A?.params.highlight).toBe(-1);

    snapshot.recipes[0].name = "Mutated Outside Store";
    snapshot.slots.A!.params.wb_shift.a_b = 9;

    expect(useRecipeStore.getState().recipes[0]?.name).toBe("Cloud Candidate");
    expect(useRecipeStore.getState().slots.A?.params.wb_shift.a_b).toBe(-2);

    const restoreSnapshot = useRecipeStore.getState().exportSnapshot();
    resetRecipeStore();
    const importedCount = useRecipeStore.getState().importSnapshot(restoreSnapshot);

    expect(importedCount).toBe(1);
    expect(useRecipeStore.getState().recipes[0]?.name).toBe("Cloud Candidate");
    expect(useRecipeStore.getState().slots.A?.params.wb_shift.a_b).toBe(-2);
  });
});
