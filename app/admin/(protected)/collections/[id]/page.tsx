import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { WideOnly } from '@/components/admin/wide-only';
import { CollectionForm, type MemberProduct } from '../collection-form';

/**
 * A10 Collection editor — Figma 145:2762 (Desktop pulled) / 145:2572
 * (Tablet). No Mobile frame; `admin_breakpoint_decision` lists A10 among
 * the sixteen no_mobile screens, so it sits behind WideOnly.
 *
 * Every field this screen edits now reaches a reader, which was not true
 * before screen 19 existed one commit ago: name, description and the hero's
 * alt text render on the collection page, the handle IS its address,
 * seo_title/seo_description become its title and description tags, status
 * decides whether a customer can see it at all, and the product order is
 * the order the page lists them in.
 */
export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerComponentClient();

  const { data: collection, error } = await supabase
    .from('collections')
    .select('id, slug, name, description, hero_alt, status, position, published_at, seo_title, seo_description')
    .eq('id', id)
    .maybeSingle();
  // A query error and a missing row both leave `data` null; only the second
  // is a 404 (CLAUDE.md's swallowed-error note).
  if (error) throw new Error(`Could not load the collection: ${error.message}`);
  if (!collection) notFound();

  const { data: links, error: linksError } = await supabase
    .from('product_collections')
    .select('product_id, position')
    .eq('collection_id', id)
    .order('position');
  if (linksError) throw new Error(`Could not load this collection: ${linksError.message}`);

  // Staff see every product, not just published ones: a drop is usually
  // curated before it goes live, so an editor that could only add already-
  // published T-shirts would be useless at exactly the moment it is needed.
  // products_public_read is `status = 'published' or is_staff()`.
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, slug, status')
    .order('name');
  if (productsError) throw new Error(`Could not load T-shirts: ${productsError.message}`);

  const all = (products ?? []) as MemberProduct[];
  const byId = new Map(all.map((p) => [p.id, p]));

  const members = (links ?? [])
    .map((l) => byId.get(l.product_id as string))
    .filter((p): p is MemberProduct => Boolean(p));

  return (
    <WideOnly title={(collection.name as string) ?? 'Collection'}>
      <CollectionForm
        initial={{
          id: collection.id as string,
          name: (collection.name as string) ?? '',
          slug: (collection.slug as string) ?? '',
          description: (collection.description as string) ?? '',
          hero_alt: (collection.hero_alt as string) ?? '',
          status: (collection.status as 'scheduled' | 'live' | 'hidden') ?? 'hidden',
          published_at: (collection.published_at as string | null) ?? null,
          seo_title: (collection.seo_title as string) ?? '',
          seo_description: (collection.seo_description as string) ?? '',
          position: (collection.position as number | null) ?? null,
        }}
        members={members}
        candidates={all}
      />
    </WideOnly>
  );
}
