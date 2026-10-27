'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  primaryButtonStyle,
  disabledButtonStyle,
  mutedSmallStyle,
  panelStyle,
  sectionLabelStyle,
  ruleStyle,
} from '@/components/admin/dialog-styles';

type Report = { added: string[]; skipped: string[]; failed: string[] };

/**
 * The one button on /admin/demo.
 *
 * It reports all three outcomes rather than just success, because "nothing
 * happened" has two very different causes here — every product already has
 * photography (fine, and the point of the guard) or every upload was refused
 * by the storage policy (not fine at all). An empty green tick covering both
 * is the catalogue-query-as-empty-shop failure in a new place.
 */
export function SeedDemoImages() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch('/api/admin/demo/images', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not add the demo photographs.');
        return;
      }
      setReport(body as Report);
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          style={{ ...primaryButtonStyle, ...(busy ? disabledButtonStyle : {}) }}
        >
          {busy ? 'Adding photographs…' : 'Add the demo photographs'}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--mc-status-error)', margin: 0 }}
        >
          {error}
        </p>
      )}

      {report && (
        <div style={panelStyle}>
          <p style={sectionLabelStyle}>What happened</p>
          <div aria-hidden style={ruleStyle} />
          <Lines label="Added" items={report.added} empty="Nothing was added." />
          <Lines
            label="Skipped"
            items={report.skipped}
            empty="Nothing was skipped."
          />
          <Lines label="Failed" items={report.failed} empty="Nothing failed." />
          {report.added.length > 0 && (
            <p style={mutedSmallStyle}>
              Open the shop to see them. Every one is attached to a real colourway, so the product
              page gallery swaps when you change colour.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Lines({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div>
      <p style={{ ...mutedSmallStyle, fontWeight: 600, margin: 0 }}>
        {label}: {items.length}
      </p>
      {items.length === 0 ? (
        <p style={mutedSmallStyle}>{empty}</p>
      ) : (
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {items.map((item) => (
            <li key={item} style={{ fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
