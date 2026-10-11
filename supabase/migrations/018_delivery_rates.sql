-- Make the delivery prices configurable, because they never were.
--
-- A22 Store settings draws a Delivery card with a price against each
-- method, and the free-delivery threshold beside it. The threshold IS a
-- column and checkout reads it. The prices are not: they are two integer
-- literals in app/api/checkout/route.ts —
--
--     delivery_method === 'next_day' ? 695 : subtotal >= threshold ? 0 : 395
--
-- which means the owner can change WHEN delivery becomes free but not what
-- it costs, and changing £3.95 needs a developer and a deploy. That is
-- incoherent rather than merely incomplete: the two numbers belong to the
-- same decision and live in different places.
--
-- THE DEFAULTS ARE EXACTLY TODAY'S LITERALS, so applying this changes no
-- price anywhere. The behaviour change is only that the numbers can now be
-- edited, and the code that reads them replaces the literals in the same
-- commit — a column nothing reads would just be a third place for the
-- price to disagree with itself.
--
-- Only the two methods checkout actually offers. The design draws four
-- rows, adding Republic of Ireland and Rest of Europe, but
-- `delivery_method` is an enum of exactly tracked_48 and next_day and
-- checkout restricts shipping to GB and IE (allowed_countries), so a row
-- for Rest of Europe would be a price for a parcel nobody can order. A
-- per-country rate table is a real feature; it is not two more columns.
alter table store_settings
  add column if not exists delivery_tracked_48_pence integer not null default 395
    check (delivery_tracked_48_pence >= 0),
  add column if not exists delivery_next_day_pence   integer not null default 695
    check (delivery_next_day_pence >= 0);

comment on column store_settings.delivery_tracked_48_pence is
  'Standard UK/IE delivery, charged when the subtotal is under free_delivery_threshold_pence.';
comment on column store_settings.delivery_next_day_pence is
  'Next working day. Always charged — the free-delivery threshold applies to tracked_48 only, which is what checkout has always done.';
