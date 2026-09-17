/**
 * Garment sizes sort alphabetically unless something stops them, and
 * `product_variants.size` is free text (supabase/migrations/001_schema.sql),
 * so every `.order('size')` in a query — and every Set built from one —
 * produced "L, M, S, XL, XXL". That is the order the size chips rendered in
 * on the product page and the order Size filters listed in on the shop page.
 *
 * Postgres can't fix this without an enum or a sort column the schema
 * doesn't have, so it is sorted here instead. Anything not in the canonical
 * list keeps a stable, predictable position (alphabetical, after the known
 * sizes) rather than being dropped or silently reordered — a variant saved
 * as "One Size" or "36" must still appear.
 */
const CANONICAL = [
  'xxs',
  'xs',
  's',
  'm',
  'l',
  'xl',
  'xxl',
  'xxxl',
] as const;

/** 2XL and XXL are the same size written two ways; both are in use in the
 * wild and admin lets staff type either. */
const ALIASES: Record<string, string> = {
  '2xs': 'xxs',
  '2xl': 'xxl',
  '3xl': 'xxxl',
  extrasmall: 'xs',
  small: 's',
  medium: 'm',
  large: 'l',
  extralarge: 'xl',
};

function rank(size: string): number {
  const key = size.trim().toLowerCase().replace(/[\s-]/g, '');
  const canonical = ALIASES[key] ?? key;
  const i = (CANONICAL as readonly string[]).indexOf(canonical);
  return i === -1 ? CANONICAL.length : i;
}

/** Compare two sizes smallest-first. Unknown sizes sort together at the end,
 * alphabetically among themselves. */
export function compareSizes(a: string, b: string): number {
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, 'en');
}

export function sortSizes(sizes: Iterable<string>): string[] {
  return [...sizes].sort(compareSizes);
}
