# Cloud Sync (GitHub Gist)

Date: 2026-02-18

## Scope

This implementation provides account-backed cloud recipe sync for the web app using a user-owned GitHub Gist.

## How It Works

1. Recipes, active recipe pointer, recipe name, and A/B slot snapshots are exported from the local recipe store.
2. Payload is written to a JSON file inside the configured gist via GitHub API `PATCH /gists/{gist_id}`.
3. Pull reads gist JSON content and imports the snapshot back into local state.
4. If an active recipe exists after pull, the toolbar reapplies it to viewer params and base image.

## UI Entry Point

- Location: `/Users/nicoladimarco/code/fujirecipescreator/apps/web/src/components/RecipeToolbar.tsx`
- Section: `Cloud Sync (GitHub Gist)`
- Inputs:
  - Gist ID or Gist URL (normalized to gist ID)
  - File name (default `fuji-recipes-sync-v1.json`)
  - GitHub token (password field)
- Actions:
  - `Push Cloud`
  - `Pull Cloud`
  - Both actions stay disabled until token and gist input are provided.

## Security Notes

1. Token is held in component state only and is not persisted to local storage.
2. Use a fine-grained token scoped only to required gist permissions.
3. Rotate token if exposed.
4. Filename input rejects path separators (`/`, `\`) to avoid accidental path-like values.
5. Pulling truncated gist files only follows trusted GitHub raw hosts over HTTPS before sending authorization headers.

## Data Format

Versioned envelope:

```json
{
  "version": 1,
  "exported_at": "2026-02-17T00:00:00.000Z",
  "data": {
    "recipes": [],
    "activeRecipeId": null,
    "recipeName": "Untitled Recipe",
    "slots": { "A": null, "B": null }
  }
}
```

Legacy fallback behavior:
- Pull can also ingest a raw snapshot object without envelope when present.

Validation behavior:
- Empty token is rejected.
- Gist input can be ID or URL, but must normalize to a hex gist identifier.
- Empty gist input is rejected.
- Filename defaults to `fuji-recipes-sync-v1.json` when blank.

## Validation and Tests

- `/Users/nicoladimarco/code/fujirecipescreator/apps/web/src/cloudSync.test.ts`
- `/Users/nicoladimarco/code/fujirecipescreator/apps/web/src/state/recipeStore.test.ts`
