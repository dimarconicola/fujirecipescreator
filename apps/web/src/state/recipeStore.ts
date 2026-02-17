import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  recipeParamsSchema,
  validateRecipe,
  type Recipe,
  type RecipeParams,
} from "@fuji/domain";

export type AbSlotKey = "A" | "B";

export type AbSlotSnapshot = {
  params: RecipeParams;
  recipeId: string | null;
  updatedAt: string;
};

export type RecipeStoreSnapshot = {
  recipes: Recipe[];
  activeRecipeId: string | null;
  recipeName: string;
  slots: Record<AbSlotKey, AbSlotSnapshot | null>;
};

type SaveRecipeInput = {
  profileId: string;
  baseImageId: string;
  params: RecipeParams;
};

type StoreSlotInput = {
  slot: AbSlotKey;
  params: RecipeParams;
  recipeId?: string | null;
};

type RecipeStoreState = {
  recipes: Recipe[];
  activeRecipeId: string | null;
  recipeName: string;
  slots: Record<AbSlotKey, AbSlotSnapshot | null>;
  setRecipeName: (name: string) => void;
  saveCurrentRecipe: (input: SaveRecipeInput) => Recipe;
  duplicateActiveRecipe: () => Recipe | null;
  loadRecipe: (recipeId: string) => Recipe | null;
  storeSlot: (input: StoreSlotInput) => void;
  readSlotParams: (slot: AbSlotKey) => RecipeParams | null;
  exportSnapshot: () => RecipeStoreSnapshot;
  importSnapshot: (snapshot: unknown) => number;
};

const DEFAULT_RECIPE_NAME = "Untitled Recipe";
const noopStorage = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
};

function nowIsoString(): string {
  return new Date().toISOString();
}

function createRecipeId(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is required to save recipes");
  }
  return crypto.randomUUID();
}

function normalizeRecipeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_RECIPE_NAME;
}

function cloneParams(params: RecipeParams): RecipeParams {
  return {
    ...params,
    wb_shift: {
      ...params.wb_shift,
    },
  };
}

function cloneRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    params: cloneParams(recipe.params),
    tags: [...recipe.tags],
  };
}

function cloneSlotSnapshot(snapshot: AbSlotSnapshot): AbSlotSnapshot {
  return {
    params: cloneParams(snapshot.params),
    recipeId: snapshot.recipeId,
    updatedAt: snapshot.updatedAt,
  };
}

function normalizeSlotSnapshot(input: unknown): AbSlotSnapshot | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as {
    params?: unknown;
    recipeId?: unknown;
    updatedAt?: unknown;
  };
  const parsedParams = recipeParamsSchema.safeParse(candidate.params);
  if (!parsedParams.success) {
    return null;
  }

  return {
    params: cloneParams(parsedParams.data),
    recipeId: typeof candidate.recipeId === "string" ? candidate.recipeId : null,
    updatedAt:
      typeof candidate.updatedAt === "string" && candidate.updatedAt.trim().length > 0
        ? candidate.updatedAt
        : nowIsoString(),
  };
}

function normalizeSnapshot(input: unknown): RecipeStoreSnapshot {
  const candidate = (input && typeof input === "object" ? input : {}) as {
    recipes?: unknown;
    activeRecipeId?: unknown;
    recipeName?: unknown;
    slots?: unknown;
  };

  const recipes = Array.isArray(candidate.recipes)
    ? candidate.recipes.flatMap((entry) => {
        try {
          return [validateRecipe(entry)];
        } catch {
          return [];
        }
      })
    : [];

  const activeRecipeId =
    typeof candidate.activeRecipeId === "string" &&
    recipes.some((recipe) => recipe.id === candidate.activeRecipeId)
      ? candidate.activeRecipeId
      : null;

  const slotsInput =
    candidate.slots && typeof candidate.slots === "object"
      ? (candidate.slots as Record<string, unknown>)
      : {};
  const slots: Record<AbSlotKey, AbSlotSnapshot | null> = {
    A: normalizeSlotSnapshot(slotsInput.A),
    B: normalizeSlotSnapshot(slotsInput.B),
  };

  const fallbackName = activeRecipeId
    ? recipes.find((recipe) => recipe.id === activeRecipeId)?.name
    : undefined;
  const recipeName = normalizeRecipeName(
    typeof candidate.recipeName === "string" ? candidate.recipeName : fallbackName ?? "",
  );

  return {
    recipes: recipes.map((recipe) => cloneRecipe(recipe)),
    activeRecipeId,
    recipeName,
    slots,
  };
}

function createRecipeRecord(input: {
  id: string;
  name: string;
  profileId: string;
  baseImageId: string;
  params: RecipeParams;
}): Recipe {
  const timestamp = nowIsoString();

  return validateRecipe({
    id: input.id,
    name: normalizeRecipeName(input.name),
    profile_id: input.profileId,
    base_image_id: input.baseImageId,
    params: cloneParams(input.params),
    created_at: timestamp,
    updated_at: timestamp,
    tags: [],
  });
}

function buildDuplicateName(name: string): string {
  return name.endsWith(" Copy") ? `${name} 2` : `${name} Copy`;
}

export const useRecipeStore = create<RecipeStoreState>()(
  persist(
    (set, get) => ({
      recipes: [],
      activeRecipeId: null,
      recipeName: DEFAULT_RECIPE_NAME,
      slots: {
        A: null,
        B: null,
      },
      setRecipeName: (name) => {
        set({ recipeName: name });
      },
      saveCurrentRecipe: (input) => {
        const state = get();
        const name = normalizeRecipeName(state.recipeName);
        const now = nowIsoString();
        const existing = state.activeRecipeId
          ? state.recipes.find((recipe) => recipe.id === state.activeRecipeId)
          : null;

        if (existing) {
          const updated = validateRecipe({
            ...existing,
            name,
            profile_id: input.profileId,
            base_image_id: input.baseImageId,
            params: cloneParams(input.params),
            updated_at: now,
          });

          set((current) => ({
            recipes: current.recipes.map((recipe) =>
              recipe.id === updated.id ? updated : recipe,
            ),
            activeRecipeId: updated.id,
            recipeName: updated.name,
          }));

          return cloneRecipe(updated);
        }

        const created = createRecipeRecord({
          id: createRecipeId(),
          name,
          profileId: input.profileId,
          baseImageId: input.baseImageId,
          params: input.params,
        });

        set((current) => ({
          recipes: [created, ...current.recipes],
          activeRecipeId: created.id,
          recipeName: created.name,
        }));

        return cloneRecipe(created);
      },
      duplicateActiveRecipe: () => {
        const state = get();
        const activeRecipe = state.activeRecipeId
          ? state.recipes.find((recipe) => recipe.id === state.activeRecipeId)
          : null;

        if (!activeRecipe) {
          return null;
        }

        const duplicated = createRecipeRecord({
          id: createRecipeId(),
          name: buildDuplicateName(activeRecipe.name),
          profileId: activeRecipe.profile_id,
          baseImageId: activeRecipe.base_image_id,
          params: activeRecipe.params,
        });

        set((current) => ({
          recipes: [duplicated, ...current.recipes],
          activeRecipeId: duplicated.id,
          recipeName: duplicated.name,
        }));

        return cloneRecipe(duplicated);
      },
      loadRecipe: (recipeId) => {
        const recipe = get().recipes.find((candidate) => candidate.id === recipeId);

        if (!recipe) {
          return null;
        }

        set({
          activeRecipeId: recipe.id,
          recipeName: recipe.name,
        });

        return cloneRecipe(recipe);
      },
      storeSlot: ({ slot, params, recipeId }) => {
        set((state) => ({
          slots: {
            ...state.slots,
            [slot]: {
              params: cloneParams(params),
              recipeId: recipeId ?? state.activeRecipeId,
              updatedAt: nowIsoString(),
            },
          },
        }));
      },
      readSlotParams: (slot) => {
        const slotValue = get().slots[slot];

        if (!slotValue) {
          return null;
        }

        return cloneParams(slotValue.params);
      },
      exportSnapshot: () => {
        const state = get();
        return {
          recipes: state.recipes.map((recipe) => cloneRecipe(recipe)),
          activeRecipeId: state.activeRecipeId,
          recipeName: state.recipeName,
          slots: {
            A: state.slots.A ? cloneSlotSnapshot(state.slots.A) : null,
            B: state.slots.B ? cloneSlotSnapshot(state.slots.B) : null,
          },
        };
      },
      importSnapshot: (snapshot) => {
        const normalized = normalizeSnapshot(snapshot);

        set({
          recipes: normalized.recipes,
          activeRecipeId: normalized.activeRecipeId,
          recipeName: normalized.recipeName,
          slots: normalized.slots,
        });

        return normalized.recipes.length;
      },
    }),
    {
      name: "fuji-recipes-v1",
      storage: createJSONStorage(() =>
        typeof localStorage === "undefined" ? noopStorage : localStorage,
      ),
      partialize: (state) => ({
        recipes: state.recipes,
        activeRecipeId: state.activeRecipeId,
        recipeName: state.recipeName,
        slots: state.slots,
      }),
    },
  ),
);
