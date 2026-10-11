'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StatusBadge, COLLECTION_BADGE } from '@/components/admin/status-badge';

export type MemberProduct = { id: string; name: string; slug: string; status: string };

export type CollectionValues = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  hero_alt: string;
  status: 'scheduled' | 'live' | 'hidden';
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  position: number | null;
};

/**
 * A10 Collection editor — Figma 145:2762 (Desktop pulled) / 145:2572
 * (Tablet). Two columns at 1440, one below it, with a 340px side rail —
 * the same split A12/A13/A20 use.
 *
 * WHAT THE DESIGN DRAWS THAT IS NOT HERE, and why:
 *
 *  - "Replace image" and "Remove" on the hero (145:2876). There is no
 *    upload pipeline anywhere in this codebase — it is the same gap that
 *    leaves A05 Product image manager unbuilt and every product card
 *    showing a well. A button that opens nothing is worse than no button.
 *    ALT TEXT IS KEPT AND IS REAL: hero_alt is a column, screen 19 reads
 *    it, and writing it now means the day an image lands it already has a
 *    description instead of needing a second pass.
 *
 *  - "View on the site" (145:2843) is kept and now goes somewhere — it did
 *    not until screen 19 was built last commit.
 *
 *  - The helper under HANDLE in the design is a bare URL. It is a real link
 *    here, because the page it names now exists.
 *
 * SCHEDULING IS HALF A FEATURE AND THE PANEL SAYS SO. `scheduled` is a real
 * status with a real date, and the storefront honours it — RLS shows only
 * `status = 'live'`, so a scheduled collection is genuinely invisible. What
 * does not exist is anything that FLIPS it to live when the date arrives:
 * no cron, no scheduled function, nothing. The design's "Scheduled 1 Oct,
 * 09:00" implies a system that publishes it for you. Rather than drop the
 * status or imply the automation, the panel states the date and says plainly
 * that someone has to come back and set it live. Worth closing with a
 * scheduled job; worth not pretending until then.
 */
export function CollectionForm({
  initial,
  members,
  candidates,
}: {
  initial: CollectionValues;
  members: MemberProduct[];
  candidates: MemberProduct[];
}) {
  const router = useRouter();
  const isNew = initial.id === null;

  const [values, setValues] = useState(initial);
  const [list, setList] = useState(members);
  const [adding, setAdding] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof CollectionValues>(key: K, value: CollectionValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const unused = candidates.filter((c) => !list.some((m) => m.id === c.id));

  function moveMember(from: number, to: number) {
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setList(next);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        status: values.status,
        description: values.description.trim() || null,
        hero_alt: values.hero_alt.trim() || null,
        seo_title: values.seo_title.trim() || null,
        seo_description: values.seo_description.trim() || null,
        published_at: values.status === 'scheduled' ? values.published_at : undefined,
      };

      const res = await fetch(
        isNew ? '/api/admin/collections' : `/api/admin/collections/${initial.id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error ?? 'Could not save this collection.');
        return;
      }

      const id = (payload.id as string) ?? initial.id;

      // The membership write is its own request because it is its own
      // failure: the route that owns it says why the order of its two
      // statements matters. A collection saving its fields but not its
      // running order is recoverable; the reverse would be confusing.
      if (!isNew) {
        const membersRes = await fetch(`/api/admin/collections/${id}/products`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ product_ids: list.map((m) => m.id) }),
        });
        if (!membersRes.ok) {
          const mb = await membersRes.json().catch(() => ({}));
          setError(mb.error ?? 'The collection saved, but its T-shirts did not.');
          return;
        }
      }

      setSaved(true);
      if (isNew) router.push(`/admin/collections/${id}`);
      else router.refresh();
    } catch {
      setError('Could not reach the server. Nothing was saved.');
    } finally {
      setSaving(false);
    }
  }

  const badge = COLLECTION_BADGE[values.status] ?? { label: values.status, tone: 'neutral' as const };

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            {values.name.trim() || (isNew ? 'New collection' : 'Untitled collection')}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            <Link href="/admin/collections" style={{ color: 'inherit' }}>
              Collections
            </Link>{' '}
            / {values.name.trim() || 'New'}
            {!isNew && ` · ${list.length} T-shirt${list.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
          <button type="button" onClick={save} disabled={saving} style={primaryButton(saving)}>
            {saving ? 'Saving…' : isNew ? 'Create collection' : 'Save changes'}
          </button>
          {!isNew && (
            <Link href={`/collections/${initial.slug}`} style={ghostButton}>
              View on the site
            </Link>
          )}
        </div>
      </div>

      <div className="mc-admin-content">
        {error && (
          <p role="alert" style={{ fontSize: 14, color: 'var(--mc-status-error)', margin: 0 }}>
            {error}
          </p>
        )}
        {saved && !error && (
          <p role="status" style={{ fontSize: 14, color: 'var(--mc-status-success)', margin: 0 }}>
            Saved.
          </p>
        )}

        <div className="mc-admin-order-layout mc-admin-customer-layout">
          <div className="mc-admin-order-main">
            <Panel heading="Basics">
              <Field
                label="Collection name"
                value={values.name}
                onChange={(v) => set('name', v)}
                maxLength={200}
              />
              <Field
                label="Handle"
                value={values.slug}
                onChange={(v) => set('slug', v)}
                maxLength={200}
                helper={
                  values.slug.trim() ? (
                    <>
                      The page is{' '}
                      <Link href={`/collections/${values.slug.trim()}`} style={{ color: 'var(--mc-text-primary)' }}>
                        /collections/{values.slug.trim()}
                      </Link>
                      . Lowercase letters, numbers and hyphens only.
                    </>
                  ) : (
                    'Lowercase letters, numbers and hyphens only. It becomes the collection page’s address.'
                  )
                }
              />
              <TextArea
                label="Description"
                value={values.description}
                onChange={(v) => set('description', v)}
                rows={4}
                maxLength={2000}
                helper="Appears under the heading on the collection page."
              />
            </Panel>

            <Panel heading="Collection hero">
              <div
                aria-hidden
                style={{
                  height: 180,
                  width: '100%',
                  background: 'var(--mc-mist)',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '0 12px 10px',
                  boxSizing: 'border-box',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '1px',
                  color: 'var(--mc-text-muted)',
                }}
              >
                COLLECTION PHOTOGRAPHY 16:9
              </div>
              <p style={mutedSmall}>
                There is no way to upload an image yet — nothing in this shop has an image pipeline,
                which is why every product card is a placeholder too. The alt text below is stored
                now so the picture arrives already described.
              </p>
              <Field
                label="Alt text"
                value={values.hero_alt}
                onChange={(v) => set('hero_alt', v)}
                maxLength={500}
                helper="What someone who cannot see the photograph should be told it shows."
              />
            </Panel>

            <Panel heading={isNew ? 'T-shirts in this collection' : 'T-shirts in this collection — drag to reorder'}>
              {isNew ? (
                <p style={mutedSmall}>
                  Create the collection first, then add T-shirts to it. There is nothing to attach
                  them to until it exists.
                </p>
              ) : (
                <>
                  {list.length === 0 ? (
                    <p style={mutedSmall}>
                      Nothing in this collection yet. Add a T-shirt below — it stays published
                      wherever else it appears.
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                      {list.map((m, i) => (
                        <li
                          key={m.id}
                          draggable
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', m.id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData('text/plain');
                            const from = list.findIndex((x) => x.id === id);
                            if (from >= 0) moveMember(from, i);
                          }}
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 12,
                            padding: '11px 0',
                            borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                          }}
                        >
                          <span aria-hidden style={{ fontSize: 13, color: 'var(--mc-text-muted)', cursor: 'grab' }}>
                            ⠿
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mc-text-muted)', width: 18 }}>
                            {i + 1}
                          </span>
                          <span aria-hidden style={{ width: 32, height: 40, background: 'var(--mc-mist)', borderRadius: 2, flexShrink: 0 }} />
                          <span style={{ flex: '1 0 0', minWidth: 140, fontSize: 14, fontWeight: 500 }}>
                            {m.name}
                            {m.status !== 'published' && (
                              <span style={{ color: 'var(--mc-text-muted)', fontWeight: 400 }}>
                                {' '}
                                · {m.status}, so it will not show on the page
                              </span>
                            )}
                          </span>
                          {/* Keyboard equivalents for the drag handle, the
                              same reason A09's list has them. */}
                          <MoveButton label={`Move ${m.name} up`} glyph="↑" disabled={i === 0} onClick={() => moveMember(i, i - 1)} />
                          <MoveButton
                            label={`Move ${m.name} down`}
                            glyph="↓"
                            disabled={i === list.length - 1}
                            onClick={() => moveMember(i, i + 1)}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setList(list.filter((x) => x.id !== m.id));
                              setSaved(false);
                            }}
                            style={{ ...ghostButton, border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p style={mutedSmall}>
                    This order is the order on the collection page. Removing a T-shirt here does not
                    unpublish it.
                  </p>

                  {unused.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                      <select
                        value={adding}
                        onChange={(e) => setAdding(e.target.value)}
                        aria-label="Choose a T-shirt to add"
                        style={selectStyle}
                      >
                        <option value="">Choose a T-shirt…</option>
                        {unused.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.status !== 'published' ? ` (${c.status})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!adding}
                        onClick={() => {
                          const found = unused.find((c) => c.id === adding);
                          if (!found) return;
                          setList([...list, found]);
                          setAdding('');
                          setSaved(false);
                        }}
                        style={{ ...secondaryButton, opacity: adding ? 1 : 0.5, cursor: adding ? 'pointer' : 'default' }}
                      >
                        Add T-shirt
                      </button>
                    </div>
                  ) : (
                    <p style={mutedSmall}>
                      {candidates.length === 0
                        ? 'There are no T-shirts to add yet.'
                        : 'Every T-shirt is already in this collection.'}
                    </p>
                  )}
                </>
              )}
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            <Panel heading="Publishing">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 8px' }}>
                <StatusBadge label={badge.label} tone={badge.tone} />
              </div>
              {values.published_at && (
                <Row
                  label={values.status === 'scheduled' ? 'Scheduled for' : 'Live since'}
                  value={fullDateTime(values.published_at)}
                />
              )}
              {values.position !== null && (
                <Row label="Position on the collections page" value={`${values.position + 1}`} />
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={labelStyle}>Change to</span>
                <select
                  value={values.status}
                  onChange={(e) => set('status', e.target.value as CollectionValues['status'])}
                  style={selectStyle}
                >
                  <option value="live">Live now</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>

              {values.status === 'scheduled' && (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={labelStyle}>Go live on</span>
                    <input
                      type="datetime-local"
                      value={toLocalInput(values.published_at)}
                      onChange={(e) => set('published_at', fromLocalInput(e.target.value))}
                      style={inputStyle}
                    />
                  </label>
                  <p style={mutedSmall}>
                    Nothing publishes it for you when that time comes — there is no scheduler in
                    this shop yet. The date is recorded and shown here and on the collection page,
                    and someone has to come back and set this to Live now.
                  </p>
                </>
              )}

              {values.status === 'hidden' && (
                <p style={mutedSmall}>
                  Hidden takes the collection off the shop completely, including its own page. A
                  link someone already has will give them a not-found.
                </p>
              )}
            </Panel>

            <Panel heading="SEO">
              <Field
                label="SEO title"
                value={values.seo_title}
                onChange={(v) => set('seo_title', v)}
                maxLength={200}
                helper={`${values.seo_title.length} of 60 characters used well`}
              />
              <TextArea
                label="Meta description"
                value={values.seo_description}
                onChange={(v) => set('seo_description', v)}
                rows={3}
                maxLength={500}
                helper={`${values.seo_description.length} of 155 characters used well`}
              />
              <p style={mutedSmall}>
                Both are real: the collection page reads them for its title and description tag.
                The counts are guidance, not limits — search engines truncate past roughly 60 and
                155, they do not reject.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- primitives */

function Panel({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <h2
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
          color: 'var(--mc-text-muted)',
          margin: 0,
        }}
      >
        {heading}
      </h2>
      <div aria-hidden style={{ height: 1, width: '100%', background: 'var(--mc-border-default)' }} />
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  helper,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: React.ReactNode;
  maxLength?: number;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  helper,
  rows,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: React.ReactNode;
  rows: number;
  maxLength?: number;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical' }}
      />
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{value}</span>
    </div>
  );
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
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}

function fullDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/** <input type="datetime-local"> speaks local wall-clock with no zone; the
 * column is timestamptz. Converting both ways here keeps the picker honest
 * about the user's own clock. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
};

/* --mc-border-control, not --mc-border-default: on a Paper ground a white
   control has ~1.02:1 of fill contrast and its border is the only thing
   identifying it (CLAUDE.md rule 8). */
const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '12px 14px',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  background: 'var(--mc-bg-surface)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto', minWidth: 200, maxWidth: '100%' };

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
};

const buttonBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '14px 24px',
  borderRadius: 'var(--mc-radius-sm)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 16,
  fontWeight: 600,
  letterSpacing: '0.32px',
  textDecoration: 'none',
  boxSizing: 'border-box',
};

const primaryButton = (busy: boolean): React.CSSProperties => ({
  ...buttonBase,
  background: 'var(--mc-action-primary-bg)',
  color: 'var(--mc-action-primary-text)',
  border: 'none',
  cursor: busy ? 'default' : 'pointer',
  opacity: busy ? 0.7 : 1,
});

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--mc-border-strong)',
  background: 'none',
  color: 'var(--mc-text-primary)',
};

const ghostButton: React.CSSProperties = { ...buttonBase, color: 'var(--mc-text-primary)' };
