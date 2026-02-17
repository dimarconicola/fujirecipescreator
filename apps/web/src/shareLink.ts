import {
  SHARE_PAYLOAD_VERSION,
  decodeSharePayload,
  encodeSharePayload,
  type RecipeParams,
  type SharePayload,
} from "@fuji/domain";

type BuildShareLinkInput = {
  baseImageId: string;
  originUrl: string;
  params: RecipeParams;
  profileId: string;
};

export function buildShareLink(input: BuildShareLinkInput): string {
  const payload: SharePayload = {
    v: SHARE_PAYLOAD_VERSION,
    profile_id: input.profileId,
    base_image_id: input.baseImageId,
    params: input.params,
  };

  const encoded = encodeSharePayload(payload);
  const url = new URL(input.originUrl);
  url.searchParams.set("v", String(SHARE_PAYLOAD_VERSION));
  url.searchParams.set("s", encoded);
  return url.toString();
}

export function decodeSharePayloadFromSearch(search: string): SharePayload | null {
  const params = new URLSearchParams(search);
  const encoded = params.get("s");

  if (!encoded) {
    return null;
  }

  return decodeSharePayload(encoded);
}
