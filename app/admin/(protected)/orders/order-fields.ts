/**
 * Readers for the one order column that is not a column: `delivery_address`.
 *
 * It is a jsonb snapshot of Stripe's shipping_details, written by the webhook
 * (app/api/stripe/webhook/route.ts) and deliberately NOT a foreign key —
 * 001_schema.sql's own comment says the customer's address may change later
 * but what we shipped to must not. Checkout inserts `{}` and the webhook
 * fills it, so an order that has not been paid for yet has no name and no
 * country, and every reader here has to survive that rather than assume the
 * shape is there.
 *
 * Shape, when present:
 *   { name: string, address: { line1, line2, city, state, postal_code, country } }
 * `country` is a two-letter ISO code, not a display name.
 */
type MaybeAddress = {
  name?: unknown;
  address?: { country?: unknown } | null;
} | null;

export function orderCountryCode(deliveryAddress: unknown): string {
  const a = deliveryAddress as MaybeAddress;
  const code = a?.address?.country;
  return typeof code === 'string' ? code : '';
}

/**
 * Checkout restricts shipping to GB and IE
 * (`allowed_countries: ['GB', 'IE']` in app/api/checkout/route.ts), so those
 * are the only two codes an order can carry. Anything else is shown as the
 * raw code rather than guessed at — a wrong country name on a fulfilment
 * screen is worse than an unfamiliar code.
 */
const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  IE: 'Ireland',
};

export function countryName(code: string): string {
  if (!code) return '—';
  return COUNTRY_NAMES[code] ?? code;
}

/** The customer's name from the shipping snapshot, falling back to the email
 * the order was placed with. An unpaid order has no snapshot yet, and an
 * admin list with a blank Customer column is less useful than one showing
 * the only identifier that always exists. */
export function customerName(deliveryAddress: unknown, email: string): string {
  const a = deliveryAddress as MaybeAddress;
  const name = a?.name;
  return typeof name === 'string' && name.trim() ? name : email;
}
