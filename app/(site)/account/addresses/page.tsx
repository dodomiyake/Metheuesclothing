import { createServerComponentClient } from '@/lib/supabase/server-component';
import { requireCustomerPage } from '@/lib/account/require-customer';
import { AccountShell } from '@/components/site/account-shell';
import { AddressBook, type SavedAddress } from './address-book';

export const metadata = { title: 'Saved addresses — Metheues Clothings' };

/**
 * 30 Saved Addresses — Figma 106:3719 (Desktop). Two-up 400px cards that
 * wrap, capped at 840; tablet and mobile stack.
 *
 * THE ADDRESSES ARE REAL AND THIS PAGE IS THE ONLY WRITER. `addresses` has
 * existed since migration 001 with a policy and a unique partial index for
 * exactly one default per customer, and nothing in this app had ever
 * written a row — checkout collects the address through Stripe and the
 * webhook stores a snapshot on the ORDER, which is a different thing and
 * deliberately so (an order's address must not change when a customer
 * later edits their address book).
 *
 * Which is why the design's empty state is reworded. It says "Addresses
 * you enter at checkout can be saved here", and nothing does that: Stripe
 * Checkout owns that form. The honest version says where these are used
 * instead.
 *
 * TWO NARROWINGS. "Read the Shipping Policy" points at screen 33, which is
 * unbuilt, so the guidance panel keeps the words and drops the link rather
 * than adding another 404. And the panel's own promise narrows: the design
 * says "a controlled list of international destinations" with "duties and
 * taxes calculated and collected at checkout", while checkout ships to GB
 * and IE only and collects no duties at all (A22's note). It says the two
 * countries that can actually be ordered to.
 */
export default async function AccountAddressesPage() {
  await requireCustomerPage('/account/addresses');
  const supabase = await createServerComponentClient();

  // addresses_own scopes this to the caller; the order is oldest first so
  // the list does not reshuffle when one is edited.
  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, recipient, line1, line2, city, postcode, country_code, phone, is_default')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load your addresses: ${error.message}`);

  const addresses = (data ?? []) as SavedAddress[];

  return (
    <AccountShell
      current="addresses"
      eyebrow="Your account"
      title="Saved addresses"
      meta={`${addresses.length === 0 ? 'None saved' : `${addresses.length} saved`} · used at checkout`}
    >
      <AddressBook initial={addresses} />
    </AccountShell>
  );
}
