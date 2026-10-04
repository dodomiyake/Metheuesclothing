-- The two links the admin side of returns (A17, A18) was missing.
--
-- 1. A REFUND COULD NOT BE TIED TO A RETURN. `refunds` (012) records who, how
--    much and which Stripe object, but not which return it settles. That link
--    is not bookkeeping pedantry -- it is what decides WHICH EMAIL goes out.
--    E7 and E8 are the same moment (money leaving) told two ways: E7 names the
--    condition check and the shelf, E8 is the plain order refund. Without
--    return_id there is no way to tell them apart, and E7's own canvas note is
--    explicit that it "is only sent once the money has actually left -- never
--    on approval alone".
--
-- 2. RESTOCK WAS WHOLE-ORDER ONLY. restock_for_order puts every line back at
--    once, which is right for a cancellation and wrong for A18, whose whole
--    point is that "condition and the restock decision are recorded per item,
--    not per return -- one T-shirt can go back on the shelf while the other
--    does not".
--
--    The exactly-once index on inventory_adjustments is (order_id, variant_id,
--    kind) where order_id is not null, and it exists so a replayed Stripe
--    webhook cannot decrement stock twice. It must not be weakened. But two
--    separate partial returns on the same order can both legitimately restock
--    the same variant, and under that index the second would be silently
--    swallowed. So a per-item restock carries return_item_id and leaves
--    order_id null, with its own exactly-once index at the right grain. The
--    order is still reachable through the return item.

alter table refunds add column return_id uuid references returns(id) on delete set null;
create index refunds_return_idx on refunds (return_id) where return_id is not null;

alter table inventory_adjustments
  add column return_item_id uuid references return_items(id) on delete set null;

-- The same exactly-once guarantee as the order-level index, one level down:
-- a given return line can produce one restock, ever.
create unique index inventory_adjustments_once_per_return_item
  on inventory_adjustments (return_item_id, kind)
  where return_item_id is not null;
