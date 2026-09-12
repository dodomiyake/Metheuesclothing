import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaffSession } from '@/lib/admin/require-staff';

export const runtime = 'nodejs';

const GenerateVariantsRequest = z
  .object({
    colours: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
    sizes: z.array(z.string().trim().min(1).max(10)).min(1).max(20),
    price_pence: z.number().int().min(0),
  })
  .strict();

function skuFor(slug: string, colour: string, size: string) {
  const part = (s: string) => s.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return `${part(slug)}-${part(colour)}-${part(size)}`;
}

// A06: the colour x size matrix. Existing (product_id, colour, size)
// combinations are left untouched -- upsert with ignoreDuplicates rather
// than insert, so re-running this after adding one new colour does not
// disturb every variant that already has stock and sales history against it.
// New variants default to inactive with zero stock, same as the design
// note: nothing here is purchasable until a human reviews and activates it.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireStaffSession();
  if ('error' in session) return session.error;

  const { id: productId } = await params;
  const parsed = GenerateVariantsRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { colours, sizes, price_pence } = parsed.data;

  const { data: product } = await session.supabase
    .from('products')
    .select('slug')
    .eq('id', productId)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Unknown product.' }, { status: 404 });
  }

  const rows = colours.flatMap((colour) =>
    sizes.map((size) => ({
      product_id: productId,
      colour,
      size,
      sku: skuFor(product.slug, colour, size),
      price_pence,
      stock_quantity: 0,
      is_active: false,
    })),
  );

  const { error } = await session.supabase
    .from('product_variants')
    .upsert(rows, { onConflict: 'product_id,colour,size', ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ error: 'Could not generate variants.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
