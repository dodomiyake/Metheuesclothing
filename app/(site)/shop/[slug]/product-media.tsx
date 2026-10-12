'use client';

import { useMemo, useState } from 'react';
import { AddToBag } from './add-to-bag';
import { ProductGallery } from './product-gallery';
import type { ProductImage } from '@/lib/shop/product-images';

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
  panelHeader,
  panelFooter,
}: {
  images: ProductImage[];
  variants: Variant[];
  productSlug: string;
  productName: string;
  panelHeader: React.ReactNode;
  panelFooter: React.ReactNode;
}) {
  const colours = useMemo(() => [...new Set(variants.map((v) => v.colour))], [variants]);
  const [colour, setColour] = useState<string | null>(colours[0] ?? null);

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
        />
        {panelFooter}
      </div>
    </>
  );
}
