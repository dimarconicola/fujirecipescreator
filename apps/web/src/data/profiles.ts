import { validateProfile } from "@fuji/domain";
import xtrans3ProfileJson from "../../../../profiles/xtrans3.json";
import xtrans4ProfileJson from "../../../../profiles/xtrans4.json";
import xtrans5ProfileJson from "../../../../profiles/xtrans5.json";

const validatedProfiles = [
  validateProfile(xtrans3ProfileJson),
  validateProfile(xtrans4ProfileJson),
  validateProfile(xtrans5ProfileJson),
];

export const availableProfiles = [...validatedProfiles].sort((left, right) =>
  left.display_name.localeCompare(right.display_name),
);

export const profileById = new Map(
  availableProfiles.map((profile) => [profile.profile_id, profile]),
);

export function resolveProfile(profileId: string) {
  return profileById.get(profileId) ?? null;
}
