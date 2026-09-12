import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { AddToBag } from './add-to-bag';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerComponentClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select(
      'id, name, description_short, design_story, fit, fabric_weight_gsm, composition, neck, made_in, care_instructions, status',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  // A query error and a genuinely missing slug both leave `product` null --
  // only the second one is a 404. Conflating them would show "page not
  // found" for what might actually be a database or network problem.
  if (productError) throw new Error(`Could not load product: ${productError.message}`);
  if (!product) notFound();

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, colour, size, price_pence, stock_quantity, is_active')
    .eq('product_id', product.id)
    .order('colour')
    .order('size');
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const activePrices = (variants ?? []).filter((v) => v.is_active).map((v) => v.price_pence);
  const priceLabel = activePrices.length
    ? activePrices.every((p) => p === activePrices[0])
      ? formatPence(activePrices[0])
      : `From ${formatPence(Math.min(...activePrices))}`
    : 'Price unavailable';

  return (
    <main
      style={{
        padding: 'var(--mc-space-xl) var(--mc-gutter-desktop)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 'var(--mc-space-2xl)',
        fontFamily: 'var(--mc-font-body)',
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'var(--mc-sand)',
          borderRadius: 'var(--mc-radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mc-text-muted)',
        }}
      >
        No image yet
      </div>

      <div>
        <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
          {product.name}
        </h1>
        <p style={{ fontSize: 'var(--mc-type-subhead)', margin: 'var(--mc-space-2xs) 0 var(--mc-space-md)' }}>
          {priceLabel}
        </p>
        {product.description_short && (
          <p style={{ color: 'var(--mc-text-muted)', marginBottom: 'var(--mc-space-lg)' }}>
            {product.description_short}
          </p>
        )}

        <AddToBag productSlug={slug} productName={product.name} variants={variants ?? []} />

        <div style={{ marginTop: 'var(--mc-space-xl)', borderTop: '1px solid var(--mc-border-default)', paddingTop: 'var(--mc-space-lg)' }}>
          <p style={{ fontSize: 'var(--mc-type-caption)', color: 'var(--mc-text-muted)' }}>
            Delivery estimate and returns eligibility are shown at checkout.
          </p>
        </div>

        {(product.fit || product.fabric_weight_gsm || product.composition || product.neck) && (
          <Section title="Fabric and construction">
            <dl style={dlStyle}>
              {product.fit && <Row label="Fit" value={product.fit} />}
              {product.composition && <Row label="Composition" value={product.composition} />}
              {product.fabric_weight_gsm && (
                <Row label="Fabric weight" value={`${product.fabric_weight_gsm} gsm`} />
              )}
              {product.neck && <Row label="Neck" value={product.neck} />}
              {product.made_in && <Row label="Made in" value={product.made_in} />}
            </dl>
          </Section>
        )}

        {product.care_instructions && (
          <Section title="Care instructions">
            <p style={{ whiteSpace: 'pre-line' }}>{product.care_instructions}</p>
          </Section>
        )}

        {product.design_story && (
          <Section title="The design story">
            <p style={{ whiteSpace: 'pre-line' }}>{product.design_story}</p>
          </Section>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 'var(--mc-space-lg)' }}>
      <h2
        style={{
          fontSize: 'var(--mc-type-label)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ color: 'var(--mc-text-muted)' }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  );
}

const dlStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 'var(--mc-space-md)',
  rowGap: 'var(--mc-space-2xs)',
  fontSize: 'var(--mc-type-body)',
};
