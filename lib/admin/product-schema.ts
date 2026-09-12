import { z } from 'zod';

/**
 * Shared between POST /api/admin/products and PATCH /api/admin/products/[id].
 *
 * Every optional field is `.nullable().optional()`, not just `.optional()`:
 * omitted means "leave it as it is" (PATCH only sends the fields that
 * changed), while an explicit `null` means "clear it" -- the edit form needs
 * both, or there would be no way to blank out a description or a care-
 * instructions field once it had been set.
 */
export const ProductFields = {
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  name: z.string().trim().min(1).max(200),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']),
  description_short: z.string().trim().max(2000).nullable().optional(),
  design_story: z.string().trim().max(5000).nullable().optional(),
  fit: z.string().trim().max(500).nullable().optional(),
  fabric_weight_gsm: z.number().int().positive().nullable().optional(),
  composition: z.string().trim().max(500).nullable().optional(),
  neck: z.string().trim().max(200).nullable().optional(),
  made_in: z.string().trim().max(200).nullable().optional(),
  care_instructions: z.string().trim().max(2000).nullable().optional(),
  packed_weight_g: z.number().int().positive().nullable().optional(),
  hs_code: z.string().trim().max(50).nullable().optional(),
  country_of_origin: z.string().trim().max(200).nullable().optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(500).nullable().optional(),
} as const;

export const CreateProductRequest = z.object(ProductFields).strict();
export const UpdateProductRequest = z.object(ProductFields).partial().strict();
