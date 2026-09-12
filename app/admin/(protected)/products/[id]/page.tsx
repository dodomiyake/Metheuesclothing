import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { ProductForm } from '../product-form';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: product, error } = await supabase
    .from('products')
    .select(
      'id, slug, name, status, description_short, design_story, fit, fabric_weight_gsm, composition, neck, made_in, care_instructions, packed_weight_g, hs_code, country_of_origin, seo_title, seo_description',
    )
    .eq('id', id)
    .maybeSingle();

  // A query error and an unknown id both leave `product` null -- only the
  // second is a 404 (see app/shop/[slug]/page.tsx's comment).
  if (error) throw new Error(`Could not load product: ${error.message}`);
  if (!product) notFound();

  return (
    <div style={{ padding: 'var(--mc-space-xl)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--mc-space-md)',
        }}
      >
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
          {product.name}
        </h1>
        <Link
          href={`/admin/products/${product.id}/variants`}
          style={{ fontFamily: 'var(--mc-font-body)', color: 'var(--mc-text-primary)' }}
        >
          Colours, sizes and stock →
        </Link>
      </div>
      <ProductForm
        productId={product.id}
        initial={{
          slug: product.slug,
          name: product.name,
          status: product.status,
          description_short: product.description_short ?? '',
          design_story: product.design_story ?? '',
          fit: product.fit ?? '',
          fabric_weight_gsm: product.fabric_weight_gsm ? String(product.fabric_weight_gsm) : '',
          composition: product.composition ?? '',
          neck: product.neck ?? '',
          made_in: product.made_in ?? '',
          care_instructions: product.care_instructions ?? '',
          packed_weight_g: product.packed_weight_g ? String(product.packed_weight_g) : '',
          hs_code: product.hs_code ?? '',
          country_of_origin: product.country_of_origin ?? '',
          seo_title: product.seo_title ?? '',
          seo_description: product.seo_description ?? '',
        }}
      />
    </div>
  );
}
