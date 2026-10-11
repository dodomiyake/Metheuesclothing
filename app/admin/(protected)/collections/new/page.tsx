import { WideOnly } from '@/components/admin/wide-only';
import { CollectionForm } from '../collection-form';

/**
 * A09's "New collection" (145:2507) lands here. The design has no separate
 * new-collection frame, so this is A10 with nothing in it and its T-shirts
 * panel explaining that there is nothing to attach them to until the
 * collection exists — rather than a second form to keep in sync with the
 * editor.
 *
 * A new collection starts Hidden, not Live. Creating something and having
 * it appear on the shop the same second, before it has a description, a
 * hero or a single T-shirt in it, is the one default that cannot be undone
 * quietly.
 */
export default function NewCollectionPage() {
  return (
    <WideOnly title="New collection">
      <CollectionForm
        initial={{
          id: null,
          name: '',
          slug: '',
          description: '',
          hero_alt: '',
          status: 'hidden',
          published_at: null,
          seo_title: '',
          seo_description: '',
          position: null,
        }}
        members={[]}
        candidates={[]}
      />
    </WideOnly>
  );
}
