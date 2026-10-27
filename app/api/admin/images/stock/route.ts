import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';
import { fetchImageToBucket, attachProductImage, imagePaths } from '@/lib/admin/image-import';
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

  // 2. Download it and put it in our own bucket. Pixabay's terms require
  //    storing it on our own server rather than hotlinking; Pexels does not
  //    require it and gets the same treatment, because every reader in this
  //    codebase expects a bucket path and a shop whose pictures live on
  //    someone else's CDN is a shop whose pictures can vanish.
  //
  //    The download, the type check, the real-byte-length check and the
  //    signed upload all live in lib/admin/image-import.ts now, because the
  //    demo image seed needs the identical sequence and a second copy of it
  //    would be a second copy of the size check to keep in step.
  const stored = await fetchImageToBucket({
    supabase: session.supabase,
    url: photo.downloadUrl,
    pathFor: imagePaths.product(product_id),
    sourceLabel: provider.label,
  });
  if (!stored.ok) {
    return NextResponse.json({ error: stored.error }, { status: stored.status });
  }

  // 3. Attach it, at the end of the running order.
  const attached = await attachProductImage({
    supabase: session.supabase,
    productId: product_id,
    storagePath: stored.path,
    altText: alt_text,
    colour: parsed.data.colour,
  });
  if (!attached.ok) {
    return NextResponse.json({ error: attached.error }, { status: attached.status });
  }

  return NextResponse.json({ id: attached.id, storage_path: stored.path }, { status: 201 });
}
