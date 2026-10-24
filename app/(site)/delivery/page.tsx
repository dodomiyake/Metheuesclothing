import Link from 'next/link';
import { createServerComponentClient } from '@/lib/supabase/server-component';
import { ContentPage, ContentSection, ContentText } from '@/components/site/content-page';
import { formatPence } from '@/lib/money';

export const metadata = {
  title: 'Delivery and returns — Metheues Clothings',
  description: 'What delivery costs, how returns work, and what happens when something is not right.',
};

/**
 * 33 Delivery and Returns — Figma 122:6504 (Desktop pulled, 122:6179 Mobile
 * by screenshot). Built on the ledger's content_page_shell.
 *
 * EVERY FIGURE ON THIS PAGE IS READ FROM store_settings, which is the whole
 * reason it can exist at all: the delivery prices, the free-delivery
 * threshold and the return window are the SAME values checkout charges and
 * request_return() enforces. A delivery page is the one page where a number
 * that disagrees with the checkout is worse than no page.
 *
 * THE DESIGN'S TABLE HAS FOUR DESTINATION ROWS AND THIS HAS TWO, for the
 * reason A22 gave when it omitted the same rows from Store settings:
 * checkout ships to GB and IE only, and `deliveryPence` is chosen by
 * delivery_method alone — it does not vary by country. So "Republic of
 * Ireland £9.95" and "Rest of Europe £14.95, duties collected at checkout"
 * are three claims the system cannot keep: a price nobody charges, a
 * destination nobody can select, and a duty nothing collects.
 *
 * FIVE MORE NARROWINGS, each because the sentence describes an operation
 * rather than a column:
 *
 *  - "Orders placed before 14:00 are packed the same day". No cut-off is
 *    configured anywhere and nothing measures it.
 *  - "2 to 3 working days" / "Next working day". Nothing computes or
 *    records a delivery estimate — A12's timeline omits one for the same
 *    reason. The service NAMES are real (delivery_method is an enum of
 *    exactly those two), so the page says what the service is and does not
 *    promise a date.
 *  - "a printable label and a QR code for drop-off". Nothing issues a
 *    label; `label_expires_at` exists and is never written, which A17/A18
 *    already record and E9 already narrows.
 *  - "a booked collection is £4.95". collection_fee_pence is a real column
 *    that NOTHING applies to a refund — A22 refused to make it editable for
 *    exactly that reason, and quoting it here would be the same fiction
 *    with a customer reading it.
 *  - "We cover the postage both ways" on faulty items. Nothing arranges a
 *    parcel. What replaces it keeps the statutory part (a faulty item is
 *    refunded in full, delivery included) without inventing the mechanism.
 *
 * Exchanges keeps the design's words almost intact, because it is the one
 * section describing something true: there is no exchange mechanism, and
 * the reason given — a fixed run cannot hold a size while a parcel travels
 * — is the honest one.
 */
export default async function DeliveryPage() {
  const supabase = await createServerComponentClient();

  const { data: settings, error } = await supabase
    .from('store_settings')
    .select(
      'delivery_tracked_48_pence, delivery_next_day_pence, free_delivery_threshold_pence, return_window_days, contact_email',
    )
    .single();

  // Loud rather than a page quoting defaults nobody chose — migration 008's
  // lesson, and the same call the checkout route makes when this read fails.
  if (error) throw new Error(`Could not load delivery settings: ${error.message}`);

  const threshold = formatPence(settings.free_delivery_threshold_pence);
  const rows = [
    {
      service: 'Tracked 48',
      cost: formatPence(settings.delivery_tracked_48_pence),
      note: `Free on orders over ${threshold}`,
    },
    {
      service: 'Next working day',
      cost: formatPence(settings.delivery_next_day_pence),
      note: 'Chosen in the bag before checkout',
    },
  ];

  return (
    <ContentPage
      breadcrumb="Delivery and Returns"
      title="Delivery and returns"
      intro="What it costs, how long it takes, and what happens when something is not right. No small print you have to hunt for."
    >
      <ContentSection heading="Delivery">
        <ContentText>
          We deliver across the United Kingdom and to the Republic of Ireland. Both services are
          tracked, and the tracking number reaches you by email as soon as the parcel leaves us —
          it is also on the order itself, under your account or through order tracking.
        </ContentText>

        {/* 122:6568 at 768 and up; 122:6179's stacked cards below it. */}
        <div className="mc-content-table">
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'var(--mc-bg-surface)',
              border: '1px solid var(--mc-border-default)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--mc-bg-page)' }}>
                {['Service', 'Cost', 'Note'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '1.2px',
                      textTransform: 'uppercase',
                      color: 'var(--mc-text-muted)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.service} style={{ borderTop: i === 0 ? undefined : '1px solid var(--mc-border-default)' }}>
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 500 }}>{row.service}</td>
                  <td style={{ padding: '14px 16px', fontSize: 14 }}>{row.cost}</td>
                  <td style={{ padding: '14px 16px', fontSize: 14 }}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mc-content-cards">
          {rows.map((row) => (
            <div
              key={row.service}
              style={{
                background: 'var(--mc-bg-surface)',
                border: '1px solid var(--mc-border-default)',
                borderRadius: 4,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{row.service}</p>
              <CardRow label="Cost" value={row.cost} />
              <CardRow label="Note" value={row.note} />
            </div>
          ))}
        </div>

        <p style={{ margin: 0, fontSize: 13, lineHeight: '19px', color: 'var(--mc-text-muted)' }}>
          We do not publish a delivery estimate, because we would rather not promise a date the
          courier has not given us. Both services are tracked from the moment the parcel leaves,
          and the tracking is the honest answer to where it is.
        </p>
      </ContentSection>

      <ContentSection id="returns" heading="Returns">
        <ContentText>
          You have {settings.return_window_days} days from the day your order is delivered to start
          a return, for any reason at all. Items need to be unworn and unwashed with the tags still
          attached.
        </ContentText>
        <ContentText>
          Start it from the order itself — under{' '}
          <Link href="/account/orders" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            your account
          </Link>{' '}
          if you have one, or through{' '}
          <Link href="/track-order" style={{ color: 'var(--mc-text-primary)', fontWeight: 600 }}>
            order tracking
          </Link>{' '}
          with your order number and email. You choose the items and tell us why, and we write back
          with where to send them. We do not issue a label automatically yet, so wait to hear from
          us before posting anything.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Refunds">
        <ContentText>
          Once a return reaches us and has been checked, the refund goes back to the card that
          paid. Your bank then takes its own 5 to 10 working days to show it, which is the part
          nobody can hurry. Delivery paid on the original order is not refunded unless the item was
          faulty or wrong.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Exchanges">
        <ContentText>
          We do not swap items directly. A fixed run means we cannot promise the size you want will
          still be there while your parcel is in transit. Return what does not fit and place a new
          order for the size you want — that way the size is yours the moment you order it.
        </ContentText>
      </ContentSection>

      <ContentSection heading="Faulty or wrong items">
        <ContentText>
          If something arrives faulty, damaged or simply not what you ordered, email us with the
          order number and a photograph before sending anything back. A faulty or incorrect item is
          refunded in full, including the delivery you paid on the original order, and we will
          arrange the return with you rather than leaving you out of pocket.
        </ContentText>
      </ContentSection>

      <div
        style={{
          background: 'var(--mc-bg-page)',
          border: '1px solid var(--mc-border-default)',
          borderRadius: 4,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-start',
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Something not covered here?</p>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '21px', color: 'var(--mc-text-muted)' }}>
          Email {settings.contact_email} with your order number and we will come back to you.
        </p>
        <a href={`mailto:${settings.contact_email}`} className="mc-button-secondary">
          Email us
        </a>
      </div>
    </ContentPage>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <span style={{ color: 'var(--mc-text-muted)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </span>
  );
}
