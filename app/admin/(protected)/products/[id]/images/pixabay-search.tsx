'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  labelStyle,
  inputStyle,
  mutedSmall,
  primaryButton,
  secondaryButton,
  ghostButton,
} from './image-styles';

type Hit = {
  id: number;
  preview: string;
  preview_width: number;
  preview_height: number;
  width: number;
  height: number;
  tags: string[];
  page_url: string;
  user: string;
};

/**
 * "Find a stock photograph" — A05's second way to get an image in.
 *
 * THIS IS NOT IN THE DESIGN FILE. A05 draws an upload well and nothing
 * else; stock search is an addition the owner asked for, recorded in
 * docs/design-questions.md alongside the decision that stock photographs
 * may be used as ordinary product images.
 *
 * THE THUMBNAILS ARE THE ONE PLACE PIXABAY URLs APPEAR. Their terms
 * allow it "for temporarily displaying search results" and forbid
 * permanent hotlinking, which is why importing downloads the file into
 * this shop's own bucket instead of storing a link. Nothing on the
 * storefront ever points at Pixabay.
 *
 * THE DESCRIPTION IS NOT PREFILLED, and that is the whole point of the
 * panel's shape. Pixabay hands back `tags` — "tshirt, fashion, model" —
 * which are keywords for finding a picture, not a description of one.
 * Writing them into `alt_text` would produce something that passes the
 * NOT NULL check and tells a screen reader nothing, which is precisely
 * how this shop ended up with lorem ipsum live on its only photograph.
 * The tags are shown as context beside the field. A human writes the
 * sentence.
 */
export function PixabaySearch({
  productId,
  colours,
  onImported,
}: {
  productId: string;
  colours: string[];
  onImported: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [alt, setAlt] = useState('');
  const [colour, setColour] = useState('');
  const [busy, setBusy] = useState<'search' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy('search');
    setError(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/admin/images/pixabay?q=${encodeURIComponent(query.trim())}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A rate limit and an empty result look identical in a grid, so
        // the reason is said out loud rather than rendered as "nothing
        // found" — the same call every catalogue page makes about a
        // failed query versus an empty shop.
        setError(body.error ?? 'Could not search Pixabay.');
        setHits(null);
        return;
      }
      setHits(body.hits ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setError('Could not reach the server.');
      setHits(null);
    } finally {
      setBusy(null);
    }
  }

  async function importChosen() {
    if (!chosen) return;
    if (!alt.trim()) {
      setError('Describe the photograph before importing it.');
      return;
    }
    setBusy('import');
    setError(null);
    try {
      const res = await fetch('/api/admin/images/pixabay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          pixabay_id: chosen.id,
          alt_text: alt.trim(),
          colour: colour || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? 'Could not import that photograph.');
        return;
      }
      setChosen(null);
      setAlt('');
      setColour('');
      onImported();
      router.refresh();
    } catch {
      setError('Could not reach the server. Nothing was imported.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={mutedSmall}>
        Searches Pixabay, whose licence allows commercial use without attribution. The file is
        downloaded into this shop&rsquo;s own storage — nothing on the site ever links to Pixabay.
      </p>

      <form onSubmit={search} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label htmlFor="pixabay-q" style={{ ...labelStyle, width: '100%' }}>
          Search for
        </label>
        <input
          id="pixabay-q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="white t-shirt"
          maxLength={100}
          style={{ ...inputStyle, flex: '1 1 220px', width: 'auto' }}
        />
        <button type="submit" disabled={busy !== null || !query.trim()} style={primaryButton(busy !== null)}>
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <p role="alert" style={{ ...mutedSmall, color: 'var(--mc-text-danger)' }}>
          {error}
        </p>
      )}

      {hits && hits.length === 0 && (
        <p style={mutedSmall}>
          Nothing matched &ldquo;{query}&rdquo;. Pixabay found no photographs for that word.
        </p>
      )}

      {hits && hits.length > 0 && (
        <>
          <p style={mutedSmall}>
            {total.toLocaleString('en-GB')} photograph{total === 1 ? '' : 's'} found. Pick one to
            describe and import.
          </p>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))',
              gap: 10,
            }}
          >
            {hits.map((hit) => {
              const picked = chosen?.id === hit.id;
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(picked ? null : hit);
                      setError(null);
                    }}
                    aria-pressed={picked}
                    title={hit.tags.join(', ')}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 0,
                      cursor: 'pointer',
                      background: 'var(--mc-bg-surface)',
                      // Two signals, never colour alone (rule 8): the
                      // border thickens AND the chosen tile is the only
                      // one carrying the word "Selected" below.
                      border: picked
                        ? '3px solid var(--mc-border-strong)'
                        : '1px solid var(--mc-border-control)',
                      borderRadius: 'var(--mc-radius-sm)',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hit.preview}
                      alt={`Pixabay result: ${hit.tags.join(', ')}`}
                      width={hit.preview_width}
                      height={hit.preview_height}
                      style={{ display: 'block', width: '100%', height: 120, objectFit: 'cover' }}
                    />
                    <span
                      style={{
                        display: 'block',
                        padding: '6px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.6px',
                        textTransform: 'uppercase',
                        color: 'var(--mc-text-muted)',
                      }}
                    >
                      {picked ? 'Selected' : `${hit.width}×${hit.height}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {chosen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 14,
            background: 'var(--mc-bg-page)',
            border: '1px solid var(--mc-border-default)',
            borderRadius: 'var(--mc-radius-sm)',
          }}
        >
          <p style={mutedSmall}>
            Keywords on this photograph: {chosen.tags.join(', ') || 'none'}. By {chosen.user} on{' '}
            <a href={chosen.page_url} target="_blank" rel="noreferrer noopener">
              Pixabay
            </a>
            .
          </p>

          <div>
            <label htmlFor="pixabay-alt" style={labelStyle}>
              Describe it
            </label>
            <textarea
              id="pixabay-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              rows={3}
              maxLength={500}
              aria-describedby="pixabay-alt-help"
              style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical', marginTop: 6 }}
            />
            <p id="pixabay-alt-help" style={{ ...mutedSmall, marginTop: 6 }}>
              Write what somebody who cannot see it would need to know — the garment, its colour,
              how it is worn. The keywords above are for finding the picture, not for describing
              it, so they are not filled in for you.
            </p>
          </div>

          {colours.length > 0 && (
            <div>
              <label htmlFor="pixabay-colour" style={labelStyle}>
                Shows which colour
              </label>
              <select
                id="pixabay-colour"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                style={{ ...inputStyle, marginTop: 6 }}
              >
                <option value="">Every colour — a detail shot</option>
                {colours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={importChosen}
              disabled={busy !== null || !alt.trim()}
              style={primaryButton(busy !== null)}
            >
              {busy === 'import' ? 'Importing…' : 'Import this photograph'}
            </button>
            <button type="button" onClick={() => setChosen(null)} style={secondaryButton}>
              Pick another
            </button>
          </div>
          {!alt.trim() && (
            <p style={mutedSmall}>
              Import is unavailable until the photograph has a description.
            </p>
          )}
        </div>
      )}

      {hits && (
        <button
          type="button"
          onClick={() => {
            setHits(null);
            setChosen(null);
            setError(null);
          }}
          style={ghostButton}
        >
          Clear results
        </button>
      )}
    </div>
  );
}
