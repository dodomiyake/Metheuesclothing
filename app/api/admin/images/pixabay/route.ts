import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import {
  SHOP_BUCKET,
  ALLOWED_TYPES,
  MAX_BYTES,
  extensionFor,
  productImagePath,
} from '@/lib/images';
import {
  searchPhotos,
  photoById,
  isAllowedImageUrl,
  tagList,
  PixabayError,
} from '@/lib/pixabay';

export const runtime = 'nodejs';

/**
 * A05's stock photo search and import.
 *
 * GET searches. POST imports one photograph into this shop's own bucket
 * and attaches it to a product.
 *
 * THE IMPORT IS THE OPPOSITE SHAPE FROM /sign, DELIBERATELY. The sign
 * route refuses to touch the bytes: the browser holds the file, so the
 * file goes browser -> Supabase and this app only says where. Here
 * nobody's browser has the file — it is on Pixabay — and fetching it
 * client-side would need Pixabay to send CORS headers it does not send.
 * So the bytes come THROUGH the function this once.
 *
 * That does not reintroduce the limit /sign exists to avoid. Vercel's
 * 4.5 MB cap is on the REQUEST BODY a function receives; this request
 * body is a small JSON object and the image arrives through an outbound
 * fetch, which is not capped. What it does cost is function time and
 * egress, which for an admin picking one photograph at a time is the
 * right trade and for a bulk importer would not be.
 *
 * THE UPLOAD STILL GOES THROUGH A SIGNED URL CREATED WITH THE CALLER'S
 * OWN SESSION, not the service role, so migration 019's storage policy
 * (`is_staff()`) gets to refuse exactly as it does for a browser upload.
 * This route is a courier, not a privilege escalation.
 */

const Import = z
  .object({
    product_id: z.string().uuid(),
    // An ID, never a URL. See the note on photoById(): a client-supplied
    // URL to fetch is a server-side request forgery waiting to happen.
    pixabay_id: z.number().int().positive(),
    // Required and non-blank, exactly as POST /api/admin/images requires
    // it, because `product_images.alt_text` is NOT NULL with a non-empty
    // check and §13 wants a real text alternative. Pixabay's keywords are
    // deliberately NOT accepted as a substitute.
    alt_text: z.string().trim().min(1).max(500),
    colour: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

function pixabayFailure(err: unknown) {
  if (err instanceof PixabayError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: 'Could not reach Pixabay. Nothing was imported.' },
    { status: 502 },
  );
}

export async function GET(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ error: 'Type something to search for.' }, { status: 400 });

  const pageParam = Number(req.nextUrl.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) ? Math.min(50, Math.max(1, Math.trunc(pageParam))) : 1;

  try {
    const result = await searchPhotos(q, { page, perPage: 24 });
    // Narrowed on the way out. The browser gets the preview URL (which
    // the terms permit for displaying results), the id it will import
    // by, and the context a human needs to write a description — not the
    // full hit, and not the large image URL, which has no business in a
    // page that must never hotlink.
    return NextResponse.json({
      total: result.totalHits,
      page,
      hits: result.hits.map((hit) => ({
        id: hit.id,
        preview: hit.previewURL,
        preview_width: hit.previewWidth,
        preview_height: hit.previewHeight,
        width: hit.imageWidth,
        height: hit.imageHeight,
        tags: tagList(hit.tags),
        page_url: hit.pageURL,
        user: hit.user,
      })),
    });
  } catch (err) {
    return pixabayFailure(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const parsed = Import.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: first?.path.includes('alt_text')
          ? 'Describe the photograph before importing it.'
          : 'Invalid request',
      },
      { status: 400 },
    );
  }
  const { product_id, pixabay_id, alt_text } = parsed.data;

  // 1. Resolve the id to a URL through Pixabay rather than trusting one.
  let hit;
  try {
    hit = await photoById(pixabay_id);
  } catch (err) {
    return pixabayFailure(err);
  }
  if (!hit) {
    return NextResponse.json({ error: 'That photograph is no longer on Pixabay.' }, { status: 404 });
  }
  if (!isAllowedImageUrl(hit.largeImageURL)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // 2. Download it. Pixabay's terms require storing it on our own server
  //    rather than hotlinking, and every reader in this codebase expects
  //    a bucket path anyway.
  const imageRes = await fetch(hit.largeImageURL, { cache: 'no-store' }).catch(() => null);
  if (!imageRes || !imageRes.ok) {
    return NextResponse.json({ error: 'Could not download that photograph.' }, { status: 502 });
  }

  const contentType = (imageRes.headers.get('content-type') ?? '').split(';')[0]!.trim();
  const ext = extensionFor(contentType);
  if (!ext || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Pixabay returned a ${contentType || 'unknown'} file, which this shop does not store.` },
      { status: 415 },
    );
  }

  const bytes = new Uint8Array(await imageRes.arrayBuffer());
  // Checked against the real length rather than the Content-Length
  // header, which is a claim. Storage enforces it a third time (019).
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: 'That photograph is over the 10 MB limit. Pick a different one.' },
      { status: 413 },
    );
  }

  // 3. Upload through a signed URL created with the caller's own session,
  //    so the storage policy applies. The path is built here, never sent.
  const path = productImagePath(product_id, randomUUID(), ext);
  const { data: signed, error: signError } = await session.supabase.storage
    .from(SHOP_BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 });
  }

  const { error: uploadError } = await session.supabase.storage
    .from(SHOP_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, bytes, { contentType });
  if (uploadError) {
    return NextResponse.json(
      { error: `The photograph did not upload: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // 4. Attach it. New images go on the END, the same rule POST
  //    /api/admin/images follows — an import quietly becoming the card
  //    the whole shop listing shows is not what "add a photo" means.
  const { data: last, error: lastError } = await session.supabase
    .from('product_images')
    .select('position')
    .eq('product_id', product_id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) {
    return NextResponse.json(
      { error: 'The photograph uploaded but the running order could not be read, so it was not attached.' },
      { status: 500 },
    );
  }

  const { data: row, error: insertError } = await session.supabase
    .from('product_images')
    .insert({
      product_id,
      storage_path: signed.path,
      alt_text,
      colour: parsed.data.colour?.trim() || null,
      position: ((last?.position as number) ?? -1) + 1,
    })
    .select('id')
    .single();

  if (insertError) {
    // Same honesty as the browser upload path: the file is in the bucket
    // and nothing points at it. Said plainly rather than swallowed.
    return NextResponse.json(
      { error: 'The photograph uploaded but was not attached. It is an orphan in storage.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: row.id, storage_path: signed.path }, { status: 201 });
}
