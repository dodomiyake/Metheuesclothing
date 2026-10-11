import { z } from 'zod';

/**
 * A22 Store settings. `.strict()`, so a client sending a field this does
 * not name gets a 400 — which matters more here than anywhere else in the
 * admin, because these columns price a basket.
 *
 * Money arrives as integer pence, not as the pounds the form displays. The
 * conversion happens in the form, once, next to the input that caused it —
 * sending "4.95" and parsing it server-side is how a float gets into a
 * money column (rule 1).
 */
export const UpdateSettingsRequest = z
  .object({
    free_delivery_threshold_pence: z.number().int().min(0).max(1_000_000),
    delivery_tracked_48_pence: z.number().int().min(0).max(100_000),
    delivery_next_day_pence: z.number().int().min(0).max(100_000),
    // UK distance selling gives 14 days as the statutory minimum. The
    // schema's own check is `> 0`; this refuses to let the admin set a
    // window shorter than the law allows, which the database cannot know.
    return_window_days: z.number().int().min(14).max(365),
    vat_rate_basis_points: z.number().int().min(0).max(10000),
    contact_email: z.string().trim().email().max(200),
    maintenance_mode: z.boolean(),
  })
  .strict();

export type UpdateSettings = z.infer<typeof UpdateSettingsRequest>;
