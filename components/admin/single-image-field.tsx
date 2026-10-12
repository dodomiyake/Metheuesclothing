'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/public';
import { ALLOWED_TYPES, MAX_BYTES, SHOP_BUCKET, imageUrl } from '@/lib/images';

/**
 * One image, held by a form rather than by a table of its own.
 *
 * A05 manages a LIST (positions, colour assignment, a primary), which is
 * why it is a page. A collection hero and the homepage campaign are single
 * fields on an editor that already exists, so they are a field — and the
 * upload is deliberately separated from the save: this uploads the file and
 * hands the parent a path, and the parent's own Save is what makes the page
 * point at it. The alternative (uploading and persisting in one go) would
 * change the live homepage the instant a file was chosen, with no way to
 * pick a different one first.
 *
 * ALT TEXT SITS HERE, not on a later screen, because the moment someone is
 * looking at the photograph is the only moment they can describe it. Empty
 * is allowed for these two and not for a product image: a hero is beside
 * its own words in text, so decoration is a legitimate answer, whereas
 * product_images.alt_text is NOT NULL in the database (§13).
 */
export function SingleImageField({
  label,
  help,
  scope,
  ownerId,
  path,
  alt,
  onChange,
}: {
  label: string;
  help?: string;
  scope: 'collection' | 'homepage';
  ownerId?: string;
  path: string | null;
  alt: string;
  onChange: (next: { path: string | null; alt: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const url = imageUrl(path);

  async function choose(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('That file type is not supported. Use JPEG, PNG, WebP or AVIF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Images must be under 10 MB.`);
      return;
    }
    setBusy(true);
    try {
      const signRes = await fetch('/api/admin/images/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, owner_id: ownerId, content_type: file.type, size: file.size }),
      });
      const signed = await signRes.json().catch(() => ({}));
      if (!signRes.ok) {
        setError(signed.error ?? 'Could not start the upload.');
        return;
      }
      // Straight to storage, not through this app — see the sign route.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(SHOP_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (uploadError) {
        setError(`The file did not upload: ${uploadError.message}`);
        return;
      }
      onChange({ path: signed.path as string, alt });
    } catch {
      setError('Could not reach the server. Nothing was uploaded.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div
          style={{
            width: 160,
            height: 120,
            background: 'var(--mc-mist)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 'var(--mc-radius-sm)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 11, color: 'var(--mc-text-muted)' }}>No image</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            ref={input}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={(e) => void choose(e.target.files?.[0])}
            disabled={busy}
            style={{ fontFamily: 'var(--mc-font-body)', fontSize: 14 }}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...labelStyle, fontSize: 10 }}>Describe the image</span>
            <input
              type="text"
              value={alt}
              onChange={(e) => onChange({ path, alt: e.target.value })}
              placeholder="Leave empty to treat it as decoration"
              style={inputStyle}
            />
          </label>
          {path && (
            <button
              type="button"
              onClick={() => onChange({ path: null, alt })}
              style={{
                alignSelf: 'flex-start',
                minHeight: 44,
                padding: '0 16px',
                background: 'none',
                border: '1px solid var(--mc-border-control)',
                borderRadius: 'var(--mc-radius-sm)',
                fontFamily: 'var(--mc-font-body)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Remove the image
            </button>
          )}
          {/* The file stays in the bucket when it is removed here. Deleting
              it would strand every earlier version of this page that still
              references it, and an unreferenced file costs storage; a
              broken hero costs a customer. */}
          {busy && <p style={{ fontSize: 13, color: 'var(--mc-text-muted)', margin: 0 }}>Uploading…</p>}
          {error && (
            <p role="alert" style={{ fontSize: 13, color: 'var(--mc-status-error)', margin: 0 }}>
              {error}
            </p>
          )}
          {help && <p style={{ fontSize: 12, color: 'var(--mc-text-muted)', margin: 0 }}>{help}</p>}
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '1.1px',
  textTransform: 'uppercase',
  color: 'var(--mc-text-muted)',
};

const inputStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '0 12px',
  border: '1px solid var(--mc-border-control)',
  borderRadius: 'var(--mc-radius-sm)',
  background: 'var(--mc-bg-surface)',
  fontFamily: 'var(--mc-font-body)',
  fontSize: 15,
  color: 'var(--mc-text-primary)',
};
