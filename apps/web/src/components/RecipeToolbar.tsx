import { useMemo, useState, type CSSProperties } from "react";
import {
  formatRecipeExportAsJson,
  formatRecipeExportAsText,
  type RecipeParams,
} from "@fuji/domain";
import {
  DEFAULT_SYNC_FILENAME,
  pullSnapshotFromGithubGist,
  pushSnapshotToGithubGist,
} from "../cloudSync";
import { useRecipeStore } from "../state/recipeStore";
import { buildShareLink } from "../shareLink";

type RecipeToolbarProps = {
  profileId: string;
  baseImageId: string;
  params: RecipeParams;
  onApplyParams: (params: RecipeParams) => void;
  onSelectImage: (imageId: string) => void;
  onProfileChangeRequest?: (profileId: string) => void;
  onResetAllParams: () => void;
  onRandomizeSafe: () => void;
};

const toolbarStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "12px",
  marginTop: "16px",
  padding: "12px",
  backgroundColor: "#fcfcfc",
  display: "grid",
  gap: "10px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "8px",
};

const selectStyle: CSSProperties = {
  minWidth: "240px",
};

const cloudDetailsStyle: CSSProperties = {
  border: "1px solid #d8d8d8",
  borderRadius: "10px",
  padding: "8px 10px",
  backgroundColor: "#ffffff",
};

const cloudFieldsStyle: CSSProperties = {
  display: "grid",
  gap: "8px",
  marginTop: "8px",
};

const cloudInputStyle: CSSProperties = {
  minWidth: "260px",
};

function formatSlotTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function RecipeToolbar({
  profileId,
  baseImageId,
  params,
  onApplyParams,
  onSelectImage,
  onProfileChangeRequest,
  onResetAllParams,
  onRandomizeSafe,
}: RecipeToolbarProps) {
  const recipeName = useRecipeStore((state) => state.recipeName);
  const activeRecipeId = useRecipeStore((state) => state.activeRecipeId);
  const recipes = useRecipeStore((state) => state.recipes);
  const slots = useRecipeStore((state) => state.slots);
  const setRecipeName = useRecipeStore((state) => state.setRecipeName);
  const saveCurrentRecipe = useRecipeStore((state) => state.saveCurrentRecipe);
  const duplicateActiveRecipe = useRecipeStore((state) => state.duplicateActiveRecipe);
  const loadRecipe = useRecipeStore((state) => state.loadRecipe);
  const storeSlot = useRecipeStore((state) => state.storeSlot);
  const readSlotParams = useRecipeStore((state) => state.readSlotParams);
  const exportSnapshot = useRecipeStore((state) => state.exportSnapshot);
  const importSnapshot = useRecipeStore((state) => state.importSnapshot);

  const [statusMessage, setStatusMessage] = useState<string>("");
  const [abCompareSide, setAbCompareSide] = useState<"A" | "B">("A");
  const [cloudToken, setCloudToken] = useState("");
  const [cloudGistId, setCloudGistId] = useState("");
  const [cloudFilename, setCloudFilename] = useState(DEFAULT_SYNC_FILENAME);
  const [isCloudBusy, setIsCloudBusy] = useState(false);

  const sortedRecipes = useMemo(
    () => [...recipes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [recipes],
  );

  const saveRecipe = () => {
    const recipe = saveCurrentRecipe({
      profileId,
      baseImageId,
      params,
    });
    setStatusMessage(`Saved: ${recipe.name}`);
  };

  const copyToClipboard = async (content: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatusMessage(`Clipboard is unavailable for ${label}.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setStatusMessage(`${label} copied to clipboard.`);
    } catch {
      setStatusMessage(`Failed to copy ${label}.`);
    }
  };

  const copyRecipeText = async () => {
    const text = formatRecipeExportAsText({
      name: recipeName.trim().length > 0 ? recipeName.trim() : "Untitled Recipe",
      profile_id: profileId,
      base_image_id: baseImageId,
      params,
    });

    await copyToClipboard(text, "Recipe text");
  };

  const copyRecipeJson = async () => {
    const json = formatRecipeExportAsJson({
      name: recipeName.trim().length > 0 ? recipeName.trim() : "Untitled Recipe",
      profile_id: profileId,
      base_image_id: baseImageId,
      params,
    });

    await copyToClipboard(json, "Recipe JSON");
  };

  const copyShareLink = async () => {
    if (typeof window === "undefined") {
      setStatusMessage("Share link is unavailable outside browser context.");
      return;
    }

    const shareLink = buildShareLink({
      originUrl: window.location.href,
      profileId,
      baseImageId,
      params,
    });

    await copyToClipboard(shareLink, "Share link");
  };

  const duplicateRecipe = () => {
    const duplicated = duplicateActiveRecipe();
    if (!duplicated) {
      setStatusMessage("No active saved recipe to duplicate.");
      return;
    }

    onApplyParams(duplicated.params);
    onSelectImage(duplicated.base_image_id);
    setStatusMessage(`Duplicated: ${duplicated.name}`);
  };

  const handleSelectRecipe = (recipeId: string) => {
    const recipe = loadRecipe(recipeId);
    if (!recipe) {
      return;
    }

    onProfileChangeRequest?.(recipe.profile_id);
    onApplyParams(recipe.params);
    onSelectImage(recipe.base_image_id);
    setStatusMessage(`Loaded: ${recipe.name}`);
  };

  const storeInSlot = (slot: "A" | "B") => {
    storeSlot({
      slot,
      params,
      recipeId: activeRecipeId,
    });
    setStatusMessage(`Stored current state in slot ${slot}.`);
  };

  const applySlot = (slot: "A" | "B") => {
    const slotParams = readSlotParams(slot);
    if (!slotParams) {
      setStatusMessage(`Slot ${slot} is empty.`);
      return;
    }

    onApplyParams(slotParams);
    setAbCompareSide(slot);
    setStatusMessage(`Applied slot ${slot}.`);
  };

  const toggleAbCompare = () => {
    const hasBothSlots = Boolean(slots.A && slots.B);
    if (!hasBothSlots) {
      setStatusMessage("Store both A and B before toggling compare.");
      return;
    }

    const nextSide: "A" | "B" = abCompareSide === "A" ? "B" : "A";
    const nextParams = readSlotParams(nextSide);
    if (!nextParams) {
      return;
    }

    onApplyParams(nextParams);
    setAbCompareSide(nextSide);
    setStatusMessage(`A/B compare: showing ${nextSide}.`);
  };

  const pushCloudSnapshot = async () => {
    if (isCloudBusy) {
      return;
    }

    setIsCloudBusy(true);
    try {
      const snapshot = exportSnapshot();
      await pushSnapshotToGithubGist(
        {
          token: cloudToken,
          gistId: cloudGistId,
          filename: cloudFilename,
        },
        snapshot,
      );
      setStatusMessage(`Cloud sync push complete (${snapshot.recipes.length} recipes).`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Cloud sync push failed.",
      );
    } finally {
      setIsCloudBusy(false);
    }
  };

  const pullCloudSnapshot = async () => {
    if (isCloudBusy) {
      return;
    }

    setIsCloudBusy(true);
    try {
      const snapshot = await pullSnapshotFromGithubGist({
        token: cloudToken,
        gistId: cloudGistId,
        filename: cloudFilename,
      });
      const importedCount = importSnapshot(snapshot);
      const importedActiveRecipeId = useRecipeStore.getState().activeRecipeId;
      if (importedActiveRecipeId) {
        const recipe = loadRecipe(importedActiveRecipeId);
        if (recipe) {
          onProfileChangeRequest?.(recipe.profile_id);
          onApplyParams(recipe.params);
          onSelectImage(recipe.base_image_id);
        }
      }
      setStatusMessage(`Cloud sync pull complete (${importedCount} recipes).`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Cloud sync pull failed.",
      );
    } finally {
      setIsCloudBusy(false);
    }
  };

  return (
    <section style={toolbarStyle}>
      <div style={rowStyle}>
        <strong>Recipe</strong>
        <input
          type="text"
          value={recipeName}
          onChange={(event) => setRecipeName(event.target.value)}
          placeholder="Recipe name"
        />
        <button type="button" onClick={saveRecipe}>
          Save
        </button>
        <button type="button" onClick={duplicateRecipe} disabled={!activeRecipeId}>
          Duplicate
        </button>
        <button type="button" onClick={onResetAllParams}>
          Reset Current
        </button>
        <button
          type="button"
          onClick={() => {
            onRandomizeSafe();
            setStatusMessage("Applied safe randomization.");
          }}
        >
          Randomize Safe
        </button>
        <button type="button" onClick={() => void copyRecipeText()}>
          Copy Recipe Text
        </button>
        <button type="button" onClick={() => void copyRecipeJson()}>
          Copy Recipe JSON
        </button>
        <button type="button" onClick={() => void copyShareLink()}>
          Copy Share Link
        </button>
      </div>

      <div style={rowStyle}>
        <label htmlFor="saved-recipe-select">Saved Recipes</label>
        <select
          id="saved-recipe-select"
          style={selectStyle}
          value={activeRecipeId ?? ""}
          onChange={(event) => handleSelectRecipe(event.target.value)}
        >
          <option value="">{sortedRecipes.length === 0 ? "No saved recipes" : "Select recipe"}</option>
          {sortedRecipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name} ({recipe.base_image_id})
            </option>
          ))}
        </select>
        <span>{sortedRecipes.length} saved</span>
      </div>

      <div style={rowStyle}>
        <strong>A/B Slots</strong>
        <button type="button" onClick={() => storeInSlot("A")}>
          Store A
        </button>
        <button type="button" onClick={() => applySlot("A")} disabled={!slots.A}>
          Apply A
        </button>
        <span>{slots.A ? `A updated ${formatSlotTime(slots.A.updatedAt)}` : "A empty"}</span>
        <button type="button" onClick={() => storeInSlot("B")}>
          Store B
        </button>
        <button type="button" onClick={() => applySlot("B")} disabled={!slots.B}>
          Apply B
        </button>
        <span>{slots.B ? `B updated ${formatSlotTime(slots.B.updatedAt)}` : "B empty"}</span>
        <button
          type="button"
          onClick={toggleAbCompare}
          disabled={!(slots.A && slots.B)}
        >
          Toggle A/B
        </button>
        <span>Current: {abCompareSide}</span>
      </div>

      <details style={cloudDetailsStyle}>
        <summary>Cloud Sync (GitHub Gist)</summary>
        <div style={cloudFieldsStyle}>
          <div style={rowStyle}>
            <label htmlFor="cloud-gist-id">Gist ID</label>
            <input
              id="cloud-gist-id"
              type="text"
              style={cloudInputStyle}
              value={cloudGistId}
              onChange={(event) => setCloudGistId(event.target.value)}
              placeholder="gist id"
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="cloud-filename">File</label>
            <input
              id="cloud-filename"
              type="text"
              style={cloudInputStyle}
              value={cloudFilename}
              onChange={(event) => setCloudFilename(event.target.value)}
              placeholder={DEFAULT_SYNC_FILENAME}
            />
          </div>
          <div style={rowStyle}>
            <label htmlFor="cloud-token">Token</label>
            <input
              id="cloud-token"
              type="password"
              style={cloudInputStyle}
              value={cloudToken}
              onChange={(event) => setCloudToken(event.target.value)}
              placeholder="GitHub fine-grained token"
              autoComplete="off"
            />
          </div>
          <div style={rowStyle}>
            <button type="button" onClick={() => void pushCloudSnapshot()} disabled={isCloudBusy}>
              Push Cloud
            </button>
            <button type="button" onClick={() => void pullCloudSnapshot()} disabled={isCloudBusy}>
              Pull Cloud
            </button>
            <small>Private gist + token with gist write/read scope required.</small>
          </div>
        </div>
      </details>

      {statusMessage ? <small>{statusMessage}</small> : null}
    </section>
  );
}
