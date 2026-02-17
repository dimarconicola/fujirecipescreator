import { z } from "zod";
import { recipeParamsSchema } from "./recipe.js";

export const SHARE_PAYLOAD_VERSION = 1 as const;

export const sharePayloadSchema = z
  .object({
    v: z.literal(SHARE_PAYLOAD_VERSION),
    profile_id: z.string().min(1),
    base_image_id: z.string().min(1),
    params: recipeParamsSchema,
  })
  .strict();

export type SharePayload = z.infer<typeof sharePayloadSchema>;

function encodeBase64Url(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }

  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function validateSharePayload(input: unknown): SharePayload {
  return sharePayloadSchema.parse(input);
}

export function safeValidateSharePayload(
  input: unknown,
): z.SafeParseReturnType<unknown, SharePayload> {
  return sharePayloadSchema.safeParse(input);
}

export function encodeSharePayload(payload: SharePayload): string {
  const normalized = validateSharePayload(payload);
  return encodeBase64Url(JSON.stringify(normalized));
}

export function decodeSharePayload(encodedPayload: string): SharePayload {
  const decodedJson = decodeBase64Url(encodedPayload);
  const parsed = JSON.parse(decodedJson) as unknown;
  return validateSharePayload(parsed);
}
