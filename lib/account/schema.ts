import { z } from 'zod';

/**
 * What a customer may change about themselves.
 *
 * `.strict()` for the same reason every schema here is: a client sending a
 * field this does not name gets a 400 rather than having it quietly
 * ignored. That matters most on `profiles`, which also holds `role` — a
 * lenient schema plus a spread into .update() is exactly how a customer
 * makes themselves staff.
 */
export const UpdateProfileRequest = z
  .object({
    full_name: z.string().trim().max(200).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    marketing_opt_in: z.boolean().optional(),
  })
  .strict();

/**
 * An address. country_code is restricted to the two countries checkout can
 * actually ship to (GB and IE) rather than any ISO pair: an address nobody
 * can order to is a form that wastes someone's time and then fails at the
 * last step.
 */
export const AddressFields = {
  label: z.string().trim().max(60).nullable().optional(),
  recipient: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(100),
  postcode: z.string().trim().min(1).max(20),
  country_code: z.enum(['GB', 'IE']),
  phone: z.string().trim().max(40).nullable().optional(),
  is_default: z.boolean().optional(),
};

export const CreateAddressRequest = z.object(AddressFields).strict();

export const UpdateAddressRequest = z
  .object({
    ...AddressFields,
    recipient: AddressFields.recipient.optional(),
    line1: AddressFields.line1.optional(),
    city: AddressFields.city.optional(),
    postcode: AddressFields.postcode.optional(),
    country_code: AddressFields.country_code.optional(),
  })
  .strict();
