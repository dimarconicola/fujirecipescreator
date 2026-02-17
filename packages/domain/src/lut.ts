import { z } from "zod";

const permissionSchema = z.enum(["yes", "no", "unclear"]);
const approvalStatusSchema = z.enum(["approved", "blocked", "pending"]);

export const lutManifestEntrySchema = z
  .object({
    lut_id: z.string().min(1),
    family: z.string().min(1),
    source: z.string().min(1),
    source_url: z.string().url(),
    direct_download_url: z.string().url().optional(),
    local_path: z.string().min(1).optional(),
    license_name: z.string().min(1),
    license_url: z.string(),
    redistribution_allowed: permissionSchema,
    modification_allowed: permissionSchema,
    commercial_use_allowed: permissionSchema,
    attribution_required: permissionSchema,
    approval_status: approvalStatusSchema,
    notes: z.string().default(""),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (!entry.direct_download_url && !entry.local_path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["local_path"],
        message: "Each LUT entry must provide direct_download_url or local_path",
      });
    }
  });

export const lutManifestSchema = z
  .object({
    version: z.number().int().positive(),
    generated_at: z.string().min(1),
    luts: z.array(lutManifestEntrySchema),
  })
  .strict();

export type LutManifest = z.infer<typeof lutManifestSchema>;
export type LutManifestEntry = z.infer<typeof lutManifestEntrySchema>;

function hasApprovedLicenseSignals(entry: LutManifestEntry): boolean {
  return (
    entry.redistribution_allowed === "yes" &&
    entry.modification_allowed === "yes" &&
    entry.commercial_use_allowed === "yes"
  );
}

export function validateLutManifest(input: unknown): LutManifest {
  return lutManifestSchema.parse(input);
}

export function isLutLegallyApproved(entry: LutManifestEntry): boolean {
  return entry.approval_status === "approved" && hasApprovedLicenseSignals(entry);
}

export function getApprovedLuts(manifest: LutManifest): LutManifestEntry[] {
  return manifest.luts.filter((entry) => isLutLegallyApproved(entry));
}

export function getBlockedLuts(manifest: LutManifest): LutManifestEntry[] {
  return manifest.luts.filter((entry) => !isLutLegallyApproved(entry));
}

export function resolveApprovedLutForFamily(
  manifest: LutManifest,
  family: string,
  fallbackFamily = "teaching",
): LutManifestEntry | null {
  const approved = getApprovedLuts(manifest);
  return (
    approved.find((entry) => entry.family === family) ??
    approved.find((entry) => entry.family === fallbackFamily) ??
    null
  );
}
