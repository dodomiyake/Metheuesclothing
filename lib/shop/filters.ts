/**
 * §8.2 filter rail (03A) / filter sheet (03D). Every filter is a plain link
 * toggling a comma-separated value in the URL's search params -- no client
 * state needed for selection itself, only for opening/closing the sheet.
 */
export type ShopSearchParams = Record<string, string | string[] | undefined>;

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(',').filter(Boolean);
}

export function getSelected(params: ShopSearchParams, key: string): string[] {
  return toList(params[key]);
}

/** href for a link that toggles `value` in the comma-list at `key`. */
export function toggleHref(params: ShopSearchParams, key: string, value: string): string {
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
  return qs ? `/shop?${qs}` : '/shop';
}

/** href for the same params but with `key` cleared entirely. */
export function clearHref(params: ShopSearchParams, key: string): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === key) continue;
    const raw = Array.isArray(v) ? v[0] : v;
    if (raw) search.set(k, raw);
  }
  const qs = search.toString();
  return qs ? `/shop?${qs}` : '/shop';
}

export function clearAllHref(): string {
  return '/shop';
}

export function activeFilterCount(params: ShopSearchParams): number {
  const keys = ['size', 'colour', 'fit', 'collection', 'availability'];
  return keys.reduce((sum, k) => sum + getSelected(params, k).length, 0);
}
