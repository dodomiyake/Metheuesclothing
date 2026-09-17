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
 *
 * The ground is --mc-accent, not the ink 24:2 draws: a deliberate departure
 * made when the palette was recoloured cool. This is the only surface that
 * appears on every page, so it is where a brand accent earns the most, and
 * §6 limits the accent's ROLES (never focus, warning or selected state)
 * rather than its prominence. Type on it uses --mc-accent-text (7.46:1).
 */
export function AnnouncementBar({ thresholdPence }: { thresholdPence: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      style={{
        background: 'var(--mc-accent)',
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
            color: 'var(--mc-accent-text)',
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
          color: 'var(--mc-accent-text)',
          cursor: 'pointer',
        }}
      >
        <DismissIcon />
      </button>
    </div>
  );
}
