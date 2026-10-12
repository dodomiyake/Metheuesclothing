'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, COLLECTION_BADGE } from '@/components/admin/status-badge';

export type CollectionRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  published_at: string | null;
  /** The hero as a public URL, or null while this collection has none. */
  heroUrl: string | null;
  productCount: number;
};

/**
 * A09's drag-ordered list (145:2511).
 *
 * DRAGGING IS NOT THE ONLY WAY TO MOVE A ROW, deliberately. The design
 * draws a "::" handle and nothing else, and a drag-only control cannot be
 * operated from a keyboard at all — which would make the one thing this
 * screen exists to do unreachable for anyone not using a mouse. So each row
 * also carries real Move up / Move down buttons at the 44px minimum
 * (CLAUDE.md rule 8). They are the same reorder, through the same endpoint.
 *
 * The order is saved as soon as it changes rather than behind a Save
 * button: the design has no Save on this screen, and a list that looks
 * reordered but is not would be worse than either. A failed save puts the
 * list back where it was and says so, so what is on screen is always what
 * is in the database.
 */
export function CollectionsList({ rows }: { rows: CollectionRow[] }) {
  const router = useRouter();
  const [order, setOrder] = useState(rows);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: CollectionRow[]) {
    const previous = order;
    setOrder(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/collections/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ collection_ids: next.map((c) => c.id) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setOrder(previous);
        setError(body.error ?? 'Could not save the new order.');
        return;
      }
      router.refresh();
    } catch {
      setOrder(previous);
      setError('Could not reach the server. The order is unchanged.');
    } finally {
      setSaving(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    void persist(next);
  }

  return (
    <>
      <div
        style={{
          background: 'var(--mc-bg-surface)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 'var(--mc-radius-md)',
          padding: 18,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {order.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--mc-text-muted)', margin: 0 }}>
            No collections yet. A collection is a drop or a range — a T-shirt can sit in several,
            and every one of them gets its own page on the shop.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {order.map((c, i) => {
              const badge = COLLECTION_BADGE[c.status] ?? { label: c.status, tone: 'neutral' as const };
              return (
                <li
                  key={c.id}
                  draggable
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragging || dragging === c.id) return;
                    move(order.findIndex((r) => r.id === dragging), i);
                    setDragging(null);
                  }}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 0',
                    borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                    opacity: dragging === c.id ? 0.5 : 1,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 14, color: 'var(--mc-text-muted)', cursor: 'grab' }}>
                    ⠿
                  </span>

                  {/* 145:2514 — a 56x42 cover, the hero A10 uploaded. A grey
                      block in the design too, and still one here for a
                      collection without a photograph. aria-hidden either
                      way: the collection's name is the next thing in the
                      row, so the thumbnail is decoration beside its own
                      label. */}
                  <span
                    aria-hidden
                    style={{
                      width: 56,
                      height: 42,
                      flexShrink: 0,
                      background: 'var(--mc-mist)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      display: 'block',
                    }}
                  >
                    {c.heroUrl && (
                      <img
                        src={c.heroUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                  </span>

                  <span style={{ flex: '1 0 0', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Link
                      href={`/admin/collections/${c.id}`}
                      style={{ fontSize: 15, fontWeight: 600, color: 'var(--mc-text-primary)' }}
                    >
                      {c.name}
                    </Link>
                    <span style={{ fontSize: 12, lineHeight: '18px', color: 'var(--mc-text-muted)' }}>
                      /{c.slug} · {c.productCount} T-shirt{c.productCount === 1 ? '' : 's'} ·{' '}
                      {statusLine(c)}
                    </span>
                  </span>

                  <StatusBadge label={badge.label} tone={badge.tone} />

                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MoveButton
                      label={`Move ${c.name} up`}
                      glyph="↑"
                      disabled={i === 0 || saving}
                      onClick={() => move(i, i - 1)}
                    />
                    <MoveButton
                      label={`Move ${c.name} down`}
                      glyph="↓"
                      disabled={i === order.length - 1 || saving}
                      onClick={() => move(i, i + 1)}
                    />
                  </span>

                  {/* Ghost button (9:14). */}
                  <Link
                    href={`/admin/collections/${c.id}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 44,
                      padding: '14px 24px',
                      borderRadius: 'var(--mc-radius-sm)',
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: '0.32px',
                      color: 'var(--mc-text-primary)',
                      textDecoration: 'none',
                    }}
                  >
                    Edit
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--mc-status-error)', margin: 0 }}>
          {error}
        </p>
      )}
    </>
  );
}

/** "Live since 5 Sept" / "Scheduled 1 Oct, 09:00" / "Hidden from the shop"
 * (145:2517/2530/2543/2558), each read off real columns. */
function statusLine(c: CollectionRow): string {
  if (c.status === 'live') {
    return c.published_at ? `Live since ${shortDate(c.published_at)}` : 'Live';
  }
  if (c.status === 'scheduled') {
    return c.published_at ? `Scheduled ${shortDateTime(c.published_at)}` : 'Scheduled — no date set';
  }
  // The design says "Hidden from navigation". There is no navigation menu
  // built from collections, and a hidden one is not returned to a customer
  // at all (002_rls.sql:88), so this says what actually happens.
  return 'Hidden from the shop';
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function MoveButton({
  label,
  glyph,
  disabled,
  onClick,
}: {
  label: string;
  glyph: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: '1px solid var(--mc-border-control)',
        borderRadius: 'var(--mc-radius-sm)',
        color: disabled ? 'var(--mc-text-muted)' : 'var(--mc-text-primary)',
        fontSize: 16,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
