import Link from 'next/link';
import { formatPence } from '@/lib/money';
import { swatchColour } from '@/lib/shop/colour-swatch';

export type ProductCardData = {
  slug: string;
  name: string;
  minPrice: number;
  colours: string[];
  inStock: boolean;
  lowStock: boolean;
  isNew: boolean;
  isLimitedEdition: boolean;
};

/**
 * §8.2 Product Card (Figma node 20:60). Availability covers New / Limited
 * Edition / Low stock / Sold out -- all derived from real data (published_at
 * recency, collection membership, stock_quantity vs low_stock_threshold),
 * never fabricated. Image well stays a placeholder: no product photography
 * exists yet (README's "blocked on the owner" list).
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const label = !product.inStock
    ? { text: 'Sold out', bg: 'var(--mc-bg-surface)', fg: 'var(--mc-text-muted)' }
    : product.lowStock
      ? { text: 'Low stock', bg: 'var(--mc-bg-surface)', fg: 'var(--mc-text-primary)' }
      : product.isLimitedEdition
        ? { text: 'Limited Edition', bg: 'var(--mc-oxblood)', fg: 'var(--mc-text-inverse)' }
        : product.isNew
          ? { text: 'New', bg: 'var(--mc-bg-inverse)', fg: 'var(--mc-text-inverse)' }
          : null;

  return (
    <Link href={`/shop/${product.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'var(--mc-sand)',
          position: 'relative',
          marginBottom: 12,
          opacity: product.inStock ? 1 : 0.55,
        }}
      >
        <p
          style={{
            position: 'absolute',
            left: 16,
            bottom: 16,
            fontSize: 11,
            letterSpacing: '1.32px',
            textTransform: 'uppercase',
            color: 'var(--mc-text-muted)',
            margin: 0,
          }}
        >
          Product photography 4:5
        </p>
        {label && (
          <span
            style={{
              position: 'absolute',
              left: 16,
              top: 16,
              background: label.bg,
              color: label.fg,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              padding: '6px 10px',
            }}
          >
            {label.text}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: 'var(--mc-text-primary)',
          minHeight: 46,
          margin: '0 0 8px',
        }}
      >
        {product.name}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ flex: 1, fontSize: 16, fontWeight: 500, color: product.inStock ? 'var(--mc-text-primary)' : 'var(--mc-text-muted)', margin: 0 }}>
          {formatPence(product.minPrice)}
        </p>
        {product.colours.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }} aria-label={`${product.colours.length} colours`}>
            {product.colours.slice(0, 4).map((c) => (
              <span
                key={c}
                title={c}
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: swatchColour(c),
                  border: '1px solid var(--mc-border-default)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
