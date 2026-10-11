'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * A19's toolbar (143:2551): search, Type, Country, Sort.
 *
 * Same shape as A11's and A17's — a real <select> carrying the control with
 * the label and chevron drawn over it, because a bare <select> sizes itself
 * to its longest option and pushes everything beside it off a 390px screen.
 *
 * TYPE is four options against the design's unspecified "Type: all", and
 * they are the four the ACCOUNT column can actually show: an account holder
 * or a guest, and within account holders, confirmed or not. Every one is
 * answered by admin_customers() rather than filtered after the fact, so the
 * count and the pagination stay honest.
 *
 * COUNTRY is GB and IE and nothing else, because checkout restricts
 * shipping to exactly those two (`allowed_countries: ['GB', 'IE']` in
 * app/api/checkout/route.ts). A longer list would be a filter that can
 * never match. The design's Germany row is mock data from before that
 * restriction existed.
 */
const TYPES = [
  { value: 'registered', label: 'account holders' },
  { value: 'guest', label: 'guests' },
  { value: 'verified', label: 'verified' },
  { value: 'unverified', label: 'unverified' },
];

const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'IE', label: 'Ireland' },
];

const SORTS = [
  { value: 'recent', label: 'most recent order' },
  { value: 'spent', label: 'highest spend' },
  { value: 'orders', label: 'most orders' },
  { value: 'name', label: 'name A–Z' },
];

export function CustomersToolbar({
  q,
  type,
  country,
  sort,
}: {
  q: string;
  type: string;
  country: string;
  sort: string;
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
    router.push(qs ? `/admin/customers?${qs}` : '/admin/customers');
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
          placeholder="Search by name or email"
          aria-label="Search customers"
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

      <Select label="Type" value={type} onChange={(v) => go({ type: v })} options={TYPES} />
      <Select
        label="Country"
        value={country}
        onChange={(v) => go({ country: v })}
        options={COUNTRIES}
      />
      {/* Sort has no "all": the list is always in some order, so the
          default is named rather than left blank. */}
      <Select
        label="Sort"
        value={sort || 'recent'}
        onChange={(v) => go({ sort: v === 'recent' ? '' : v })}
        options={SORTS}
        allLabel={null}
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
  allLabel?: string | null;
}) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel ?? '';
  return (
    <span className="mc-admin-filter">
      <span className="mc-admin-filter-label" aria-hidden="true">
        {label}: {current}
      </span>
      <Chevron />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {allLabel !== null && <option value="">{label}: {allLabel}</option>}
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
