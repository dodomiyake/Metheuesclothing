import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { VariantManager } from './variant-manager';

export default async function ProductVariantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  // A query error and an unknown id both leave `product` null -- only the
  // second is a 404 (see app/shop/[slug]/page.tsx's comment).
  if (productError) throw new Error(`Could not load product: ${productError.message}`);
  if (!product) notFound();

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, colour, size, sku, price_pence, stock_quantity, is_active')
    .eq('product_id', id)
    .order('colour')
    .order('size');
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

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
