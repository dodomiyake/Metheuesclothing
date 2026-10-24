'use client';

import { useMemo, useState } from 'react';
import { AddToBag } from './add-to-bag';
import { ProductGallery } from './product-gallery';
import type { ProductImage } from '@/lib/shop/product-images';
import type { CrossSellItem } from '@/components/site/add-to-bag-panel';

type Variant = {
  id: string;
  colour: string;
  size: string;
  price_pence: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

/**
 * Holds the one piece of state the gallery and the purchase panel share.
 *
 * The chosen COLOUR decides both which photographs show and which sizes
 * are available, and the two sit in different cells of 04A's two-column
 * grid. Rather than duplicate the state or push it through a context, this
 * renders both cells as a fragment -- the grid container stays in the
 * server component, and the panel's own server-rendered copy (eyebrow,
 * title, price, description, the delivery line) is passed in as slots so
 * none of it has to become client code.
 */
export function ProductMedia({
  images,
  variants,
  productSlug,
  productName,
  crossSell,
  panelHeader,
  panelFooter,
}: {
  images: ProductImage[];
  variants: Variant[];
  productSlug: string;
  productName: string;
  crossSell: CrossSellItem[];
  panelHeader: React.ReactNode;
  panelFooter: React.ReactNode;
}) {
  const colours = useMemo(() => [...new Set(variants.map((v) => v.colour))], [variants]);
  const [colour, setColour] = useState<string | null>(colours[0] ?? null);

  // The confirmation panel shows the photograph of the colour actually
  // being added, picked the same way the gallery picks one: this colour's
  // images, plus any assigned to no colour, falling back to the whole set.
  const panelImage = useMemo(() => {
    const forColour = colour ? images.filter((i) => i.colour === colour || i.colour === null) : images;
    const visible = forColour.length > 0 ? forColour : images;
    return visible[0] ? { url: visible[0].url, alt: visible[0].alt } : null;
  }, [images, colour]);

  return (
    <>
      <ProductGallery images={images} colour={colour} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {panelHeader}
        <AddToBag
          productSlug={productSlug}
          productName={productName}
          variants={variants}
          colour={colour}
          onColourChange={setColour}
          image={panelImage}
          crossSell={crossSell}
        />
        {panelFooter}
      </div>
    </>
  );
}
