'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PAYMENT_BADGE, FULFILMENT_BADGE } from '@/components/admin/status-badge';
import { countryName } from './order-fields';

/**
 * A11's toolbar (128:1915): a search field and four filters.
 *
 * Every option here is built from something real — the two status enums in
 * 001_schema.sql, placed_at, and the countries the existing orders were
 * actually shipped to. Nothing offers a filter that cannot match.
 *
 * Changing any control resets `page`, because staying on page 4 of a result
 * set that just shrank to one page shows an empty table and looks like a
 * bug rather than a filter.
 */
const DAY_RANGES = [
  { value: '', label: 'Date: all time' },
  { value: '7', label: 'Date: last 7 days' },
  { value: '30', label: 'Date: last 30 days' },
  { value: '90', label: 'Date: last 90 days' },
];

export function OrdersToolbar({
  q,
  payment,
  fulfilment,
  country,
  days,
  countryCodes,
}: {
  q: string;
  payment: string;
  fulfilment: string;
  country: string;
  days: string;
  countryCodes: string[];
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
    router.push(qs ? `/admin/orders?${qs}` : '/admin/orders');
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    go({ q: term.trim() });
  }

  return (
    <div className="mc-admin-toolbar">
      <form onSubmit={onSearch} className="mc-admin-search">
        <SearchIcon />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by order number, customer or email"
          aria-label="Search orders"
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

      <Select
        label="Payment"
        value={payment}
        onChange={(v) => go({ payment: v })}
        options={Object.entries(PAYMENT_BADGE).map(([value, { label }]) => ({ value, label }))}
      />
      <Select
        label="Fulfilment"
        value={fulfilment}
        onChange={(v) => go({ fulfilment: v })}
        options={Object.entries(FULFILMENT_BADGE).map(([value, { label }]) => ({ value, label }))}
      />
      <Select
        label="Date"
        value={days}
        onChange={(v) => go({ days: v })}
        options={DAY_RANGES.slice(1).map((d) => ({ value: d.value, label: d.label.replace('Date: ', '') }))}
        allLabel="all time"
      />
      {/* Only rendered once an order has shipped somewhere: with no orders
          there is nothing to filter by, and an empty dropdown is a dead
          control. */}
      {countryCodes.length > 0 && (
        <Select
          label="Country"
          value={country}
          onChange={(v) => go({ country: v })}
          options={countryCodes.map((code) => ({ value: code, label: countryName(code) }))}
        />
      )}
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

/* 18px, matching 128:1917. The storefront's SearchIcon is a 44px icon-button
 * glyph and would be the wrong size and the wrong box here. */
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
