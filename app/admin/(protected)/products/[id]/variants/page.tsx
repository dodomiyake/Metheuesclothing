import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { VariantManager } from './variant-manager';

export default async function ProductVariantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: product } = await supabase.from('products').select('id, name').eq('id', id).maybeSingle();
  if (!product) notFound();

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, colour, size, sku, price_pence, stock_quantity, is_active')
    .eq('product_id', id)
    .order('colour')
    .order('size');

  return (
    <div style={{ padding: 'var(--mc-space-xl)' }}>
      <p style={{ fontFamily: 'var(--mc-font-body)', marginBottom: 0 }}>
        <Link href={`/admin/products/${id}`} style={{ color: 'var(--mc-text-muted)' }}>
          ← {product.name}
        </Link>
      </p>
      <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)' }}>
        Colours, sizes and stock
      </h1>
      <VariantManager productId={id} variants={variants ?? []} />
    </div>
  );
}
