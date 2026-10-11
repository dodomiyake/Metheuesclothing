'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * A03's toolbar (128:733): search, Status, Collection, Sort.
 *
 * Same shape as A11's and A17's rather than a fourth pattern — a <select>
 * carrying the real control with a label and chevron drawn over it, because
 * a bare <select> sizes itself to its LONGEST option and pushes everything
 * beside it off a 390px screen.
 *
 * STATUS OFFERS THE FOUR ENUM VALUES ONLY. "Sold out" appears in the table
 * as a badge but is not a products.status — it is derived from published +
 * zero stock, so it cannot be a WHERE clause without a second query. A
 * filter that silently returns the wrong rows is worse than one that is not
 * there.
 */
const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const SORTS = [
  { value: '', label: 'recently updated' },
  { value: 'name', label: 'name A–Z' },
  { value: 'stock', label: 'lowest stock' },
];

export function ProductsToolbar({
  q,
  status,
  collection,
  sort,
  collections,
}: {
  q: string;
  status: string;
  collection: string;
  sort: string;
  collections: { id: string; name: string }[];
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
    router.push(qs ? `/admin/products?${qs}` : '/admin/products');
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
          placeholder="Search by name or SKU"
          aria-label="Search T-shirts"
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

      <Select label="Status" value={status} onChange={(v) => go({ status: v })} options={STATUSES} />
      {/* Only rendered once a collection exists: an empty dropdown is a dead
          control, the same call A11's Country filter makes. */}
      {collections.length > 0 && (
        <Select
          label="Collection"
          value={collection}
          onChange={(v) => go({ collection: v })}
          options={collections.map((c) => ({ value: c.id, label: c.name }))}
        />
      )}
      <Select
        label="Sort"
        value={sort}
        onChange={(v) => go({ sort: v })}
        options={SORTS.slice(1)}
        allLabel="recently updated"
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
