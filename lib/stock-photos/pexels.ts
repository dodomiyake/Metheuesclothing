import 'server-only';
import {
  StockPhotoError,
  type StockPhoto,
  type StockProvider,
  type StockSearchResult,
} from './types';

/**
 * Pexels search — A05's second stock provider.
 *
 * WHY PEXELS AND NOT UNSPLASH, which was the other candidate and is the
 * better-known library. Unsplash's API terms §6 REQUIRE hotlinking — "you
 * must directly use or embed the related image URLs returned by the API" —
 * and call a breach of it material. That is the exact opposite of Pixabay's
 * rule, and it is incompatible with this codebase at a level no wrapper
 * fixes: `lib/images.ts` is explicit that `product_images.storage_path`
 * holds a path inside our bucket and never a URL, for reasons that have
 * nothing to do with stock photography. Worse, Unsplash §9 requires
 * crediting Unsplash AND the photographer with a link to their profile
 * every time an image is DISPLAYED — which on this site means a credit line
 * beside every garment on the shop listing, the product page and the
 * homepage. A product photograph with a photographer credit next to it is
 * not a product photograph. So Unsplash is not added, and this comment is
 * here so nobody has to rediscover why.
 *
 * PEXELS FITS THE SHAPE ALREADY BUILT. Its API documentation says nothing
 * requiring hotlinking, so an import downloads the file into `shop-images`
 * exactly as the Pixabay import does and exactly as a browser upload does.
 * Commercial use is permitted broadly. What it asks for is a PROMINENT LINK
 * TO PEXELS when making API requests, and that photographers be credited
 * where possible — both of which live on the search panel, the surface that
 * actually makes the requests. That reading is deliberate and worth stating:
 * the guideline attaches to the app calling the API, not to every later
 * display of the file, which is the thing that makes Unsplash unworkable
 * here and Pexels workable.
 *
 * THE BUDGET IS MONTHLY, WHICH PIXABAY'S IS NOT. 200 requests an hour and
 * 20,000 a month, against Pixabay's 100 a minute with no monthly cap. So
 * the 24-hour cache is carried over, and here it is thrift rather than an
 * obligation: two staff searching the same word in a day spend one request
 * of twenty thousand instead of two.
 *
 * `X-Ratelimit-Remaining` comes back on success and NOT on a 429, per the
 * documentation, so the 429 branch cannot report how long to wait and does
 * not pretend to.
 */

const SEARCH_ENDPOINT = 'https://api.pexels.com/v1/search';
const PHOTO_ENDPOINT = 'https://api.pexels.com/v1/photos';

/** Where Pexels serves its files. */
const ALLOWED_IMAGE_HOSTS = new Set(['images.pexels.com']);

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string | null;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    tiny: string;
  };
};

type PexelsSearchResponse = {
  total_results: number;
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
};

function apiKey(): string {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    // Raised rather than returning nothing, for the reason every catalogue
    // page now throws on a query error: a missing key and a search with no
    // matches must not look the same.
    throw new StockPhotoError(
      'Pexels search is not configured — PEXELS_API_KEY is not set on this deployment.',
      503,
    );
  }
  return key;
}

async function call<T>(url: URL): Promise<T> {
  const res = await fetch(url, {
    // Thrift rather than obligation here — see the note above.
    next: { revalidate: 86400 },
    headers: {
      // Raw key, no Bearer prefix. That is what the documentation specifies.
      Authorization: apiKey(),
      accept: 'application/json',
    },
  });

  if (res.status === 429) {
    throw new StockPhotoError(
      'Pexels is rate limiting us — 200 searches an hour, 20,000 a month. Try again shortly.',
      429,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new StockPhotoError('Pexels refused the key on this deployment.', 502);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new StockPhotoError(
      `Pexels refused the search${detail ? `: ${detail.slice(0, 200)}` : '.'}`,
      502,
    );
  }

  return (await res.json()) as T;
}

/**
 * THE FILE WE DOWNLOAD IS `large2x`, NOT `original`.
 *
 * `original` is whatever the photographer uploaded, which on Pexels is
 * routinely 25 megapixels and well past the bucket's 10 MB ceiling (019) —
 * so importing one would fail the size check after paying for the whole
 * download. `large2x` is a ~1880px JPEG, which is larger than any surface
 * on this site asks for (the biggest is the homepage hero at 720) and
 * leaves room for a retina display. `large` is the fallback for the rare
 * photograph that has no large2x.
 */
function downloadUrlFor(photo: PexelsPhoto): string {
  return photo.src.large2x || photo.src.large || photo.src.original;
}

/**
 * PEXELS' OWN `alt` IS CONTEXT, NOT A DESCRIPTION, and this is the one
 * place the two providers genuinely differ in temptation. Pixabay returns
 * comma-separated keywords, which nobody would mistake for prose. Pexels
 * returns something like "Man in White Crew Neck T-shirt" — a title-cased
 * caption that LOOKS like an alt text and would sail through the NOT NULL
 * check on `product_images.alt_text`.
 *
 * It is still not one, for two reasons. It describes the stock photograph
 * rather than the garment this shop is selling, and §13 wants a text
 * alternative for the picture as used HERE. And it is auto-generated: it
 * says nothing about the stripe, the placket, the embroidery or the cut,
 * which is everything a customer who cannot see the photograph needs.
 *
 * So it is shown beside the field as context and the field stays empty.
 * Same rule as Pixabay's tags, for a slightly harder reason.
 */
function contextFor(photo: PexelsPhoto): string[] {
  const alt = (photo.alt ?? '').trim();
  return alt ? [alt] : [];
}

function normalise(photo: PexelsPhoto): StockPhoto {
  // Pexels does not report the dimensions of each `src` variant. `medium`
  // is scaled to a height of 350, so the width follows from the real
  // aspect ratio — which is what the grid needs to reserve the right box
  // and avoid the thumbnails jumping as they load.
  const previewHeight = 350;
  const ratio = photo.height > 0 ? photo.width / photo.height : 1;

  return {
    provider: 'pexels',
    id: String(photo.id),
    previewUrl: photo.src.medium,
    previewWidth: Math.max(1, Math.round(previewHeight * ratio)),
    previewHeight,
    width: photo.width,
    height: photo.height,
    downloadUrl: downloadUrlFor(photo),
    context: contextFor(photo),
    pageUrl: photo.url,
    credit: photo.photographer,
    creditUrl: photo.photographer_url || null,
  };
}

export const pexels: StockProvider = {
  id: 'pexels',
  label: 'Pexels',
  note: 'Free for commercial use. Better for apparel than Pixabay, and the same import: the file is downloaded into this shop’s own storage.',
  homeUrl: 'https://www.pexels.com',

  async search(query, opts = {}): Promise<StockSearchResult> {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set('query', query.slice(0, 100));
    url.searchParams.set('page', String(Math.max(1, opts.page ?? 1)));
    // 80 is the documented maximum; 24 matches what the grid shows.
    url.searchParams.set('per_page', String(Math.min(80, Math.max(3, opts.perPage ?? 24))));

    const body = await call<PexelsSearchResponse>(url);
    return {
      total: body.total_results ?? 0,
      photos: (body.photos ?? []).map(normalise),
    };
  },

  /**
   * One photograph by its Pexels id.
   *
   * THE IMPORT ROUTE RESOLVES THE URL THROUGH HERE rather than accepting
   * one from the browser, the same rule the Pixabay provider states: a
   * client-supplied URL to fetch is the same mistake as a client-supplied
   * path to write, and turns an admin screen into a request-forgery tool
   * that can reach whatever the function can reach, cloud metadata
   * included. An id that must parse as a positive integer can only ever
   * name a Pexels photograph.
   */
  async byId(id): Promise<StockPhoto | null> {
    const numeric = Number(id);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;

    const url = new URL(`${PHOTO_ENDPOINT}/${numeric}`);
    try {
      const photo = await call<PexelsPhoto>(url);
      return photo?.id ? normalise(photo) : null;
    } catch (err) {
      // A deleted photograph answers 404, which `call` turns into a 502.
      // "No longer on Pexels" is the true thing to say about it.
      if (err instanceof StockPhotoError && err.status === 502) return null;
      throw err;
    }
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
