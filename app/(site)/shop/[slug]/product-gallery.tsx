'use client';

import { useState } from 'react';
import type { ProductImage } from '@/lib/shop/product-images';

// Verified against each pulled screen, not assumed: Desktop (60:878) has a
// Front thumb because the rail sits beside the main image; Tablet (58:783)
// doesn't, because its thumbnails sit below the same image that already
// shows the front view. Mobile (54:703) has neither -- see globals.css.
// With real photography the rule generalises: the Desktop rail shows every
// image, Tablet shows every image EXCEPT the one on display.
const DESKTOP_THUMB_LABELS = ['Front', 'Back', 'Print', 'Fabric', 'Model'];
const TABLET_THUMB_LABELS = ['Back', 'Print', 'Fabric', 'Model'];

/**
 * The gallery, and the reader half of A05.
 *
 * COLOUR DRIVES WHAT IS SHOWN, which is the whole reason A05 lets staff
 * assign an image to a colour. Choosing BLACK shows the BLACK photographs
 * plus any image assigned to no colour at all -- a fabric close-up or a
 * print detail belongs to every colourway, and making staff upload it
 * once per colour would be the same photograph four times.
 *
 * When a colour has neither its own images nor any shared ones, the whole
 * set shows rather than nothing: a catalogue mid-shoot has one colour
 * photographed and three not, and an empty gallery on a T-shirt that has
 * pictures is worse than showing the pictures it has.
 *
 * Selection is held as an image ID rather than an index, so switching
 * colour snaps to that colour's first photograph instead of keeping an
 * index that now points at a different garment.
 */
export function ProductGallery({
  images,
  colour,
}: {
  images: ProductImage[];
  colour: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const forColour = colour ? images.filter((i) => i.colour === colour || i.colour === null) : images;
  const visible = forColour.length > 0 ? forColour : images;
  const active = visible.find((i) => i.id === selectedId) ?? visible[0] ?? null;

  if (!active) {
    // No photography for this T-shirt yet. The same honest well the product
    // cards use rather than a broken <img> (README's blocked-on-owner list
    // is now only blocked on the owner sending photographs).
    return (
      <div className="mc-pdp-gallery">
        <div className="mc-pdp-thumbs-desktop">
          {DESKTOP_THUMB_LABELS.map((label) => (
            <ThumbWell key={label} label={label} />
          ))}
        </div>
        <div
          className="mc-pdp-main-image"
          style={{
            background: 'var(--mc-mist)',
            borderRadius: 'var(--mc-radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--mc-text-muted)',
          }}
        >
          No product photography yet
        </div>
        <div className="mc-pdp-thumbs-tablet">
          {TABLET_THUMB_LABELS.map((label) => (
            <ThumbWell key={label} label={label} />
          ))}
        </div>
      </div>
    );
  }

  const tabletThumbs = visible.filter((i) => i.id !== active.id);

  return (
    <div className="mc-pdp-gallery">
      <div className="mc-pdp-thumbs-desktop">
        {visible.map((image) => (
          <Thumb
            key={image.id}
            image={image}
            selected={image.id === active.id}
            onSelect={() => setSelectedId(image.id)}
          />
        ))}
      </div>
      <div
        className="mc-pdp-main-image"
        style={{ background: 'var(--mc-mist)', borderRadius: 'var(--mc-radius-md)', overflow: 'hidden' }}
      >
        {/* Not lazy and not next/image: this is the largest thing on the
            screen and the first thing someone came to look at. The bucket is
            public and the file is already export-sized. */}
        <img
          src={active.url}
          alt={active.alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {tabletThumbs.length > 0 && (
        <div className="mc-pdp-thumbs-tablet">
          {tabletThumbs.map((image) => (
            <Thumb key={image.id} image={image} selected={false} onSelect={() => setSelectedId(image.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({
  image,
  selected,
  onSelect,
}: {
  image: ProductImage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      // Colour is never the only signal (CLAUDE.md rule 8): the selected
      // thumb is the one at full opacity AND the one aria-pressed reports.
      style={{
        aspectRatio: '4 / 5',
        padding: 0,
        border: `1px solid ${selected ? 'var(--mc-border-strong)' : 'var(--mc-border-default)'}`,
        borderRadius: 'var(--mc-radius-sm)',
        background: 'var(--mc-mist)',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: selected ? 1 : 0.7,
      }}
    >
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </button>
  );
}

function ThumbWell({ label }: { label: string }) {
  return (
    <div
      style={{
        aspectRatio: '4 / 5',
        background: 'var(--mc-mist)',
        borderRadius: 'var(--mc-radius-sm)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--mc-text-muted)', textAlign: 'center' }}>{label}</span>
    </div>
  );
}
