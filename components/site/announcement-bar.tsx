'use client';

import { useState } from 'react';
import { formatPence } from '@/lib/money';
import { DismissIcon } from './icons';

/**
 * Figma node 24:2. "The free-delivery threshold quoted here must match Store
 * settings — nothing validates that automatically, so treat the two as one
 * change" (component description) — thresholdPence comes from the caller's
 * own store_settings read rather than being hardcoded here, which is what
 * makes that impossible to get out of sync.
 */
export function AnnouncementBar({ thresholdPence }: { thresholdPence: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        background: 'var(--mc-bg-inverse)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 8,
      }}
    >
      <div style={{ width: 44, flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
        <span
          style={{
            fontFamily: 'var(--mc-font-body)',
            fontSize: 'var(--mc-type-tag)',
            fontWeight: 600,
            letterSpacing: '1.44px',
            textTransform: 'uppercase',
            color: 'var(--mc-text-inverse)',
          }}
        >
          Free UK delivery on orders over {formatPence(thresholdPence)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          width: 44,
          height: 44,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          color: 'var(--mc-text-inverse)',
          cursor: 'pointer',
        }}
      >
        <DismissIcon />
      </button>
    </div>
  );
}
