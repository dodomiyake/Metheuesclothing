import 'server-only';
import {
  StockPhotoError,
  type StockPhoto,
  type StockProvider,
  type StockSearchResult,
} from './types';

/**
 * Pixabay search, the first of A05's stock providers.
 *
 * WHY THIS IS SERVER-ONLY. `PIXABAY_API_KEY` is a sensitive environment
 * variable on Vercel (production, preview and development). It is not
 * `NEXT_PUBLIC_`, and it must not become one: a key in the browser is a
 * key anyone can lift and spend the 100-requests-per-minute allowance
 * with. Rule 7's `import 'server-only'` makes importing this from a
 * client component a build error rather than a leak.
 *
 * THREE RULES PIXABAY'S OWN TERMS IMPOSE, all of which shape the code
 * below rather than sitting in a comment somewhere:
 *
 *  1. "Permanent hotlinking of images is not allowed. If you intend to
 *     use the images, please download them to your server first." So an
 *     imported photograph is DOWNLOADED and stored in our own bucket,
 *     exactly like one somebody uploaded. `product_images.storage_path`
 *     could not have held a Pixabay URL anyway — lib/images.ts is
 *     explicit that a row holds a path inside the bucket and never a URL.
 *     The preview thumbnails in the search grid are the one permitted
 *     exception: the terms allow Pixabay URLs "for temporarily
 *     displaying search results", which is all the grid does.
 *
 *  2. "Requests must be cached for 24 hours." `revalidate: 86400` on the
 *     fetch is that, served by Next's own data cache, so two staff
 *     searching the same word in the same day cost one upstream request.
 *
 *  3. 100 requests per 60 seconds, per key rather than per IP. The
 *     response carries `X-RateLimit-Remaining`; a 429 comes back with a
 *     plain-text body. Both are surfaced rather than swallowed, because
 *     "no results" and "you have been rate limited" look identical to
 *     somebody staring at an empty grid — the same failure shape as a
 *     catalogue query error rendering as an empty shop.
 *
 * MOVED HERE FROM `lib/pixabay.ts` when Pexels became the second provider,
 * which is the same move `form-styles.ts`, `dialog-styles.ts` and
 * `quantity-control.tsx` all record: a file gains a sibling and the shared
 * part goes up a level rather than being copied. `types.ts` has the
 * reasoning about what was worth sharing — the import, not the HTTP call.
 */

const ENDPOINT = 'https://pixabay.com/api/';

/** Hosts an imported image may be fetched from. The id is resolved to a
 * URL by Pixabay itself, never supplied by the caller — but the result
 * is still checked, because a redirect or a changed API is not a reason
 * to let this fetch anything on the internet. */
const ALLOWED_IMAGE_HOSTS = new Set(['pixabay.com', 'cdn.pixabay.com']);

type PixabayHit = {
  id: number;
  pageURL: string;
  tags: string;
  previewURL: string;
  previewWidth: number;
  previewHeight: number;
  largeImageURL: string;
  imageWidth: number;
  imageHeight: number;
  user: string;
};

type PixabayResponse = {
  total: number;
  totalHits: number;
  hits: PixabayHit[];
};

function apiKey(): string {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) {
    // Raised rather than returning an empty result, for the reason every
    // catalogue page now throws on a query error: a missing key and a
    // search with no matches must not look the same.
    throw new StockPhotoError(
      'Pixabay search is not configured — PIXABAY_API_KEY is not set on this deployment.',
      503,
    );
  }
  return key;
}

async function call(params: Record<string, string>): Promise<PixabayResponse> {
  const url = new URL(ENDPOINT);
  url.searchParams.set('key', apiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    // Pixabay's stated requirement, not an optimisation.
    next: { revalidate: 86400 },
    headers: { accept: 'application/json' },
  });

  if (res.status === 429) {
    throw new StockPhotoError(
      'Pixabay is rate limiting us — 100 searches a minute. Wait a moment and try again.',
      429,
    );
  }
  if (!res.ok) {
    // The body is plain text on error, per the API docs.
    const detail = await res.text().catch(() => '');
    throw new StockPhotoError(
      `Pixabay refused the search${detail ? `: ${detail.slice(0, 200)}` : '.'}`,
      502,
    );
  }

  return (await res.json()) as PixabayResponse;
}

/** Pixabay's `tags` are comma-separated keywords. They are NOT a
 * description and must never be written to `alt_text` unedited — that is
 * how this shop ended up with lorem ipsum on its only photograph. The
 * search panel shows them as context for whoever writes the real one. */
function tagList(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalise(hit: PixabayHit): StockPhoto {
  return {
    provider: 'pixabay',
    id: String(hit.id),
    previewUrl: hit.previewURL,
    previewWidth: hit.previewWidth,
    previewHeight: hit.previewHeight,
    width: hit.imageWidth,
    height: hit.imageHeight,
    downloadUrl: hit.largeImageURL,
    context: tagList(hit.tags),
    pageUrl: hit.pageURL,
    credit: hit.user,
    // Pixabay's response gives a user name and no profile URL, and its
    // licence asks for no attribution, so there is nothing to link to.
    creditUrl: null,
  };
}

export const pixabay: StockProvider = {
  id: 'pixabay',
  label: 'Pixabay',
  note: 'Free for commercial use, no attribution required. Its terms forbid permanent hotlinking, so the file is downloaded into this shop’s own storage.',
  homeUrl: 'https://pixabay.com',

  /** A page of photographs for a query. Photos only — an illustration or
   *  a vector is not what anybody means by "a picture of a T-shirt". */
  async search(query, opts = {}): Promise<StockSearchResult> {
    const body = await call({
      q: query.slice(0, 100),
      image_type: 'photo',
      safesearch: 'true',
      order: 'popular',
      page: String(Math.max(1, opts.page ?? 1)),
      per_page: String(Math.min(200, Math.max(3, opts.perPage ?? 24))),
    });
    return {
      total: body.totalHits ?? 0,
      photos: (body.hits ?? []).map(normalise),
    };
  },

  /**
   * One photograph by its Pixabay id.
   *
   * THE IMPORT ROUTE RESOLVES THE URL THROUGH THIS rather than accepting
   * one from the browser. A client-supplied URL to fetch is the same
   * mistake as a client-supplied path to write (see the sign route): it
   * turns an admin screen into a request forgery tool that can reach
   * anything the function can reach, including the cloud metadata service.
   * An integer id can only ever name a Pixabay photograph.
   */
  async byId(id): Promise<StockPhoto | null> {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;
    const body = await call({ id: String(numeric) });
    const hit = body.hits[0];
    return hit ? normalise(hit) : null;
  },

  isAllowedImageUrl(raw): boolean {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.has(url.hostname);
    } catch {
      return false;
    }
  },
};
