import 'server-only';

/**
 * The one shape A05's stock search speaks in, whichever library is behind
 * it.
 *
 * WHY THIS FILE EXISTS. Pixabay was the first provider and `lib/pixabay.ts`
 * held everything: the client, the SSRF guard and the keyword helper. Pexels
 * is the second, and the half worth sharing is not the HTTP call — it is the
 * import: resolve an id through the provider, check the URL it hands back,
 * download, check the type, check the real byte length, upload through a
 * signed URL created with the caller's own session, attach at the end of the
 * running order, and say so plainly when the file lands but the row does
 * not. That is the half with the security reasoning in it, and a second copy
 * of it is exactly what `components/admin/status-badge.tsx` exists to stop —
 * the same move `dialog-styles.ts`, `form-styles.ts` and
 * `quantity-control.tsx` all record.
 *
 * So the providers answer in one shape and the route knows nothing about
 * either library.
 *
 * NO PROVIDER IMPORTS ARE IN HERE, deliberately: the registry lives in
 * `index.ts` and imports the providers, while the providers import only
 * these types. A cycle through a class used at module-evaluation time is a
 * genuinely awkward failure to debug, and this keeps the arrows pointing one
 * way.
 */

export type StockProviderId = 'pixabay' | 'pexels';

export type StockPhoto = {
  provider: StockProviderId;
  /** A string even where both of today's providers use integers: an id is
   *  the provider's own handle and the route has no business assuming its
   *  type. It is still validated per provider before use. */
  id: string;
  /** Shown in the search grid. The only provider URL that ever reaches a
   *  browser, and only ever the admin's. */
  previewUrl: string;
  previewWidth: number;
  previewHeight: number;
  /** The real dimensions of the file that would be imported. */
  width: number;
  height: number;
  /**
   * The file the import downloads. NEVER SENT TO THE BROWSER — the route
   * narrows it out of its response, because a page that holds the full
   * image URL is one copy-paste away from being a page that hotlinks it,
   * which Pixabay's terms forbid outright.
   */
  downloadUrl: string;
  /**
   * Keywords, or the provider's own caption. CONTEXT FOR WRITING A
   * DESCRIPTION, NEVER A DESCRIPTION. See the note in the search panel: a
   * provider's keywords satisfy the NOT NULL check on
   * `product_images.alt_text` and tell a screen reader nothing, which is
   * precisely how this shop ended up with lorem ipsum live on its only
   * photograph.
   */
  context: string[];
  /** The photograph's page on the provider, for a human to check. */
  pageUrl: string;
  /** Who took it. */
  credit: string;
  /** Their profile, where the provider gives one. Pexels' API guidelines
   *  ask that photographers be credited where possible; Pixabay's licence
   *  does not require it and gives a user page rather than a profile URL. */
  creditUrl: string | null;
};

export type StockSearchResult = {
  total: number;
  photos: StockPhoto[];
};

export type StockProvider = {
  id: StockProviderId;
  /** What the admin sees on the provider control. */
  label: string;
  /** One line under it: the licence position, in plain words. */
  note: string;
  /** Where the provider wants to be linked from. Pexels' API guidelines
   *  require a prominent link; Pixabay's do not, and it gets one anyway
   *  because somebody choosing a photograph should be able to reach the
   *  terms they are choosing under. */
  homeUrl: string;
  search(query: string, opts?: { page?: number; perPage?: number }): Promise<StockSearchResult>;
  byId(id: string): Promise<StockPhoto | null>;
  /** Belt and braces over `byId`: a redirect or a changed API is not a
   *  reason to let the import fetch anything on the internet. */
  isAllowedImageUrl(raw: string): boolean;
};

/**
 * A provider failure with the status the route should answer with.
 *
 * Carrying the status is what keeps a missing key (503), a rate limit (429)
 * and a refused search (502) distinguishable in the panel. An empty grid
 * that might mean any of the three is the catalogue-query-as-empty-shop
 * failure in a new place.
 */
export class StockPhotoError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
