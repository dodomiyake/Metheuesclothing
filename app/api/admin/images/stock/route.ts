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
  STOCK_PROVIDER_IDS,
  StockPhotoError,
  stockProvider,
} from '@/lib/stock-photos';

export const runtime = 'nodejs';

/**
 * A05's stock photo search and import, for every provider.
 *
 * GET searches. POST imports one photograph into this shop's own bucket
 * and attaches it to a product.
 *
 * IT WAS `/api/admin/images/pixabay` AND IS NOW PROVIDER-BLIND. Pexels was
 * the second provider, and the honest choice at that point was between two
 * routes and one. Everything below the provider call is identical and it is
 * the part carrying the reasoning: resolve an id rather than trust a URL,
 * check the URL anyway, check the declared type, check the real byte
 * length, upload through the caller's own session so the storage policy
 * applies, attach at the end of the running order, and say plainly when the
 * file lands but the row does not. A second copy of that is a second copy
 * of the SSRF guard to keep in step — exactly what
 * `components/admin/status-badge.tsx` exists to stop.
 *
 * THE IMPORT IS THE OPPOSITE SHAPE FROM /sign, DELIBERATELY. The sign
 * route refuses to touch the bytes: the browser holds the file, so the
 * file goes browser -> Supabase and this app only says where. Here
 * nobody's browser has the file — it is on the provider — and fetching it
 * client-side would need CORS headers neither provider sends. So the bytes
 * come THROUGH the function this once.
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
    provider: z.enum(STOCK_PROVIDER_IDS),
    // An ID, never a URL. See the note on each provider's byId(): a
    // client-supplied URL to fetch is a server-side request forgery
    // waiting to happen.
    photo_id: z.string().trim().min(1).max(64),
    // Required and non-blank, exactly as POST /api/admin/images requires
    // it, because `product_images.alt_text` is NOT NULL with a non-empty
    // check and §13 wants a real text alternative. A provider's keywords
    // or its own caption are deliberately NOT accepted as a substitute.
    alt_text: z.string().trim().min(1).max(500),
    colour: z.string().trim().max(100).nullable().optional(),
  })
  .strict();

function providerFailure(err: unknown, label: string) {
  if (err instanceof StockPhotoError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: `Could not reach ${label}. Nothing was imported.` },
    { status: 502 },
  );
}

export async function GET(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const provider = stockProvider(req.nextUrl.searchParams.get('provider') ?? '');
  if (!provider) {
    return NextResponse.json({ error: 'Unknown stock photo provider.' }, { status: 400 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) return NextResponse.json({ error: 'Type something to search for.' }, { status: 400 });

  const pageParam = Number(req.nextUrl.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) ? Math.min(50, Math.max(1, Math.trunc(pageParam))) : 1;

  try {
    const result = await provider.search(q, { page, perPage: 24 });
    // Narrowed on the way out. The browser gets the preview URL (which
    // both providers permit for displaying results), the id it will
    // import by, and the context a human needs to write a description —
    // NOT `downloadUrl`, which has no business in a page that must never
    // hotlink, and which a page holding it is one copy-paste away from.
    return NextResponse.json({
      provider: provider.id,
      total: result.total,
      page,
      hits: result.photos.map((photo) => ({
        id: photo.id,
        preview: photo.previewUrl,
        preview_width: photo.previewWidth,
        preview_height: photo.previewHeight,
        width: photo.width,
        height: photo.height,
        context: photo.context,
        page_url: photo.pageUrl,
        credit: photo.credit,
        credit_url: photo.creditUrl,
      })),
    });
  } catch (err) {
    return providerFailure(err, provider.label);
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
  const { product_id, photo_id, alt_text } = parsed.data;

  const provider = stockProvider(parsed.data.provider);
  if (!provider) {
    return NextResponse.json({ error: 'Unknown stock photo provider.' }, { status: 400 });
  }

  // 1. Resolve the id to a URL through the provider rather than trusting
  //    one from the browser.
  let photo;
  try {
    photo = await provider.byId(photo_id);
  } catch (err) {
    return providerFailure(err, provider.label);
  }
  if (!photo) {
    return NextResponse.json(
      { error: `That photograph is no longer on ${provider.label}.` },
      { status: 404 },
    );
  }
  if (!provider.isAllowedImageUrl(photo.downloadUrl)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // 2. Download it. Pixabay's terms require storing it on our own server
  //    rather than hotlinking; Pexels does not require it and gets the
  //    same treatment, because every reader in this codebase expects a
  //    bucket path and a shop whose pictures live on someone else's CDN
  //    is a shop whose pictures can vanish.
  const imageRes = await fetch(photo.downloadUrl, { cache: 'no-store' }).catch(() => null);
  if (!imageRes || !imageRes.ok) {
    return NextResponse.json({ error: 'Could not download that photograph.' }, { status: 502 });
  }

  const contentType = (imageRes.headers.get('content-type') ?? '').split(';')[0]!.trim();
  const ext = extensionFor(contentType);
  if (!ext || !ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      {
        error: `${provider.label} returned a ${contentType || 'unknown'} file, which this shop does not store.`,
      },
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
