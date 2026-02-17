import {
  getApprovedLuts,
  getBlockedLuts,
  resolveApprovedLutForFamily,
  validateLutManifest,
  type LutManifestEntry,
} from "@fuji/domain";
import lutManifestJson from "../../../../luts/manifest.json";

export const lutManifest = validateLutManifest(lutManifestJson);
export const approvedLuts = getApprovedLuts(lutManifest);
export const blockedLuts = getBlockedLuts(lutManifest);

export function resolveActiveLut(profileId: string): LutManifestEntry | null {
  return resolveApprovedLutForFamily(lutManifest, profileId);
}
