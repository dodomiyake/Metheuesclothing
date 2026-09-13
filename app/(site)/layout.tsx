import { createServerComponentClient } from '@/lib/supabase/server-component';
import { AnnouncementBar } from '@/components/site/announcement-bar';
import { Header } from '@/components/site/header';
import { Footer } from '@/components/site/footer';

/**
 * Shell for every customer-facing page (not /admin, which deliberately has
 * its own black-rail chrome so staff never mistake it for the storefront).
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient();
  const { data: settings, error } = await supabase
    .from('store_settings')
    .select('free_delivery_threshold_pence')
    .single();
  // See app/shop/page.tsx's comment on why a query error must not be
  // treated the same as "no settings" -- this one is quieter: worst case a
  // wrong number in the announcement bar, not a wrong price, so it falls
  // back rather than taking every page down with it. The checkout route has
  // its own authoritative read and does not depend on this succeeding.
  const threshold = !error && settings ? settings.free_delivery_threshold_pence : 15000;

  return (
    <>
      <AnnouncementBar thresholdPence={threshold} />
      <Header />
      {children}
      <Footer />
    </>
  );
}
