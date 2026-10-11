import { createServerComponentClient } from '@/lib/supabase/server-component';
import { WideOnly } from '@/components/admin/wide-only';
import { buildHomeContent } from '@/lib/home/sections';
import type { ContentPayload } from '@/lib/admin/content-schema';
import { ContentForm, type CollectionOption, type ProductOption } from './content-form';

/**
 * A21 Store content — Figma 146:2755 (Desktop pulled) / 146:2536 (Tablet).
 * Behind WideOnly: A21 is on `admin_breakpoint_decision`'s no_mobile list,
 * and this is a seven-section editor, which is exactly the density the
 * recorded reason names.
 *
 * It is the LAST of the 23 admin screens, and it only became honest one
 * commit ago. `homepage_sections` has existed since migration 001 and
 * nothing read it until the real homepage was built; before that this
 * editor would have written seven rows no page consults.
 *
 * The form is seeded from buildHomeContent(), the same function the
 * homepage renders through — so what is in the fields is exactly what a
 * customer is seeing, defaults included. An empty table shows the shipped
 * copy rather than seven blank cards, and publishing from here is what
 * turns a default into a stored row.
 */
export default async function AdminContentPage() {
  const supabase = await createServerComponentClient();

  const [sectionsQuery, productsQuery, collectionsQuery] = await Promise.all([
    supabase.from('homepage_sections').select('key, content, updated_at, updated_by'),
    supabase.from('products').select('slug, name, status').order('name'),
    // Only live collections: the hero button and the featured-drop link
    // both point at collection PAGES, and a hidden collection's page 404s
    // for a customer (002_rls.sql:88). Offering one would be offering a
    // broken link.
    supabase.from('collections').select('slug, name, status').eq('status', 'live').order('position'),
  ]);

  if (sectionsQuery.error) throw new Error(`Could not load the content: ${sectionsQuery.error.message}`);
  if (productsQuery.error) throw new Error(`Could not load T-shirts: ${productsQuery.error.message}`);
  if (collectionsQuery.error) {
    throw new Error(`Could not load collections: ${collectionsQuery.error.message}`);
  }

  const rows = (sectionsQuery.data ?? []) as {
    key: string;
    content: unknown;
    updated_at: string | null;
    updated_by: string | null;
  }[];
  const content = buildHomeContent(rows);

  // "Last published ... by Dami" (146:2977). The most recent updated_at
  // across the slots, with the actor resolved to a name — homepage_sections
  // stores only a profile id.
  const newest = rows.reduce<{ at: string; by: string | null } | null>((acc, r) => {
    if (!r.updated_at) return acc;
    if (!acc || r.updated_at > acc.at) return { at: r.updated_at, by: r.updated_by };
    return acc;
  }, null);

  let lastPublished: { at: string; by: string | null } | null = null;
  if (newest) {
    let name: string | null = null;
    if (newest.by) {
      const { data: actor } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', newest.by)
        .maybeSingle();
      name = (actor?.full_name as string) || (actor?.email as string) || null;
    }
    lastPublished = { at: newest.at, by: name };
  }

  // The form edits exactly what the route accepts: the hero's eyebrow is
  // not a field (it comes from the featured drop) and the story has no
  // CTA (screen 32 is unbuilt), so neither is passed through.
  const initial: ContentPayload = {
    announcement: content.announcement,
    hero: {
      title: content.hero.title,
      body: content.hero.body,
      cta_label: content.hero.cta_label,
      cta_href: content.hero.cta_href,
    },
    featured_drop: content.featured_drop,
    featured_products: content.featured_products,
    story: content.story,
    craft: content.craft,
    newsletter: content.newsletter,
    reassurance: content.reassurance,
  };

  return (
    <WideOnly title="Homepage content">
      <ContentForm
        initial={initial}
        products={(productsQuery.data ?? []) as ProductOption[]}
        collections={(collectionsQuery.data ?? []) as CollectionOption[]}
        lastPublished={lastPublished}
      />
    </WideOnly>
  );
}
