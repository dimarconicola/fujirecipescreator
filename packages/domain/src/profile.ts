import { z } from "zod";

const intSchema = z.number().int();
const intListSchema = z.array(intSchema).min(1);
const enumListSchema = z.array(z.string().min(1)).min(1);

export const wbShiftRangeSchema = z
  .object({
    a_b: z.tuple([intSchema, intSchema]),
    r_b: z.tuple([intSchema, intSchema]),
  })
  .strict();

export const supportedParamsSchema = z
  .object({
    film_sim: enumListSchema,
    dynamic_range: enumListSchema,
    highlight: intListSchema,
    shadow: intListSchema,
    color: intListSchema,
    wb: enumListSchema,
    wb_kelvin: z.tuple([intSchema, intSchema]),
    wb_shift: wbShiftRangeSchema,
    chrome: enumListSchema,
    chrome_blue: enumListSchema,
    clarity: intListSchema,
    sharpness: intListSchema,
    noise_reduction: intListSchema,
    grain: enumListSchema,
    grain_size: enumListSchema,
  })
  .strict();

export const wbShiftValueSchema = z
  .object({
    a_b: intSchema,
    r_b: intSchema,
  })
  .strict();

export const profileDefaultsSchema = z
  .object({
    film_sim: z.string().min(1),
    dynamic_range: z.string().min(1),
    highlight: intSchema,
    shadow: intSchema,
    color: intSchema,
    chrome: z.string().min(1),
    chrome_blue: z.string().min(1),
    clarity: intSchema,
    sharpness: intSchema,
    noise_reduction: intSchema,
    grain: z.string().min(1),
    grain_size: z.string().min(1),
    wb: z.string().min(1),
    wb_kelvin: intSchema,
    wb_shift: wbShiftValueSchema,
  })
  .strict();

export const strengthScalarsSchema = z
  .object({
    tone_curve: z.number().finite().positive(),
    chrome: z.number().finite().positive(),
    clarity: z.number().finite().positive(),
    nr: z.number().finite().positive(),
    grain: z.number().finite().positive(),
  })
  .strict();

function isWithinBounds(value: number, bounds: readonly [number, number]): boolean {
  return value >= bounds[0] && value <= bounds[1];
}

function isInOptions<T>(value: T, options: readonly T[]): boolean {
  return options.includes(value);
}

function validateDefaultMembership(
  profile: z.infer<typeof profileSchema>,
  ctx: z.RefinementCtx,
): void {
  const { defaults, supported_params: supported } = profile;

  if (!isInOptions(defaults.film_sim, supported.film_sim)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "film_sim"],
      message: "defaults.film_sim must be supported by supported_params.film_sim",
    });
  }

  if (!isInOptions(defaults.dynamic_range, supported.dynamic_range)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "dynamic_range"],
      message:
        "defaults.dynamic_range must be supported by supported_params.dynamic_range",
    });
  }

  if (!isInOptions(defaults.highlight, supported.highlight)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "highlight"],
      message: "defaults.highlight must be supported by supported_params.highlight",
    });
  }

  if (!isInOptions(defaults.shadow, supported.shadow)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "shadow"],
      message: "defaults.shadow must be supported by supported_params.shadow",
    });
  }

  if (!isInOptions(defaults.color, supported.color)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "color"],
      message: "defaults.color must be supported by supported_params.color",
    });
  }

  if (!isInOptions(defaults.chrome, supported.chrome)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "chrome"],
      message: "defaults.chrome must be supported by supported_params.chrome",
    });
  }

  if (!isInOptions(defaults.chrome_blue, supported.chrome_blue)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "chrome_blue"],
      message: "defaults.chrome_blue must be supported by supported_params.chrome_blue",
    });
  }

  if (!isInOptions(defaults.clarity, supported.clarity)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "clarity"],
      message: "defaults.clarity must be supported by supported_params.clarity",
    });
  }

  if (!isInOptions(defaults.sharpness, supported.sharpness)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "sharpness"],
      message: "defaults.sharpness must be supported by supported_params.sharpness",
    });
  }

  if (!isInOptions(defaults.noise_reduction, supported.noise_reduction)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "noise_reduction"],
      message:
        "defaults.noise_reduction must be supported by supported_params.noise_reduction",
    });
  }

  if (!isInOptions(defaults.grain, supported.grain)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "grain"],
      message: "defaults.grain must be supported by supported_params.grain",
    });
  }

  if (!isInOptions(defaults.grain_size, supported.grain_size)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "grain_size"],
      message: "defaults.grain_size must be supported by supported_params.grain_size",
    });
  }

  if (!isInOptions(defaults.wb, supported.wb)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "wb"],
      message: "defaults.wb must be supported by supported_params.wb",
    });
  }

  if (!isWithinBounds(defaults.wb_kelvin, supported.wb_kelvin)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "wb_kelvin"],
      message: "defaults.wb_kelvin must be within supported_params.wb_kelvin bounds",
    });
  }

  if (!isWithinBounds(defaults.wb_shift.a_b, supported.wb_shift.a_b)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "wb_shift", "a_b"],
      message: "defaults.wb_shift.a_b must be within supported_params.wb_shift.a_b",
    });
  }

  if (!isWithinBounds(defaults.wb_shift.r_b, supported.wb_shift.r_b)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["defaults", "wb_shift", "r_b"],
      message: "defaults.wb_shift.r_b must be within supported_params.wb_shift.r_b",
    });
  }
}

function validateBoundsOrdering(
  profile: z.infer<typeof profileSchema>,
  ctx: z.RefinementCtx,
): void {
  const { wb_kelvin, wb_shift } = profile.supported_params;

  if (wb_kelvin[0] > wb_kelvin[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supported_params", "wb_kelvin"],
      message: "supported_params.wb_kelvin must be ordered [min, max]",
    });
  }

  if (wb_shift.a_b[0] > wb_shift.a_b[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supported_params", "wb_shift", "a_b"],
      message: "supported_params.wb_shift.a_b must be ordered [min, max]",
    });
  }

  if (wb_shift.r_b[0] > wb_shift.r_b[1]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supported_params", "wb_shift", "r_b"],
      message: "supported_params.wb_shift.r_b must be ordered [min, max]",
    });
  }
}

export const profileSchema = z
  .object({
    profile_id: z.string().min(1),
    display_name: z.string().min(1),
    supported_params: supportedParamsSchema,
    defaults: profileDefaultsSchema,
    strength_scalars: strengthScalarsSchema,
  })
  .strict()
  .superRefine((profile, ctx) => {
    validateBoundsOrdering(profile, ctx);
    validateDefaultMembership(profile, ctx);
  });

export type Profile = z.infer<typeof profileSchema>;
export type SupportedParams = z.infer<typeof supportedParamsSchema>;
export type ProfileDefaults = z.infer<typeof profileDefaultsSchema>;

export function validateProfile(input: unknown): Profile {
  return profileSchema.parse(input);
}

export function safeValidateProfile(input: unknown): z.SafeParseReturnType<unknown, Profile> {
  return profileSchema.safeParse(input);
}
