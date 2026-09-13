import Link from 'next/link';
import { getSelected, toggleHref, type ShopSearchParams } from '@/lib/shop/filters';

const chipStyle = (selected: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: selected ? '12.5px 10px 12.5px 16px' : '12.5px 16px',
  gap: 8,
  minHeight: 44,
  borderRadius: 'var(--mc-radius-sm)',
  border: `1px solid ${selected ? 'var(--mc-border-strong)' : 'var(--mc-border-default)'}`,
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
}: {
  title: string;
  paramKey: string;
  options: string[];
  params: ShopSearchParams;
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
            <Link key={opt} href={toggleHref(params, paramKey, opt)} style={chipStyle(isOn)} scroll={false}>
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
}: {
  params: ShopSearchParams;
  availableSizes: string[];
  availableColours: string[];
  availableFits: string[];
  availableCollections: string[];
  priceRange: [number, number] | null;
}) {
  return (
    <>
      <Group title="Size" paramKey="size" options={availableSizes} params={params} />
      <Group title="Colour" paramKey="colour" options={availableColours} params={params} />
      <Group title="Fit" paramKey="fit" options={availableFits} params={params} />
      <Group title="Collection" paramKey="collection" options={availableCollections} params={params} />
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
      <Group title="Availability" paramKey="availability" options={['In stock only']} params={params} />
    </>
  );
}
