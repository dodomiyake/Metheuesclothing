'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/public';
import { StatusBadge } from '@/components/admin/status-badge';
import { SHOP_BUCKET, imageUrl, ALLOWED_TYPES, MAX_BYTES } from '@/lib/images';

export type ManagedImage = {
  id: string;
  storage_path: string;
  alt_text: string;
  colour: string | null;
  position: number;
  created_at: string;
};

/**
 * A05 Product image manager — Figma 134:1352 (Desktop pulled) /
 * 134:1169 (Tablet). No Mobile frame; A05 is on
 * `admin_breakpoint_decision`'s no_mobile list, so the page wraps this in
 * WideOnly.
 *
 * THE LAST OF THE TWENTY-THREE ADMIN SCREENS, and the one that had no
 * pipeline behind it: `product_images` has existed since migration 001
 * with zero rows, because until 019 there was no bucket, no upload route
 * and no reader anywhere in the codebase.
 *
 * THE FILE NEVER TOUCHES THIS APP'S SERVERS. /api/admin/images/sign
 * decides whether the caller may upload and where, and hands back a
 * one-shot token; the browser sends the bytes straight to Supabase. A
 * route that accepted the file would hit the platform's body limit on a
 * large photograph, bill the bandwidth twice, and put every upload on the
 * clock of a serverless function.
 *
 * ALT TEXT IS ASKED FOR AT UPLOAD TIME, not afterwards, because
 * product_images.alt_text is NOT NULL with a non-empty check
 * (001_schema.sql:107) — §13 requires text alternatives and whoever wrote
 * that schema decided an undescribed image should not be representable.
 * So the row cannot be created without it and the form cannot pretend
 * otherwise. The design's own helper says what it is FOR rather than
 * demanding a value, and that wording is kept.
 *
 * THREE DEPARTURES:
 *
 *  - The file metadata line narrows. The design shows "4:5 · 2000 × 2500 ·
 *    412 KB · uploaded 2 September by Dami"; `product_images` stores a
 *    path, alt text, a colour, a position and created_at — no dimensions,
 *    no byte size, no uploader. It says the date, which is the part that
 *    is true.
 *  - The dropzone's "at least 1600px wide" is CHECKED rather than
 *    printed. The browser can read a file's real dimensions before
 *    uploading, so a small image gets a warning naming its actual width
 *    instead of a rule nobody enforces. It warns rather than blocks: a
 *    smaller photograph is worse, not invalid.
 *  - "Every colour needs at least a front image" is computed from the
 *    product's real variant colours against what has been assigned, so
 *    the guidance card names the colours actually missing instead of
 *    repeating a maxim.
 */
export function ImageManager({
  productId,
  productName,
  initial,
  colours,
}: {
  productId: string;
  productName: string;
  initial: ManagedImage[];
  /** The product's real variant colours, for the assignment select. */
  colours: string[];
}) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial[0]?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: File; width: number; height: number } | null>(null);
  const [pendingAlt, setPendingAlt] = useState('');
  const [pendingColour, setPendingColour] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const selected = images.find((i) => i.id === selectedId) ?? null;
  const missingAlt = images.filter((i) => !i.alt_text.trim()).length;
  const assigned = new Set(images.map((i) => i.colour).filter(Boolean) as string[]);
  const coloursWithout = colours.filter((c) => !assigned.has(c));

  /** Read the real pixel dimensions before anything is uploaded. */
  async function measure(file: File): Promise<{ width: number; height: number }> {
    try {
      const bitmap = await createImageBitmap(file);
      const out = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return out;
    } catch {
      return { width: 0, height: 0 };
    }
  }

  async function choose(file: File | undefined) {
    setError(null);
    setNotice(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('That file type is not supported. Use JPEG, PNG, WebP or AVIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images must be under 10 MB.`);
      return;
    }
    const size = await measure(file);
    setPending({ file, ...size });
    setPendingAlt('');
    setPendingColour('');
  }

  /** Signs, uploads straight to storage, then records the row. */
  async function uploadPending() {
    if (!pending) return;
    if (!pendingAlt.trim()) {
      setError('Describe the image before saving it — it cannot be stored without a description.');
      return;
    }
    setBusy('upload');
    setError(null);
    try {
      const signRes = await fetch('/api/admin/images/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'product',
          owner_id: productId,
          content_type: pending.file.type,
          size: pending.file.size,
        }),
      });
      const signed = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(signed.error ?? 'Could not start the upload.');
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(SHOP_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, pending.file);
      if (uploadError) {
        setError(`The file did not upload: ${uploadError.message}`);
        return;
      }

      const recordRes = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          storage_path: signed.path,
          alt_text: pendingAlt.trim(),
          colour: pendingColour || null,
        }),
      });
      const recorded = await recordRes.json().catch(() => ({}));
      if (!recordRes.ok) {
        // The file is in the bucket and nothing points at it. Said plainly
        // rather than swallowed — it is an orphan somebody may want to
        // know about.
        setError(
          `${recorded.error ?? 'Could not save the image.'} The file uploaded but was not attached.`,
        );
        return;
      }

      setPending(null);
      setNotice('Uploaded.');
      router.refresh();
    } catch {
      setError('Could not reach the server. Nothing was uploaded.');
    } finally {
      setBusy(null);
    }
  }

  async function replaceSelected(file: File | undefined) {
    if (!selected || !file) return;
    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_BYTES) {
      setError('Use a JPEG, PNG, WebP or AVIF under 10 MB.');
      return;
    }
    setBusy('replace');
    setError(null);
    try {
      const signRes = await fetch('/api/admin/images/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scope: 'product',
          owner_id: productId,
          content_type: file.type,
          size: file.size,
        }),
      });
      const signed = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(signed.error ?? 'Could not start the upload.');
        return;
      }
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(SHOP_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (uploadError) {
        setError(`The file did not upload: ${uploadError.message}`);
        return;
      }
      // Swaps the path, keeps the position — so replacing the primary
      // image does not quietly demote it to the end of the gallery.
      const res = await fetch(`/api/admin/images/${selected.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ storage_path: signed.path }),
      });
      if (!res.ok) {
        setError('The new file uploaded but the image was not swapped.');
        return;
      }
      setNotice('Replaced.');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function saveSelected(patch: { alt_text?: string; colour?: string | null }) {
    if (!selected) return;
    setBusy('save');
    setError(null);
    try {
      const res = await fetch(`/api/admin/images/${selected.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not save the image.');
        return;
      }
      setNotice('Saved.');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    setBusy('remove');
    setError(null);
    try {
      const res = await fetch(`/api/admin/images/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setError('Could not remove the image.');
        return;
      }
      setImages(images.filter((i) => i.id !== selected.id));
      setSelectedId(null);
      setNotice('Removed.');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function move(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    const previous = images;
    setImages(next);
    setBusy('order');
    setError(null);
    try {
      const res = await fetch('/api/admin/images', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ product_id: productId, image_ids: next.map((i) => i.id) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setImages(previous);
        setError(body.error ?? 'Could not reorder the images.');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mc-admin-page">
      <div className="mc-admin-topbar">
        <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <h1 style={{ fontFamily: 'var(--mc-font-body)', fontSize: 20, fontWeight: 600, margin: 0 }}>
            Images
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>
            <Link href="/admin/products" style={{ color: 'inherit' }}>
              T-shirts
            </Link>{' '}
            / {productName} / Images · {images.length} image{images.length === 1 ? '' : 's'}
            {missingAlt > 0 && `, ${missingAlt} without alt text`}
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            style={primaryButton(busy !== null)}
          >
            Upload image
          </button>
          <Link href={`/admin/products/${productId}`} style={ghostButton}>
            Back to product
          </Link>
          {/* A second way out, for the phone: the product editor is still
              WideOnly, so below 768 "Back to product" lands on the gate
              rather than a screen you can use. The list is a phone screen
              and is where the link in came from. */}
          <Link href="/admin/products" style={ghostButton}>
            All T-shirts
          </Link>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInput}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        hidden
        onChange={(e) => {
          void replaceSelected(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="mc-admin-content">
        {error && (
          <p role="alert" style={{ fontSize: 14, color: 'var(--mc-status-error)', margin: 0 }}>
            {error}
          </p>
        )}
        {notice && !error && (
          <p role="status" style={{ fontSize: 14, color: 'var(--mc-status-success)', margin: 0 }}>
            {notice}
          </p>
        )}

        {/* The upload form appears once a file is chosen, because the row
            cannot exist without alt text and asking afterwards would mean
            an image that is already live and undescribed. */}
        {pending && (
          <Panel heading="Describe this image before it is uploaded">
            <p style={mutedSmall}>
              {pending.file.name} · {(pending.file.size / 1024).toFixed(0)} KB
              {pending.width > 0 && ` · ${pending.width} × ${pending.height}`}
            </p>
            {pending.width > 0 && pending.width < 1600 && (
              <p style={{ ...mutedSmall, color: 'var(--mc-status-attention)' }}>
                This is {pending.width}px wide. The design asks for at least 1600 so it stays sharp
                on a large screen — it will upload, it will just be softer than the others.
              </p>
            )}
            {pending.width > 0 && Math.abs(pending.width / pending.height - 0.8) > 0.02 && (
              <p style={{ ...mutedSmall, color: 'var(--mc-status-attention)' }}>
                This is not 4:5. Cards crop to 4:5, so part of it will be cut off.
              </p>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>Alt text</span>
              <textarea
                value={pendingAlt}
                rows={3}
                maxLength={500}
                onChange={(e) => setPendingAlt(e.target.value)}
                style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical' }}
              />
              <span style={mutedSmall}>
                Describe what is in the picture for someone who cannot see it. Not the product name
                again.
              </span>
            </label>
            {colours.length > 0 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={labelStyle}>Shows this colour</span>
                <select
                  value={pendingColour}
                  onChange={(e) => setPendingColour(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Not colour-specific</option>
                  {colours.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                type="button"
                onClick={uploadPending}
                disabled={busy !== null}
                style={primaryButton(busy !== null)}
              >
                {busy === 'upload' ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" onClick={() => setPending(null)} style={{ ...ghostButton, border: 'none', background: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </Panel>
        )}

        <div className="mc-admin-order-layout mc-admin-customer-layout">
          <div className="mc-admin-order-main">
            <Panel heading="Order and assignment">
              <p style={mutedSmall}>
                The first image is what appears on listing cards and in search results. Use the
                arrows to reorder — they are the same move a drag would make, and they work from a
                keyboard.
              </p>
              {images.length === 0 ? (
                <p style={mutedSmall}>
                  No images yet. This T-shirt shows a placeholder well on every card, in search
                  results and on its own page until the first one lands here.
                </p>
              ) : (
                <div className="mc-image-grid">
                  {images.map((image, i) => {
                    const url = imageUrl(image.storage_path);
                    const isSelected = image.id === selectedId;
                    return (
                      <div
                        key={image.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          padding: 6,
                          borderRadius: 3,
                          border: isSelected
                            ? '2px solid var(--mc-border-strong)'
                            : '2px solid transparent',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(image.id)}
                          aria-label={`Select image ${i + 1}`}
                          aria-pressed={isSelected}
                          style={{
                            position: 'relative',
                            height: 168,
                            padding: 0,
                            border: 'none',
                            borderRadius: 2,
                            background: 'var(--mc-mist)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                          }}
                        >
                          {url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={url}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                          )}
                          <span
                            style={{
                              position: 'absolute',
                              top: 6,
                              left: 6,
                              padding: '2px 6px',
                              background: 'var(--mc-bg-surface)',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {i + 1}
                          </span>
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-word' }}>
                          {image.colour ? `${image.colour}` : 'All colours'}
                        </span>
                        {i === 0 && <StatusBadge label="Primary" tone="info" />}
                        <span style={{ display: 'flex', gap: 4 }}>
                          <Move
                            label={`Move image ${i + 1} earlier`}
                            glyph="←"
                            disabled={i === 0 || busy !== null}
                            onClick={() => move(i, i - 1)}
                          />
                          <Move
                            label={`Move image ${i + 1} later`}
                            glyph="→"
                            disabled={i === images.length - 1 || busy !== null}
                            onClick={() => move(i, i + 1)}
                          />
                        </span>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    style={{
                      height: 236,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '0 12px',
                      borderRadius: 3,
                      border: '1px dashed var(--mc-border-strong)',
                      background: 'none',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Add an image</span>
                    <span style={{ fontSize: 11, color: 'var(--mc-text-muted)' }}>
                      JPEG, PNG, WebP or AVIF · 4:5 · at least 1600px wide
                    </span>
                  </button>
                </div>
              )}
            </Panel>
          </div>

          <div className="mc-admin-order-side">
            {selected ? (
              <SelectedPanel
                key={selected.id}
                image={selected}
                index={images.findIndex((i) => i.id === selected.id)}
                colours={colours}
                busy={busy}
                onSave={saveSelected}
                onReplace={() => replaceInput.current?.click()}
                onRemove={removeSelected}
              />
            ) : (
              <Panel heading="Selected">
                <p style={mutedSmall}>Choose an image to edit its description and colour.</p>
              </Panel>
            )}

            <Panel heading="What makes a good set" tint>
              {missingAlt > 0 ? (
                <Guidance tone="attention" label="Fix">
                  {missingAlt} image{missingAlt === 1 ? ' has' : 's have'} no description. The
                  database will not store one without it, so this should not be possible — if you
                  see it, something wrote a row around this screen.
                </Guidance>
              ) : images.length > 0 ? (
                <Guidance tone="success" label="Good">
                  Every image is described.
                </Guidance>
              ) : null}

              {coloursWithout.length > 0 && (
                <Guidance tone="neutral" label="Note">
                  No image is assigned to {coloursWithout.join(', ')}. A customer picking{' '}
                  {coloursWithout.length === 1 ? 'that colour' : 'one of those'} sees the
                  unassigned images instead.
                </Guidance>
              )}

              <Guidance tone="neutral" label="Note">
                Keep every image at 4:5 so cards never crop unevenly. The upload form checks the
                real dimensions and says so before anything is sent.
              </Guidance>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectedPanel({
  image,
  index,
  colours,
  busy,
  onSave,
  onReplace,
  onRemove,
}: {
  image: ManagedImage;
  index: number;
  colours: string[];
  busy: string | null;
  onSave: (patch: { alt_text?: string; colour?: string | null }) => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [alt, setAlt] = useState(image.alt_text);
  const [colour, setColour] = useState(image.colour ?? '');
  const url = imageUrl(image.storage_path);
  const dirty = alt !== image.alt_text || colour !== (image.colour ?? '');

  return (
    <Panel heading={`Selected — image ${index + 1}`}>
      {index === 0 && <StatusBadge label="Primary" tone="info" />}
      <div style={{ width: '100%', aspectRatio: '4 / 5', background: 'var(--mc-mist)', borderRadius: 2, overflow: 'hidden' }}>
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={image.alt_text} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={labelStyle}>Alt text</span>
        <textarea
          value={alt}
          rows={4}
          maxLength={500}
          onChange={(e) => setAlt(e.target.value)}
          style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical' }}
        />
        <span style={mutedSmall}>
          Describe what is in the picture for someone who cannot see it. Not the product name
          again.
        </span>
      </label>

      {colours.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Shows this colour</span>
          <select value={colour} onChange={(e) => setColour(e.target.value)} style={inputStyle}>
            <option value="">Not colour-specific</option>
            {colours.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span style={mutedSmall}>
            Assigning a colour swaps the gallery when a customer picks that colour.
          </span>
        </label>
      )}

      {/* The design's line reads "4:5 · 2000 × 2500 · 412 KB · uploaded 2
          September by Dami". product_images stores none of the first
          three and no uploader — see the note at the top of this file. */}
      <p style={mutedSmall}>Uploaded {new Date(image.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px' }}>
        <button
          type="button"
          disabled={!dirty || !alt.trim() || busy !== null}
          onClick={() => onSave({ alt_text: alt.trim(), colour: colour || null })}
          style={{
            ...primaryButton(busy !== null),
            opacity: dirty && alt.trim() && busy === null ? 1 : 0.5,
          }}
        >
          Save
        </button>
        <button type="button" onClick={onReplace} disabled={busy !== null} style={secondaryButton}>
          {busy === 'replace' ? 'Replacing…' : 'Replace'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy !== null}
          style={{ ...ghostButton, border: 'none', background: 'none', cursor: 'pointer' }}
        >
          Remove
        </button>
      </div>
      {!alt.trim() && (
        <p style={{ ...mutedSmall, color: 'var(--mc-status-attention)' }}>
          Save is unavailable until the image is described — the column will not accept a blank.
        </p>
      )}
    </Panel>
  );
}

function Guidance({
  tone,
  label,
  children,
}: {
  tone: 'attention' | 'neutral' | 'success';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <StatusBadge label={label} tone={tone} />
      <p style={{ flex: '1 0 0', minWidth: 0, fontSize: 13, lineHeight: '20px', margin: 0 }}>
        {children}
      </p>
    </div>
  );
}

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
  whiteSpace: 'nowrap',
});

const secondaryButton: React.CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--mc-border-strong)',
  background: 'none',
  color: 'var(--mc-text-primary)',
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = { ...buttonBase, color: 'var(--mc-text-primary)' };
