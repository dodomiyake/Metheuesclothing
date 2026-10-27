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

/** Mirrors `STOCK_PROVIDER_INFO`, which is derived from the providers
 *  themselves. Passed in rather than imported, because `lib/stock-photos`
 *  is `server-only` — it holds the API keys' only readers. */
export type ProviderInfo = {
  id: string;
  label: string;
  note: string;
  homeUrl: string;
};

type Hit = {
  id: string;
  preview: string;
  preview_width: number;
  preview_height: number;
  width: number;
  height: number;
  context: string[];
  page_url: string;
  credit: string;
  credit_url: string | null;
};

/**
 * "Find a stock photograph" — A05's second way to get an image in.
 *
 * THIS IS NOT IN THE DESIGN FILE. A05 draws an upload well and nothing
 * else; stock search is an addition the owner asked for, recorded in
 * docs/design-questions.md alongside the decision that stock photographs
 * may be used as ordinary product images.
 *
 * TWO PROVIDERS NOW, Pexels and Pixabay, and the panel is provider-blind:
 * it renders whatever `lib/stock-photos` registers and sends the id back
 * with every request. Pexels is first because its apparel library is the
 * better one. Unsplash is deliberately absent — `lib/stock-photos/pexels.ts`
 * has the reasoning, and the short version is that its terms require
 * hotlinking and a photographer credit on every display, which would mean
 * either breaking them or putting credits on the shop listing.
 *
 * THE THUMBNAILS ARE THE ONE PLACE A PROVIDER URL APPEARS. Pixabay's terms
 * allow it "for temporarily displaying search results" and forbid permanent
 * hotlinking, which is why importing downloads the file into this shop's own
 * bucket instead of storing a link. Nothing on the storefront ever points at
 * either provider.
 *
 * THE LINK TO EACH PROVIDER IS HERE BECAUSE PEXELS ASKS FOR ONE. Its API
 * guidelines want a prominent link from the app making the requests, and
 * this panel is that app; the photographer is credited on the selected tile
 * for the same reason. Pixabay asks for neither and gets both, because
 * somebody choosing a photograph should be able to reach the terms they are
 * choosing under.
 *
 * THE DESCRIPTION IS NOT PREFILLED, and that is the whole point of the
 * panel's shape. Pixabay hands back keywords — "tshirt, fashion, model" —
 * and Pexels hands back its own caption, "Man in White Crew Neck T-shirt".
 * Pexels' is the more dangerous of the two precisely because it reads like
 * prose: it would sail through the NOT NULL check on `alt_text` while
 * describing the stock photograph rather than the garment this shop sells,
 * and saying nothing about the stripe, the placket or the cut. That is how
 * this shop ended up with lorem ipsum live on its only photograph. Both are
 * shown as context beside the field. A human writes the sentence.
 */
export function StockSearch({
  productId,
  colours,
  providers,
  onImported,
}: {
  productId: string;
  colours: string[];
  providers: ProviderInfo[];
  onImported: () => void;
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState(providers[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [total, setTotal] = useState(0);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [alt, setAlt] = useState('');
  const [colour, setColour] = useState('');
  const [busy, setBusy] = useState<'search' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === providerId) ?? providers[0];

  function switchProvider(id: string) {
    setProviderId(id);
    // Results belong to the provider that returned them. Keeping them on
    // screen under a new provider's name would be the panel claiming
    // Pexels found something Pixabay did.
    setHits(null);
    setChosen(null);
    setError(null);
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || !provider) return;
    setBusy('search');
    setError(null);
    setChosen(null);
    try {
      const res = await fetch(
        `/api/admin/images/stock?provider=${encodeURIComponent(provider.id)}&q=${encodeURIComponent(query.trim())}`,
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A rate limit, a missing key and an empty result look identical
        // in a grid, so the reason is said out loud rather than rendered
        // as "nothing found" — the same call every catalogue page makes
        // about a failed query versus an empty shop.
        setError(body.error ?? `Could not search ${provider.label}.`);
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
    if (!chosen || !provider) return;
    if (!alt.trim()) {
      setError('Describe the photograph before importing it.');
      return;
    }
    setBusy('import');
    setError(null);
    try {
      const res = await fetch('/api/admin/images/stock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          provider: provider.id,
          photo_id: chosen.id,
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

  if (!provider) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {providers.length > 1 && (
        <div>
          <span style={labelStyle} id="stock-provider-label">
            Search which library
          </span>
          <div
            role="group"
            aria-labelledby="stock-provider-label"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}
          >
            {providers.map((p) => {
              const active = p.id === provider.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => switchProvider(p.id)}
                  aria-pressed={active}
                  style={{
                    minHeight: 44,
                    padding: '10px 18px',
                    cursor: 'pointer',
                    background: active ? 'var(--mc-text-primary)' : 'var(--mc-bg-surface)',
                    color: active ? 'var(--mc-bg-surface)' : 'var(--mc-text-primary)',
                    // Two signals, never colour alone (rule 8): the active
                    // chip inverts AND carries aria-pressed, which is what
                    // a screen reader reads rather than the fill.
                    border: '1px solid var(--mc-border-control)',
                    borderRadius: 'var(--mc-radius-sm)',
                    fontFamily: 'var(--mc-font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p style={mutedSmall}>
        {provider.note}{' '}
        <a href={provider.homeUrl} target="_blank" rel="noreferrer noopener">
          {provider.label}
        </a>
        .
      </p>

      <form onSubmit={search} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <label htmlFor="stock-q" style={{ ...labelStyle, width: '100%' }}>
          Search for
        </label>
        <input
          id="stock-q"
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
          Nothing matched &ldquo;{query}&rdquo;. {provider.label} found no photographs for that
          word — try the other library before giving up on it.
        </p>
      )}

      {hits && hits.length > 0 && (
        <>
          <p style={mutedSmall}>
            {total.toLocaleString('en-GB')} photograph{total === 1 ? '' : 's'} found on{' '}
            {provider.label}. Pick one to describe and import.
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
              const described = hit.context.join(', ');
              return (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(picked ? null : hit);
                      setError(null);
                    }}
                    aria-pressed={picked}
                    title={described}
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
                      alt={`${provider.label} result: ${described || 'untitled'}`}
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
            {provider.label} describes this photograph as:{' '}
            {chosen.context.join(', ') || 'nothing at all'}. By{' '}
            {chosen.credit_url ? (
              <a href={chosen.credit_url} target="_blank" rel="noreferrer noopener">
                {chosen.credit}
              </a>
            ) : (
              chosen.credit
            )}
            , on{' '}
            <a href={chosen.page_url} target="_blank" rel="noreferrer noopener">
              {provider.label}
            </a>
            .
          </p>

          <div>
            <label htmlFor="stock-alt" style={labelStyle}>
              Describe it
            </label>
            <textarea
              id="stock-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              rows={3}
              maxLength={500}
              aria-describedby="stock-alt-help"
              style={{ ...inputStyle, lineHeight: '23px', resize: 'vertical', marginTop: 6 }}
            />
            <p id="stock-alt-help" style={{ ...mutedSmall, marginTop: 6 }}>
              Write what somebody who cannot see it would need to know — the garment, its colour,
              how it is worn. The line above describes the stock photograph rather than what you
              are selling, so it is not filled in for you.
            </p>
          </div>

          {colours.length > 0 && (
            <div>
              <label htmlFor="stock-colour" style={labelStyle}>
                Shows which colour
              </label>
              <select
                id="stock-colour"
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
