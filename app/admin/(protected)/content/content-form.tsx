'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ContentPayload } from '@/lib/admin/content-schema';

export type ProductOption = { slug: string; name: string; status: string };
export type CollectionOption = { slug: string; name: string };

/**
 * A21 Store content — Figma 146:2755 (Desktop pulled) / 146:2536 (Tablet).
 * No Mobile frame; A21 is on `admin_breakpoint_decision`'s no_mobile list,
 * so the page wraps this in WideOnly.
 *
 * SEVEN NUMBERED SLOTS, exactly as drawn, and the screen says what it is:
 * "the layout does not change, only what goes in it". §9.7 calls this a
 * limited content system rather than a page builder, and A21's own ledger
 * note says the UI should state that rather than imply otherwise — which
 * is what the side panel does.
 *
 * FOUR DEPARTURES, each one closing a hole rather than opening one:
 *
 *  - The hero's "Button goes to" is a SELECT of real destinations (the
 *    shop, the collections index, each live collection), and the route
 *    refuses anything else. The design draws a select too; making it free
 *    text would put a 404 one typo away on the busiest button in the shop.
 *  - The hero image slot is shown and not editable. There is no upload
 *    pipeline anywhere — the same gap that leaves A05 unbuilt — so a
 *    "replace" control would open nothing.
 *  - Each reassurance highlight gets TWO fields, not one. A21 draws a
 *    single line per highlight while the homepage (39:289) draws a title
 *    and a supporting line under it, and the page is the thing customers
 *    read.
 *  - The craft specification rows are editable here. A21 does not draw
 *    them at all, but they are half of §9.7's "brand/craft story" slot and
 *    they are the most falsifiable copy on the homepage — "240 GSM",
 *    "100% combed cotton" — so leaving them hardcoded would mean a claim
 *    about the garment that only a developer could correct.
 */
export function ContentForm({
  initial,
  products,
  collections,
  lastPublished,
}: {
  initial: ContentPayload;
  products: ProductOption[];
  collections: CollectionOption[];
  lastPublished: { at: string; by: string | null } | null;
}) {
  const [values, setValues] = useState<ContentPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // "Unsaved changes — 3 fields" (146:2980). A real count, not a dirty
  // flag: comparing the two trees tells you how much is pending, which is
  // what makes the number worth showing.
  const changedCount = useMemo(() => countChanges(initial, values), [initial, values]);

  function patch<K extends keyof ContentPayload>(key: K, value: Partial<ContentPayload[K]>) {
    setValues((v) => ({ ...v, [key]: { ...v[key], ...value } }));
    setSavedAt(null);
  }

  async function publish() {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not publish the homepage content.');
        return;
      }
      setSavedAt(body.published_at ?? new Date().toISOString());
    } catch {
      setError('Could not reach the server. Nothing was published.');
    } finally {
      setSaving(false);
    }
  }

  const destinations = [
    { value: '/shop', label: 'All T-shirts' },
    ...(collections.length ? [{ value: '/collections', label: 'Collections index' }] : []),
    ...collections.map((c) => ({ value: `/collections/${c.slug}`, label: c.name })),
  ];

  const featured = values.featured_products.slugs;
  const byslug = new Map(products.map((p) => [p.slug, p]));

  function setFeatured(slugs: string[]) {
    patch('featured_products', { slugs });
  }

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Homepage content
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            Seven fixed slots. This is not a page builder — the layout does not change, only what
            goes in it.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
          <button type="button" onClick={publish} disabled={saving} style={primaryButton(saving)}>
            {saving ? 'Publishing…' : 'Save and publish'}
          </button>
          <Link href="/" target="_blank" rel="noreferrer" style={ghostButton}>
            Preview
          </Link>
        </div>
      </div>

      <div className="mc-admin-content">
        {error && (
          <p role="alert" style={{ fontSize: 14, color: 'var(--mc-status-error)', margin: 0 }}>
            {error}
          </p>
        )}
        {savedAt && !error && (
          <p role="status" style={{ fontSize: 14, color: 'var(--mc-status-success)', margin: 0 }}>
            Published. The homepage is showing this now.
          </p>
        )}

        <div className="mc-admin-order-layout mc-admin-customer-layout">
          <div className="mc-admin-order-main">
            <Panel heading="1 · Announcement bar">
              <Field
                label="Message"
                value={values.announcement.message}
                onChange={(message) => patch('announcement', { message })}
                maxLength={160}
                helper="Under about 60 characters, or it wraps on a phone."
              />
              <Check
                label="Show the announcement bar"
                description="Untick to hide it everywhere without losing the text."
                checked={values.announcement.visible}
                onChange={(visible) => patch('announcement', { visible })}
              />
              <p style={mutedSmall}>
                Write <code>{'{threshold}'}</code> where the free-delivery figure should go and it
                is filled in from Store settings, so this line cannot quote a number checkout does
                not charge. The design warns that the two must be kept in step by hand; the token
                is why they cannot drift.
              </p>
            </Panel>

            <Panel heading="2 · Hero campaign">
              <Field
                label="Heading"
                value={values.hero.title}
                onChange={(title) => patch('hero', { title })}
              />
              <Area
                label="Supporting line"
                value={values.hero.body}
                onChange={(body) => patch('hero', { body })}
                rows={3}
              />
              <Field
                label="Button label"
                value={values.hero.cta_label}
                onChange={(cta_label) => patch('hero', { cta_label })}
                maxLength={60}
              />
              <Select
                label="Button goes to"
                value={values.hero.cta_href}
                onChange={(cta_href) => patch('hero', { cta_href })}
                options={destinations}
              />
              <Well label="HERO PHOTOGRAPHY 16:9" />
              <p style={mutedSmall}>
                One campaign, not a carousel. A rotating hero halves the attention each message
                gets, and nobody waits for slide three. There is no way to upload the photograph
                yet — nothing in this shop has an image pipeline.
              </p>
            </Panel>

            <Panel heading="3 and 4 · Featured drop and T-shirts">
              <Field
                label="Section eyebrow"
                value={values.featured_drop.eyebrow}
                onChange={(eyebrow) => patch('featured_drop', { eyebrow })}
                maxLength={60}
                helper="Also used above the hero heading — the frames use the same words in both places."
              />
              <Field
                label="Section heading"
                value={values.featured_drop.title}
                onChange={(title) => patch('featured_drop', { title })}
              />
              <Select
                label="Featured drop"
                value={values.featured_drop.collection_slug ?? ''}
                onChange={(slug) => patch('featured_drop', { collection_slug: slug || null })}
                options={[
                  { value: '', label: 'None — no link under the row' },
                  ...collections.map((c) => ({ value: c.slug, label: c.name })),
                ]}
              />

              <p style={mutedSmall}>Featured T-shirts — four, in this order, under the hero.</p>
              {featured.length === 0 ? (
                <p style={mutedSmall}>
                  None chosen, so the homepage shows the four most recently published T-shirts.
                  That is the sensible default while a drop is being put together — the section is
                  never blank.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {featured.map((slug, i) => (
                    <li
                      key={slug}
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 0',
                        borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)',
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--mc-text-muted)', width: 16 }}>
                        {i + 1}
                      </span>
                      <span aria-hidden style={{ width: 30, height: 38, background: 'var(--mc-mist)', borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ flex: '1 0 0', minWidth: 140, fontSize: 14, fontWeight: 500 }}>
                        {byslug.get(slug)?.name ?? slug}
                        {byslug.get(slug) && byslug.get(slug)!.status !== 'published' && (
                          <span style={{ color: 'var(--mc-text-muted)', fontWeight: 400 }}>
                            {' '}· {byslug.get(slug)!.status}, so it will not show
                          </span>
                        )}
                        {!byslug.get(slug) && (
                          <span style={{ color: 'var(--mc-status-attention)', fontWeight: 400 }}>
                            {' '}· no longer in the catalogue
                          </span>
                        )}
                      </span>
                      <Move
                        label={`Move ${byslug.get(slug)?.name ?? slug} up`}
                        glyph="↑"
                        disabled={i === 0}
                        onClick={() => setFeatured(swap(featured, i, i - 1))}
                      />
                      <Move
                        label={`Move ${byslug.get(slug)?.name ?? slug} down`}
                        glyph="↓"
                        disabled={i === featured.length - 1}
                        onClick={() => setFeatured(swap(featured, i, i + 1))}
                      />
                      <button
                        type="button"
                        onClick={() => setFeatured(featured.filter((s) => s !== slug))}
                        style={{ ...ghostButton, border: 'none', background: 'none', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {featured.length < 4 && (
                <Select
                  label="Add a T-shirt"
                  value=""
                  onChange={(slug) => slug && setFeatured([...featured, slug])}
                  options={[
                    { value: '', label: 'Choose a T-shirt…' },
                    ...products
                      .filter((p) => !featured.includes(p.slug))
                      .map((p) => ({
                        value: p.slug,
                        label: p.status === 'published' ? p.name : `${p.name} (${p.status})`,
                      })),
                  ]}
                />
              )}
            </Panel>

            <Panel heading="5 · Brand and craft story">
              <Field
                label="Story eyebrow"
                value={values.story.eyebrow}
                onChange={(eyebrow) => patch('story', { eyebrow })}
                maxLength={60}
              />
              <Field
                label="Story heading"
                value={values.story.title}
                onChange={(title) => patch('story', { title })}
              />
              <Area
                label="Story body"
                value={values.story.body}
                onChange={(body) => patch('story', { body })}
                rows={4}
                helper="Two or three sentences. Longer than that and nobody reads it."
              />
              <div aria-hidden style={{ height: 1, background: 'var(--mc-border-default)', width: '100%' }} />
              <Field
                label="Craft eyebrow"
                value={values.craft.eyebrow}
                onChange={(eyebrow) => patch('craft', { eyebrow })}
                maxLength={60}
              />
              <Field
                label="Craft heading"
                value={values.craft.title}
                onChange={(title) => patch('craft', { title })}
              />
              <Area
                label="Craft body"
                value={values.craft.body}
                onChange={(body) => patch('craft', { body })}
                rows={4}
              />
              {values.craft.specs.map((spec, i) => (
                <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: '1 0 0', minWidth: 140 }}>
                    <Field
                      label={`Spec ${i + 1} label`}
                      value={spec.label}
                      onChange={(label) =>
                        patch('craft', {
                          specs: values.craft.specs.map((s, j) => (j === i ? { ...s, label } : s)),
                        })
                      }
                      maxLength={60}
                    />
                  </div>
                  <div style={{ flex: '1 0 0', minWidth: 140 }}>
                    <Field
                      label={`Spec ${i + 1} value`}
                      value={spec.value}
                      onChange={(value) =>
                        patch('craft', {
                          specs: values.craft.specs.map((s, j) => (j === i ? { ...s, value } : s)),
                        })
                      }
                      maxLength={120}
                    />
                  </div>
                </div>
              ))}
              <p style={mutedSmall}>
                A21 does not draw the specification rows, and they are editable anyway: they are
                the most checkable claims on the homepage — a weight, a fabric, a print method —
                and leaving them in the code would mean only a developer could correct one.
              </p>
            </Panel>

            <Panel heading="6 · Newsletter">
              <Field
                label="Heading"
                value={values.newsletter.title}
                onChange={(title) => patch('newsletter', { title })}
              />
              <Area
                label="Supporting line"
                value={values.newsletter.body}
                onChange={(body) => patch('newsletter', { body })}
                rows={3}
                helper="This is a promise. If you send more often, change the words rather than the habit."
              />
              <p style={mutedSmall}>
                This one is not only the homepage: the newsletter block is in the footer of every
                page, so it is the slot with the widest reach.
              </p>
            </Panel>

            <Panel heading="7 · Delivery and returns highlights">
              {values.reassurance.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Field
                    label={`Highlight ${i + 1}`}
                    value={item.title}
                    onChange={(title) =>
                      patch('reassurance', {
                        items: values.reassurance.items.map((x, j) => (j === i ? { ...x, title } : x)),
                      })
                    }
                    maxLength={60}
                  />
                  <Field
                    label={`Highlight ${i + 1} — supporting line`}
                    value={item.body}
                    onChange={(body) =>
                      patch('reassurance', {
                        items: values.reassurance.items.map((x, j) => (j === i ? { ...x, body } : x)),
                      })
                    }
                  />
                </div>
              ))}
              <p style={mutedSmall}>
                Three at most, each one true and checkable. A claim here that checkout contradicts
                is worse than saying nothing — so <code>{'{threshold}'}</code> works in these too,
                and the delivery line uses it.
              </p>
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            <Panel heading="Publishing">
              <Row
                label="Last published"
                value={
                  lastPublished
                    ? `${fullDateTime(lastPublished.at)}${lastPublished.by ? ` by ${lastPublished.by}` : ''}`
                    : 'Never — the homepage is showing its built-in copy'
                }
              />
              <Row
                label="Unsaved changes"
                value={changedCount === 0 ? 'None' : `${changedCount} field${changedCount === 1 ? '' : 's'}`}
              />
              <p style={mutedSmall}>
                Changes go live the moment you publish. There is no draft copy of the homepage in
                the MVP, so preview first if you are unsure — Preview opens the real page, which
                is still showing what is saved.
              </p>
              <button
                type="button"
                onClick={publish}
                disabled={saving}
                style={{ ...primaryButton(saving), width: '100%' }}
              >
                {saving ? 'Publishing…' : 'Save and publish'}
              </button>
            </Panel>

            <Panel heading="What you cannot change here" tint>
              <p style={mutedSmall}>
                Section order, the number of featured products and the page layout are fixed. That
                is deliberate — it keeps the homepage consistent and stops it drifting into a page
                builder nobody maintains.
              </p>
              <p style={mutedSmall}>
                Two more that are fixed for a different reason: the Fit and size guidance block is
                not a slot (§9.7 does not list it), and no photograph can be changed from here
                because nothing in this shop can upload one yet.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function swap(list: string[], from: number, to: number): string[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

/** How many leaf fields differ. Arrays count as one if their contents
 * differ at all — "3 fields" should mean three things a person changed. */
function countChanges(a: unknown, b: unknown): number {
  if (Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b) ? 0 : 1;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let n = 0;
    for (const k of keys) {
      n += countChanges((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
    }
    return n;
  }
  return a === b ? 0 : 1;
}

function fullDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

/* ----------------------------------------------------------- primitives */

function Panel({ heading, tint, children }: { heading: string; tint?: boolean; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: tint ? 'var(--mc-bg-page)' : 'var(--mc-bg-surface)',
        border: '1px solid var(--mc-border-default)',
        borderRadius: 'var(--mc-radius-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
  helper?: string;
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

function Area({
  label,
  value,
  onChange,
  rows,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  helper?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        maxLength={1200}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical' }}
      />
      {helper && <span style={mutedSmall}>{helper}</span>}
    </label>
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
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minHeight: 44, padding: '11px 0' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 22, height: 22, flexShrink: 0, accentColor: 'var(--mc-ink)' }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 15, lineHeight: '22px' }}>{label}</span>
        <span style={mutedSmall}>{description}</span>
      </span>
    </label>
  );
}

function Well({ label }: { label: string }) {
  return (
    <div
      aria-hidden
      style={{
        height: 150,
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
      {label}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 12, color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function Move({
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

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
};

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

const mutedSmall: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--mc-text-muted)',
  margin: 0,
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
  whiteSpace: 'nowrap',
});

const ghostButton: React.CSSProperties = { ...buttonBase, color: 'var(--mc-text-primary)' };
