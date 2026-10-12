import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireStaffSession } from '@/lib/admin/require-staff';
import {
  SHOP_BUCKET,
  ALLOWED_TYPES,
  MAX_BYTES,
  extensionFor,
  productImagePath,
  collectionImagePath,
  homepageImagePath,
} from '@/lib/images';

export const runtime = 'nodejs';

/**
 * Hands the browser a one-shot upload URL.
 *
 * THE FILE NEVER PASSES THROUGH THIS APP, which is the whole design. A
 * route that accepted the bytes would push every photograph through a
 * Vercel function — a 4.5 MB body limit on the platform's own serverless
 * functions, the upload counted against the function's execution time,
 * and the bandwidth paid for twice. A signed URL means the browser talks
 * to Supabase directly and this route only decides whether it may, and
 * where it may write.
 *
 * The PATH is chosen here, never sent by the client. A client-supplied
 * path is a client-supplied place to write; the uuid and the extension
 * are derived from the declared type, and storage enforces the size and
 * mime limits again at its end (migration 019) because a declared
 * content type is a claim, not a fact.
 */
export async function POST(req: NextRequest) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const body = (await req.json().catch(() => null)) as {
    scope?: unknown;
    owner_id?: unknown;
    content_type?: unknown;
    size?: unknown;
  } | null;

  const scope = body?.scope;
  const contentType = typeof body?.content_type === 'string' ? body.content_type : '';
  const size = typeof body?.size === 'number' ? body.size : 0;

  const ext = extensionFor(contentType);
  if (!ext) {
    return NextResponse.json(
      { error: `That file type is not supported. Use ${ALLOWED_TYPES.map((t) => t.replace('image/', '')).join(', ')}.` },
      { status: 400 },
    );
  }
  if (size <= 0 || size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Images must be under 10 MB. Export it smaller rather than uploading a print file.' },
      { status: 400 },
    );
  }

  const ownerId = typeof body?.owner_id === 'string' ? body.owner_id : '';
  const isUuid = /^[0-9a-f-]{36}$/.test(ownerId);

  let path: string;
  if (scope === 'product') {
    if (!isUuid) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    path = productImagePath(ownerId, randomUUID(), ext);
  } else if (scope === 'collection') {
    if (!isUuid) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    path = collectionImagePath(ownerId, randomUUID(), ext);
  } else if (scope === 'homepage') {
    path = homepageImagePath(randomUUID(), ext);
  } else {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Signed with the caller's own session, not the service role: the
  // storage policy is `bucket_id = 'shop-images' and is_staff()`, so the
  // database gets to refuse as well. requireStaffSession() above is what
  // turns that refusal into a 403 somebody can read.
  const { data, error } = await session.supabase.storage
    .from(SHOP_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 });
  }

  return NextResponse.json({ path: data.path, token: data.token });
}
