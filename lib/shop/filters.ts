/**
 * §8.2 filter rail (03A) / filter sheet (03D). Every filter is a plain link
 * toggling a comma-separated value in the URL's search params -- no client
 * state needed for selection itself, only for opening/closing the sheet.
 */
export type ShopSearchParams = Record<string, string | string[] | undefined>;

/**
 * Every href here is built against a base path rather than a literal
 * '/shop', because screen 19 (the collection page) reuses this entire rail
 * and sheet. It IS 03 Product Listing with the Collection facet removed, so
 * the alternative was a second copy of the filter machinery that would drift
 * from this one the first time either changed.
 */
const SHOP = '/shop';

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(',').filter(Boolean);
}

export function getSelected(params: ShopSearchParams, key: string): string[] {
  return toList(params[key]);
}

/** href for a link that toggles `value` in the comma-list at `key`. */
export function toggleHref(
  params: ShopSearchParams,
  key: string,
  value: string,
  basePath: string = SHOP,
): string {
  const selected = getSelected(params, key);
  const next = selected.includes(value)
    ? selected.filter((v) => v !== value)
    : [...selected, value];

  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === key) continue;
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw) search.set(k, raw);
  }
  if (next.length) search.set(key, next.join(','));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** href for the same params but with `key` cleared entirely. */
export function clearHref(
  params: ShopSearchParams,
  key: string,
  basePath: string = SHOP,
): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === key) continue;
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw) search.set(k, raw);
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function clearAllHref(basePath: string = SHOP): string {
  return basePath;
}

export function activeFilterCount(params: ShopSearchParams): number {
  const keys = ['size', 'colour', 'fit', 'collection', 'availability'];
  return keys.reduce((sum, k) => sum + getSelected(params, k).length, 0);
}
