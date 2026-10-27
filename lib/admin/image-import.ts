import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SHOP_BUCKET,
  ALLOWED_TYPES,
  MAX_BYTES,
  extensionFor,
  productImagePath,
  collectionImagePath,
  homepageImagePath,
} from '@/lib/images';

/**
 * Fetch an image from a URL and put it in this shop's own bucket.
 *
 * THREE CALLERS NOW, which is why it is here rather than inlined: the stock
 * photo import (Pixabay, Pexels), the demo image seed, and whatever the next
 * one is. The HTTP call differs each time — a provider API, a file bundled
 * with the deployment — and everything after it is identical. That
 * "everything after" is the part carrying the reasoning, so a second copy of
 * it would be a second copy of the size check and the orphan handling to
 * keep in step.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: decide whether the URL is safe. The
 * caller does that, because only the caller knows what a legitimate source
 * looks like — an allow-list of provider CDN hosts for the stock import, or
 * the deployment's own origin for the demo seed. A generic "is this URL ok"
 * here would be a guess that is wrong for both.
 *
 * THE UPLOAD USES THE CALLER'S OWN SUPABASE CLIENT, never the service role.
 * Migration 019's storage policies are gated on `is_staff()`, so passing a
 * session-scoped client means the database gets to refuse as well as the
 * route. Hand it a service client and you have removed a lock without
 * noticing.
 */

export type ImportResult =
  | { ok: true; path: string; contentType: string; bytes: number }
  | { ok: false; status: number; error: string };

export async function fetchImageToBucket({
  supabase,
  url,
  pathFor,
  sourceLabel,
}: {
  supabase: SupabaseClient;
  url: string;
  /** Built by the CALLER once the real content type is known, from
   *  productImagePath/collectionImagePath/homepageImagePath. A callback
   *  rather than a string because the extension comes from the response
   *  and the path cannot be built before the fetch. Never from anything a
   *  browser sent — a client-supplied path is a client-supplied place to
   *  write. */
  pathFor: (ext: string) => string;
  /** Named in the error messages, so "Pexels returned a text/html file"
   *  reads correctly whoever called. */
  sourceLabel: string;
}): Promise<ImportResult> {
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) {
    return { ok: false, status: 502, error: `Could not download the image from ${sourceLabel}.` };
  }

  const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim();
  const ext = extensionFor(contentType);
  if (!ext || !ALLOWED_TYPES.includes(contentType)) {
    return {
      ok: false,
      status: 415,
      error: `${sourceLabel} returned a ${contentType || 'unknown'} file, which this shop does not store.`,
    };
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  // Checked against the REAL length rather than the Content-Length header,
  // which is a claim. Storage enforces it a third time (019).
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `That image is empty or over the 10 MB limit (${Math.round(bytes.byteLength / 1024)} KB).`,
    };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(SHOP_BUCKET)
    .createSignedUploadUrl(pathFor(ext));
  if (signError || !signed) {
    return { ok: false, status: 500, error: 'Could not start the upload.' };
  }

  const { error: uploadError } = await supabase.storage
    .from(SHOP_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, bytes, { contentType });
  if (uploadError) {
    return { ok: false, status: 500, error: `The image did not upload: ${uploadError.message}` };
  }

  return { ok: true, path: signed.path, contentType, bytes: bytes.byteLength };
}

/**
 * Attach a stored path to a product, at the END of the running order.
 *
 * New images go last, the same rule POST /api/admin/images follows: an
 * import quietly becoming the card the whole shop listing shows is not what
 * "add a photo" means. 019's unique index on (product_id, position) is what
 * makes the position mean anything.
 */
export async function attachProductImage({
  supabase,
  productId,
  storagePath,
  altText,
  colour,
}: {
  supabase: SupabaseClient;
  productId: string;
  storagePath: string;
  altText: string;
  colour?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const { data: last, error: lastError } = await supabase
    .from('product_images')
    .select('position')
    .eq('product_id', productId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastError) {
    return {
      ok: false,
      status: 500,
      error: 'The image uploaded but the running order could not be read, so it was not attached.',
    };
  }

  const { data: row, error: insertError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: storagePath,
      alt_text: altText,
      colour: colour?.trim() || null,
      position: ((last?.position as number) ?? -1) + 1,
    })
    .select('id')
    .single();

  if (insertError) {
    // Said plainly rather than swallowed: the file is in the bucket and
    // nothing points at it. Same honesty as the browser upload path.
    return {
      ok: false,
      status: 500,
      error: 'The image uploaded but was not attached. It is an orphan in storage.',
    };
  }

  return { ok: true, id: row.id as string };
}

/** Re-exported so callers build paths from one place rather than
 *  assembling `products/<id>/<uuid>.<ext>` by hand. */
export const imagePaths = {
  product: (productId: string) => (ext: string) =>
    productImagePath(productId, randomUUID(), ext),
  collection: (collectionId: string) => (ext: string) =>
    collectionImagePath(collectionId, randomUUID(), ext),
  homepage: () => (ext: string) => homepageImagePath(randomUUID(), ext),
};
