'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { RETURN_BADGE, RETURN_REASONS } from '@/components/admin/status-badge';

/**
 * A17's toolbar (143:2179): search, Status, Age, Reason.
 *
 * All three filters read real columns. Status is the return_status enum.
 * Reason is the closed set POST /api/returns validates against — the design
 * draws "Reason: all" with no options, and inventing a different list here
 * would mean a filter that can never match what customers actually sent.
 * Age is derived from requested_at.
 *
 * The same shape as OrdersToolbar rather than a second pattern: a <select>
 * carrying the real control with a label and chevron drawn over it, because
 * a bare <select> sizes itself to its LONGEST option and pushes everything
 * beside it off a 390px screen — the trap A17's sibling queue hit first.
 */
const AGE_RANGES = [
  { value: '3', label: '3+ days old' },
  { value: '5', label: '5+ days old' },
  { value: '14', label: '14+ days old' },
];

export function ReturnsToolbar({
  q,
  status,
  reason,
  age,
}: {
  q: string;
  status: string;
  reason: string;
  age: string;
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
    // Staying on page 3 of a result set that just shrank to one page looks
    // like a bug rather than a filter.
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/admin/returns?${qs}` : '/admin/returns');
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
          placeholder="Search by return, order or customer"
          aria-label="Search returns"
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
        label="Status"
        value={status}
        onChange={(v) => go({ status: v })}
        options={Object.entries(RETURN_BADGE).map(([value, { label }]) => ({ value, label }))}
      />
      <Select
        label="Age"
        value={age}
        onChange={(v) => go({ age: v })}
        options={AGE_RANGES}
      />
      <Select
        label="Reason"
        value={reason}
        onChange={(v) => go({ reason: v })}
        options={Object.entries(RETURN_REASONS).map(([value, label]) => ({ value, label }))}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const current = options.find((o) => o.value === value)?.label ?? 'all';
  return (
    <span className="mc-admin-filter">
      <span className="mc-admin-filter-label" aria-hidden="true">
        {label}: {current}
      </span>
      <Chevron />
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">{label}: all</option>
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
