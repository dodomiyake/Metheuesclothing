/**
 * Where shop photography lives, and how a stored path becomes a URL.
 *
 * ONE PUBLIC BUCKET, separated by path prefix (migration 019). Product
 * shots, collection heroes and the homepage campaign are the same kind of
 * object — a picture the whole internet is meant to see — so they share a
 * bucket and three sets of identical policies were not written.
 *
 * `product_images.storage_path` and `collections.hero_path` hold the path
 * INSIDE the bucket, never a full URL. A stored URL would break the day
 * the project moves, and it would also let a row point anywhere at all;
 * a path can only ever name something in this bucket.
 *
 * No `server-only` here on purpose: the admin's upload form needs the
 * same path builders the server uses, and none of this touches a secret.
 */
export const SHOP_BUCKET = 'shop-images';

/** Public URL for a stored path. The bucket is public, so this is a plain
 * string built from the project URL — no round trip, no signing, which is
 * what makes a grid of forty thumbnails cheap. */
export function imageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${SHOP_BUCKET}/${storagePath}`;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const ALLOWED_TYPES = Object.keys(EXTENSIONS);
export const MAX_BYTES = 10 * 1024 * 1024;

export function extensionFor(mimeType: string): string | null {
  return EXTENSIONS[mimeType] ?? null;
}

/**
 * The path a new upload gets. A uuid rather than the original filename,
 * deliberately: two photographers both sending `front.jpg` would collide,
 * and a filename is the one piece of a file that carries whatever the
 * person who made it happened to type — including, often, a real name.
 */
export function productImagePath(productId: string, uuid: string, ext: string): string {
  return `products/${productId}/${uuid}.${ext}`;
}

export function collectionImagePath(collectionId: string, uuid: string, ext: string): string {
  return `collections/${collectionId}/${uuid}.${ext}`;
}

export function homepageImagePath(uuid: string, ext: string): string {
  return `homepage/${uuid}.${ext}`;
}

/** Every path this app will ever issue. The sign route checks against it,
 * so a hand-made request cannot write outside these three prefixes. */
export function isShopImagePath(path: string): boolean {
  return /^(products\/[0-9a-f-]{36}|collections\/[0-9a-f-]{36}|homepage)\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/.test(
    path,
  );
}
