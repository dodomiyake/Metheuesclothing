'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORTS = [
  { value: '', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
] as const;

export function SortSelect({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get('sort') ?? '';

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString());
    if (e.target.value) next.set('sort', e.target.value);
    else next.delete('sort');
    const qs = next.toString();
    router.push(qs ? `/shop?${qs}` : '/shop', { scroll: false });
  }

  return (
    <select
      className={className}
      value={sort}
      onChange={onChange}
      aria-label="Sort"
      style={{
        minHeight: 44,
        padding: '0 16px',
        border: '1px solid var(--mc-border-strong)',
        borderRadius: 'var(--mc-radius-sm)',
        background: 'none',
        fontFamily: 'var(--mc-font-body)',
        fontSize: 16,
        fontWeight: 600,
      }}
    >
      {SORTS.map((s) => (
        <option key={s.value} value={s.value}>
          Sort · {s.label}
        </option>
      ))}
    </select>
  );
}
