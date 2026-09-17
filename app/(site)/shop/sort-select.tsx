'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Sort control — Figma 47:331 in the mobile discovery bar (47:327), a
 * Secondary Button labelled "Sort · Newest".
 *
 * That label matters structurally, not just cosmetically. This was a bare
 * <select>, and a native select takes its intrinsic width from its LONGEST
 * option, not the selected one: "Sort · Price: Low to High" made the control
 * ~250px wide even while it displayed "Sort · Newest". The mobile discovery
 * bar has no slack at all — the design lays out 20 + 110 + 12 + 154 + 12 +
 * 62 + 20 = exactly 390 — so those extra ~100px pushed the "N styles" count
 * off the right edge of every phone.
 *
 * So the visible width comes from a span showing only the current sort, with
 * the select laid transparently over it. The native dropdown (the right
 * picker on a phone) and the real <select> semantics both survive; only the
 * sizing changes. The focus ring is put back on the wrapper via :has() in
 * globals.css, since an opacity:0 select can't show its own.
 */
/**
 * `short` is what the button shows, `label` what the dropdown lists. No
 * price label fits the design's 154px button at 16px, so on a phone the
 * button truncates — and with "Price low to high" / "Price high to low" both
 * forms truncated to the SAME "Sort · Pric…", which tells you nothing about
 * which is active. Leading with the direction keeps them apart. The full
 * wording is still there the moment the picker opens.
 */
const SORTS = [
  { value: '', label: 'Newest', short: 'Newest' },
  { value: 'price-asc', label: 'Price low to high', short: 'Low to high' },
  { value: 'price-desc', label: 'Price high to low', short: 'High to low' },
] as const;

export function SortSelect({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get('sort') ?? '';
  const current = SORTS.find((s) => s.value === sort) ?? SORTS[0];

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(searchParams.toString());
    if (e.target.value) next.set('sort', e.target.value);
    else next.delete('sort');
    const qs = next.toString();
    router.push(qs ? `/shop?${qs}` : '/shop', { scroll: false });
  }

  return (
    <span className={className ? `mc-sort ${className}` : 'mc-sort'}>
      <span className="mc-sort-label" aria-hidden="true">
        Sort · {current.short}
      </span>
      <select value={sort} onChange={onChange} aria-label="Sort">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            Sort · {s.label}
          </option>
        ))}
      </select>
    </span>
  );
}
