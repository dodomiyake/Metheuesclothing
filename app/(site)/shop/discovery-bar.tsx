'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FilterGroups } from './filter-groups';
import { SortSelect } from './sort-select';
import { clearAllHref, type ShopSearchParams } from '@/lib/shop/filters';

/**
 * §8.2 discovery bar (03B/C) — the tablet screen uses this same
 * Filter-button-and-sheet pattern as mobile, not a shrunk version of the
 * desktop rail, so this component (hidden at 1440px+ by .mc-discovery-bar
 * in globals.css) covers both.
 */
export function DiscoveryBar({
  params,
  resultCount,
  filterCount,
  availableSizes,
  availableColours,
  availableFits,
  availableCollections,
  priceRange,
}: {
  params: ShopSearchParams;
  resultCount: number;
  filterCount: number;
  availableSizes: string[];
  availableColours: string[];
  availableFits: string[];
  availableCollections: string[];
  priceRange: [number, number] | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="mc-discovery-bar mc-page-gutter"
        style={{
          background: 'var(--mc-bg-surface)',
          borderTop: '1px solid var(--mc-border-default)',
          borderBottom: '1px solid var(--mc-border-default)',
          alignItems: 'center',
          gap: 12,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        {/* Secondary Button, shrink-0 — 47:328. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 24px',
            border: '1px solid var(--mc-border-strong)',
            borderRadius: 'var(--mc-radius-sm)',
            background: 'none',
            fontFamily: 'var(--mc-font-body)',
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '0.32px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Filter{filterCount ? ` · ${filterCount}` : ''}
        </button>
        <SortSelect />
        {/* 47:334: flex 1 0 0, min-width 0, 13px Medium, right aligned. */}
        <p
          style={{
            flex: '1 0 0',
            minWidth: 0,
            textAlign: 'right',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--mc-text-muted)',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
        >
          {resultCount} style{resultCount === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mc-filter-sheet" data-open={open}>
        <div
          className="mc-page-gutter"
          style={{
            borderBottom: '1px solid var(--mc-border-default)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: 'var(--mc-font-display)', fontSize: 24, margin: 0 }}>Filter</p>
            <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
              {filterCount} filter{filterCount === 1 ? '' : 's'} applied
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ width: 44, height: 44, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        <div className="mc-page-gutter" style={{ flex: 1, paddingBottom: 24 }}>
          {filterCount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 0' }}>
              <Link href={clearAllHref()} style={{ color: 'var(--mc-text-muted)', fontSize: 14 }}>
                Clear all
              </Link>
            </div>
          )}
          <FilterGroups
            params={params}
            availableSizes={availableSizes}
            availableColours={availableColours}
            availableFits={availableFits}
            availableCollections={availableCollections}
            priceRange={priceRange}
          />
        </div>

        <div
          className="mc-page-gutter"
          style={{
            background: 'var(--mc-bg-surface)',
            borderTop: '1px solid var(--mc-border-default)',
            paddingTop: 16,
            paddingBottom: 24,
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{
              width: '100%',
              minHeight: 44,
              background: 'var(--mc-action-primary-bg)',
              color: 'var(--mc-action-primary-text)',
              border: 'none',
              borderRadius: 'var(--mc-radius-sm)',
              fontFamily: 'var(--mc-font-body)',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Show {resultCount} style{resultCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </>
  );
}
