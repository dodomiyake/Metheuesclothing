import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { formatPence } from '@/lib/money';
import { summarizeProduct } from '@/lib/shop/product-summary';
import { ProductCard, type ProductCardData } from '../product-card';
import { AddToBag } from './add-to-bag';

type VariantRow = {
  id: string;
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

type RelatedRow = {
  id: string;
  slug: string;
  name: string;
  fit: string | null;
  published_at: string | null;
};

type CollectionLinkRow = { product_id: string; collections: { slug: string; name: string } | null };

const THUMB_LABELS = ['Front', 'Back', 'Print', 'Fabric', 'Model'];

/**
 * §8.3 product detail (04A/B/C — Figma node 60:878/58:783/54:703), rebuilt
 * against the real screens rather than the earlier token-styled MVP. Every
 * spec row is backed by a real column or omitted: Print method/placement
 * have no backing column anywhere in the schema (omitted, same treatment as
 * shop's "Design style" filter); Care is one combined care_instructions
 * column, not the design's four separate Wash/Dry/Tumble/Iron rows; the
 * design's Estimate/Carrier delivery rows are unverified data blocked on
 * the owner (see README/CLAUDE.md), so delivery and returns render only
 * store_settings.free_delivery_threshold_pence and .return_window_days.
 * No product photography exists yet, so the gallery keeps the same
 * placeholder-well treatment as the product card.
 */
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createServerComponentClient();

  const { data: product, error: productError } = await supabase
    .from('products')
    .select(
      'id, name, description_short, design_story, fit, fabric_weight_gsm, composition, neck, made_in, care_instructions, status, published_at',
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
    .select('id, colour, size, price_pence, stock_quantity, low_stock_threshold, is_active')
    .eq('product_id', product.id)
    .order('colour')
    .order('size');
  if (variantsError) throw new Error(`Could not load variants: ${variantsError.message}`);

  const { data: settings, error: settingsError } = await supabase
    .from('store_settings')
    .select('free_delivery_threshold_pence, return_window_days')
    .single();
  if (settingsError) throw new Error(`Could not load store settings: ${settingsError.message}`);

  const { data: relatedRows, error: relatedError } = await supabase
    .from('products')
    .select('id, slug, name, fit, published_at')
    .eq('status', 'published')
    .neq('id', product.id)
    .order('published_at', { ascending: false })
    .limit(4);
  if (relatedError) throw new Error(`Could not load related products: ${relatedError.message}`);

  const involvedIds = [product.id, ...(relatedRows ?? []).map((r: RelatedRow) => r.id)];

  const { data: relatedVariants, error: relatedVariantsError } = involvedIds.length
    ? await supabase
        .from('product_variants')
        .select('product_id, colour, size, price_pence, stock_quantity, low_stock_threshold, is_active')
        .in('product_id', involvedIds)
        .eq('is_active', true)
    : { data: [] as (VariantRow & { product_id: string })[], error: null };
  if (relatedVariantsError) throw new Error(`Could not load related variants: ${relatedVariantsError.message}`);

  const { data: collectionLinksRaw, error: collectionsError } = involvedIds.length
    ? await supabase
        .from('product_collections')
        .select('product_id, collections(slug, name)')
        .in('product_id', involvedIds)
    : { data: [] as CollectionLinkRow[], error: null };
  if (collectionsError) throw new Error(`Could not load collections: ${collectionsError.message}`);
  const collectionLinks = (collectionLinksRaw ?? []) as unknown as CollectionLinkRow[];

  const collectionsByProduct = new Map<string, string[]>();
  for (const link of collectionLinks) {
    if (!link.collections) continue;
    const list = collectionsByProduct.get(link.product_id) ?? [];
    list.push(link.collections.name);
    collectionsByProduct.set(link.product_id, list);
  }

  const variantsByProduct = new Map<string, (VariantRow & { product_id: string })[]>();
  for (const v of (relatedVariants ?? []) as (VariantRow & { product_id: string })[]) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push(v);
    variantsByProduct.set(v.product_id, list);
  }

  const collectionNames = collectionsByProduct.get(product.id) ?? [];
  const eyebrow = collectionNames.length ? collectionNames.join(' · ') : null;

  const activePrices = (variants ?? []).filter((v) => v.is_active).map((v) => v.price_pence);
  const priceLabel = activePrices.length
    ? activePrices.every((p) => p === activePrices[0])
      ? formatPence(activePrices[0])
      : `From ${formatPence(Math.min(...activePrices))}`
    : 'Price unavailable';

  const related: ProductCardData[] = (relatedRows ?? []).map((r: RelatedRow) => {
    const vs = variantsByProduct.get(r.id) ?? [];
    const summary = summarizeProduct(r.published_at, vs, collectionsByProduct.get(r.id) ?? []);
    return { slug: r.slug, name: r.name, ...summary };
  });

  const fabricFields = [product.fit, product.composition, product.fabric_weight_gsm, product.neck, product.made_in].filter(
    Boolean,
  );

  return (
    <main style={{ fontFamily: 'var(--mc-font-body)' }}>
      <div className="mc-page-gutter" style={{ paddingTop: 'var(--mc-space-xl)', paddingBottom: 'var(--mc-space-md)' }}>
        <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
          Home / T-Shirts / {product.name}
        </p>
      </div>

      <div className="mc-page-gutter mc-product-grid" style={{ paddingBottom: 'var(--mc-space-2xl)' }}>
        <div className="mc-pdp-gallery">
          <div className="mc-pdp-thumbs">
            {THUMB_LABELS.map((label) => (
              <div
                key={label}
                style={{
                  aspectRatio: '4 / 5',
                  background: 'var(--mc-sand)',
                  borderRadius: 'var(--mc-radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--mc-text-muted)', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              aspectRatio: '4 / 5',
              background: 'var(--mc-sand)',
              borderRadius: 'var(--mc-radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mc-text-muted)',
            }}
          >
            No product photography yet
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {eyebrow && (
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: 0 }}>
              {eyebrow}
            </p>
          )}

          <div>
            <h1 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-page-title)', margin: 0 }}>
              {product.name}
            </h1>
            <p style={{ fontSize: 'var(--mc-type-subhead)', margin: 'var(--mc-space-2xs) 0 0' }}>{priceLabel}</p>
          </div>

          {product.description_short && (
            <p style={{ color: 'var(--mc-text-muted)', margin: 0 }}>{product.description_short}</p>
          )}

          <AddToBag productSlug={slug} productName={product.name} variants={variants ?? []} />

          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0, borderTop: '1px solid var(--mc-border-default)', paddingTop: 'var(--mc-space-md)' }}>
            Free delivery on orders over {formatPence(settings.free_delivery_threshold_pence)}. Returns accepted
            within {settings.return_window_days} days of delivery.
          </p>
        </div>
      </div>

      <div className="mc-page-gutter" style={{ paddingBottom: 'var(--mc-space-2xl)' }}>
        <section className="mc-pdp-spec">
          {fabricFields.length > 0 && (
            <SpecColumn title="Fabric and construction">
              <dl style={dlStyle}>
                {product.fit && <Row label="Fit" value={product.fit} />}
                {product.composition && <Row label="Composition" value={product.composition} />}
                {product.fabric_weight_gsm && <Row label="Fabric weight" value={`${product.fabric_weight_gsm} gsm`} />}
                {product.neck && <Row label="Neck" value={product.neck} />}
                {product.made_in && <Row label="Made in" value={product.made_in} />}
              </dl>
            </SpecColumn>
          )}

          <SpecColumn title="Delivery and returns">
            <dl style={dlStyle}>
              <Row label="Free delivery" value={`Orders over ${formatPence(settings.free_delivery_threshold_pence)}`} />
              <Row label="Returns" value={`Accepted within ${settings.return_window_days} days`} />
            </dl>
          </SpecColumn>

          {product.care_instructions && (
            <SpecColumn title="Care">
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{product.care_instructions}</p>
            </SpecColumn>
          )}
        </section>
      </div>

      {product.design_story && (
        <section style={{ background: 'var(--mc-bg-inverse)', color: 'var(--mc-text-inverse)' }}>
          <div className="mc-page-gutter mc-pdp-story" style={{ paddingTop: 'var(--mc-space-2xl)', paddingBottom: 'var(--mc-space-2xl)' }}>
            <div
              style={{
                flex: 1,
                aspectRatio: '4 / 5',
                background: 'var(--mc-espresso)',
                borderRadius: 'var(--mc-radius-md)',
              }}
            />
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', color: 'var(--mc-text-muted-inverse)', margin: '0 0 16px' }}>
                The design story
              </h2>
              <p style={{ whiteSpace: 'pre-line', fontSize: 17, lineHeight: 1.6, margin: 0 }}>{product.design_story}</p>
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <div className="mc-page-gutter" style={{ paddingTop: 'var(--mc-space-2xl)', paddingBottom: 80 }}>
          <h2 style={{ fontFamily: 'var(--mc-font-display)', fontSize: 'var(--mc-type-section)', margin: '0 0 24px' }}>
            More from the drop
          </h2>
          <div className="mc-product-grid-shop">
            {related.map((r) => (
              <ProductCard key={r.slug} product={r} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function SpecColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1.54px', textTransform: 'uppercase', color: 'var(--mc-text-muted)', margin: '0 0 16px' }}>
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
