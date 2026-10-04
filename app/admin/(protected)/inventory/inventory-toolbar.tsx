'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * A07's toolbar (128:1308): search, Show, Product, Sort.
 *
 * "Show: needs attention" is the design's own default and is the one filter
 * here that earns its place — it is `stock_quantity <= low_stock_threshold`,
 * a comparison between two columns, which PostgREST cannot express. It is
 * applied after the rows come back, so the footer says the count is for this
 * page rather than pretending it filtered the query.
 */
const SHOW = [
  { value: 'attention', label: 'needs attention' },
  { value: 'low', label: 'low only' },
  { value: 'out', label: 'sold out only' },
  { value: 'inactive', label: 'inactive only' },
];

const SORTS = [
  { value: '', label: 'lowest stock' },
  { value: 'sku', label: 'SKU' },
  { value: 'product', label: 'product' },
];

export function InventoryToolbar({
  q,
  show,
  product,
  sort,
  products,
}: {
  q: string;
  show: string;
  product: string;
  sort: string;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(q);

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/admin/inventory?${qs}` : '/admin/inventory');
  }

  return (
    <div className="mc-admin-toolbar">
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: term.trim() });
        }}
        className="mc-admin-search"
      >
        <SearchIcon />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by SKU, product or colour"
          aria-label="Search inventory"
          style={{
            flex: '1 0 0',
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'none',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 14,
            color: 'var(--mc-text-primary)',
          }}
        />
      </form>

      <Select label="Show" value={show} onChange={(v) => go({ show: v })} options={SHOW} allLabel="everything" />
      {products.length > 0 && (
        <Select
          label="Product"
          value={product}
          onChange={(v) => go({ product: v })}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
      <Select
        label="Sort"
        value={sort}
        onChange={(v) => go({ sort: v })}
        options={SORTS.slice(1)}
        allLabel="lowest stock"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel = 'all',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <span className="mc-admin-filter">
      <span className="mc-admin-filter-label" aria-hidden="true">
        {label}: {current}
      </span>
      <Chevron />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">
          {label}: {allLabel}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="5.6" stroke="var(--mc-text-muted)" strokeWidth="1.25" />
      <line x1="12.4" y1="12.4" x2="16.4" y2="16.4" stroke="var(--mc-text-muted)" strokeWidth="1.25" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M0.5 0.5 L4 3.5 L7.5 0.5" stroke="var(--mc-text-primary)" strokeWidth="1.1" />
    </svg>
  );
}
