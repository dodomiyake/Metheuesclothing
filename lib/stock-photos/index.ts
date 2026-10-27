import 'server-only';
import { pexels } from './pexels';
import { pixabay } from './pixabay';
import { type StockProvider, type StockProviderId } from './types';

export { StockPhotoError } from './types';
export type { StockPhoto, StockProvider, StockProviderId, StockSearchResult } from './types';

/**
 * The providers A05 can search, in the order the panel offers them.
 *
 * PEXELS IS FIRST because its library is the better one for apparel, which
 * is what this shop photographs. Pixabay stays because it is already proven
 * against the live API and because the two libraries genuinely differ — the
 * Pixabay search that went looking for this catalogue found a long-sleeve
 * crew blank nothing else had.
 *
 * UNSPLASH IS DELIBERATELY ABSENT. `pexels.ts` has the full reasoning; the
 * short version is that its API terms require hotlinking and a photographer
 * credit on every display, and this shop stores paths in its own bucket and
 * shows no credits on the storefront. Adding it would mean breaking its
 * terms or changing what a product page is.
 *
 * ADDING A THIRD is a file implementing `StockProvider` and one line here.
 * The route, the import, the SSRF guard, the size checks, the signed upload
 * and the don't-prefill-the-description rule are all already provider-blind.
 */
export const STOCK_PROVIDERS: StockProvider[] = [pexels, pixabay];

export function stockProvider(id: string): StockProvider | null {
  return STOCK_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** What the client is allowed to ask for — the id set, as a plain array the
 *  route's schema can validate against. */
export const STOCK_PROVIDER_IDS = STOCK_PROVIDERS.map((p) => p.id) as [
  StockProviderId,
  ...StockProviderId[],
];

/** The provider facts the admin panel renders: label, note and the link
 *  each provider's guidelines ask for. Safe to send to a browser — there is
 *  no key in it, which is why the panel can be a client component. */
export const STOCK_PROVIDER_INFO = STOCK_PROVIDERS.map(({ id, label, note, homeUrl }) => ({
  id,
  label,
  note,
  homeUrl,
}));
