'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AUDIT_BADGE } from '@/components/admin/status-badge';

/**
 * A23's toolbar (146:3721): Who, What, When.
 *
 * Who is built from the actor labels that actually appear in the log, not
 * from `profiles` — a staff member who has never done anything auditable
 * should not be offered as a filter, and 'System' is an actor that has no
 * profile at all.
 *
 * What is built from AUDIT_BADGE, which lists the actions this codebase
 * writes. The design's "all actions" would otherwise suggest a vocabulary
 * wider than the log has.
 *
 * WHEN DEFAULTS TO 30 DAYS, matching the frame, and that default is load-
 * bearing rather than cosmetic: this table only grows, nothing prunes it,
 * and a log screen that reads everything by default gets slower every week.
 */
const WHEN = [
  { value: '7', label: 'last 7 days' },
  { value: '30', label: 'last 30 days' },
  { value: '90', label: 'last 90 days' },
  { value: 'all', label: 'everything' },
];

export function AuditToolbar({
  who,
  what,
  when,
  actors,
}: {
  who: string;
  what: string;
  when: string;
  actors: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/admin/audit?${qs}` : '/admin/audit');
  }

  return (
    <div className="mc-admin-toolbar">
      <Select
        label="Who"
        value={who}
        onChange={(v) => go({ who: v })}
        options={actors.map((a) => ({ value: a, label: a }))}
        allLabel="everyone"
      />
      <Select
        label="What"
        value={what}
        onChange={(v) => go({ what: v })}
        options={Object.entries(AUDIT_BADGE).map(([value, { label }]) => ({ value, label }))}
        allLabel="all actions"
      />
      <Select
        label="When"
        value={when}
        onChange={(v) => go({ when: v })}
        options={WHEN}
        allLabel="last 30 days"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
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

function Chevron() {
  return (
    <svg width="8" height="4" viewBox="0 0 8 4" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M0.5 0.5 L4 3.5 L7.5 0.5" stroke="var(--mc-text-primary)" strokeWidth="1.1" />
    </svg>
  );
}
