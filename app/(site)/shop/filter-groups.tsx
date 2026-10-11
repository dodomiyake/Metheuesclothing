import Link from 'next/link';
import { getSelected, toggleHref, type ShopSearchParams } from '@/lib/shop/filters';

const chipStyle = (selected: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: selected ? '12.5px 10px 12.5px 16px' : '12.5px 16px',
  gap: 8,
  minHeight: 44,
  borderRadius: 'var(--mc-radius-sm)',
  border: `1px solid ${selected ? 'var(--mc-border-strong)' : 'var(--mc-border-control)'}`,
  background: selected ? 'var(--mc-bg-inverse)' : 'transparent',
  color: selected ? 'var(--mc-text-inverse)' : 'var(--mc-text-primary)',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
});

function Group({
  title,
  paramKey,
  options,
  params,
  basePath,
}: {
  title: string;
  paramKey: string;
  options: string[];
  params: ShopSearchParams;
  basePath: string;
}) {
  if (!options.length) return null;
  const selected = getSelected(params, paramKey);
  return (
    <div
      style={{
        borderBottom: '1px solid var(--mc-border-default)',
        padding: '16px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        width: '100%',
      }}
    >
      <p
        style={{
          fontSize: 'var(--mc-type-label)',
          fontWeight: 600,
          letterSpacing: '1.54px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: 0,
        }}
      >
        {title}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const isOn = selected.includes(opt);
          return (
            <Link
              key={opt}
              href={toggleHref(params, paramKey, opt, basePath)}
              style={chipStyle(isOn)}
              scroll={false}
            >
              {opt}
              {isOn && <span aria-hidden>×</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function FilterGroups({
  params,
  availableSizes,
  availableColours,
  availableFits,
  availableCollections,
  priceRange,
  basePath = '/shop',
}: {
  params: ShopSearchParams;
  availableSizes: string[];
  availableColours: string[];
  availableFits: string[];
  availableCollections: string[];
  priceRange: [number, number] | null;
  /**
   * Screen 19 passes '/collections/<slug>'. It also passes an EMPTY
   * availableCollections, which is how the Collection facet disappears
   * there — Group returns null for an empty option list, and the frame
   * removes that facet because the page IS the collection.
   */
  basePath?: string;
}) {
  return (
    <>
      <Group title="Size" paramKey="size" options={availableSizes} params={params} basePath={basePath} />
      <Group title="Colour" paramKey="colour" options={availableColours} params={params} basePath={basePath} />
      <Group title="Fit" paramKey="fit" options={availableFits} params={params} basePath={basePath} />
      <Group
        title="Collection"
        paramKey="collection"
        options={availableCollections}
        params={params}
        basePath={basePath}
      />
      {/* Price is informational in the design -- the rail and filter sheet
          both show a plain range, no selectable chips -- and Availability
          is a single derived chip (in-stock only), not a set worth a Group. */}
      {priceRange && (
        <div style={{ borderBottom: '1px solid var(--mc-border-default)', padding: '16px 0', width: '100%' }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--mc-text-primary)', margin: '0 0 6px' }}>Price</p>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            £{(priceRange[0] / 100).toFixed(0)} – £{(priceRange[1] / 100).toFixed(0)}
          </p>
        </div>
      )}
      <Group
        title="Availability"
        paramKey="availability"
        options={['In stock only']}
        params={params}
        basePath={basePath}
      />
    </>
  );
}
