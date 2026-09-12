-- Metheues Clothings — row level security
-- §12: "Enforce RLS and server-side authorization."
-- §18: "Customers can access only their own protected data."
--
-- Default posture: enable RLS on everything, then grant the narrowest thing
-- that works. Tables with no policy below are deliberately unreachable from
-- the browser and are only touched by the server with the service role.

alter table profiles              enable row level security;
alter table addresses             enable row level security;
alter table collections           enable row level security;
alter table products              enable row level security;
alter table product_collections   enable row level security;
alter table product_images        enable row level security;
alter table product_variants      enable row level security;
alter table inventory_adjustments enable row level security;
alter table orders                enable row level security;
alter table order_items           enable row level security;
alter table payments              enable row level security;
alter table fulfilments           enable row level security;
alter table returns               enable row level security;
alter table return_items          enable row level security;
alter table webhook_events        enable row level security;
alter table newsletter_subscribers enable row level security;
alter table store_settings        enable row level security;
alter table homepage_sections     enable row level security;
alter table audit_logs            enable row level security;

-- staff check, kept in one place so a role change is one edit
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('staff','owner')
  );
$$;

create or replace function is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'owner'
  );
$$;

-- ----------------------------------------------------------------- customer
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or is_staff());
create policy profiles_self_write on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy addresses_own on addresses
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy orders_own_read on orders
  for select using (profile_id = auth.uid() or is_staff());

create policy order_items_own_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.profile_id = auth.uid() or is_staff()))
  );

create policy payments_own_read on payments
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.profile_id = auth.uid() or is_staff()))
  );

create policy fulfilments_own_read on fulfilments
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.profile_id = auth.uid() or is_staff()))
  );

create policy returns_own on returns
  for select using (profile_id = auth.uid() or is_staff());
create policy returns_own_create on returns
  for insert with check (profile_id = auth.uid());

create policy return_items_own on return_items
  for select using (
    exists (select 1 from returns r where r.id = return_id
            and (r.profile_id = auth.uid() or is_staff()))
  );

-- ------------------------------------------------------------------- public
-- Anyone may read the published catalogue. Nobody may write it but staff.
create policy collections_public_read on collections
  for select using (status = 'live' or is_staff());
create policy products_public_read on products
  for select using (status = 'published' or is_staff());
create policy product_collections_public_read on product_collections
  for select using (true);
create policy product_images_public_read on product_images
  for select using (
    exists (select 1 from products p where p.id = product_id
            and (p.status = 'published' or is_staff()))
  );
-- note: inactive variants stay visible so the size selector can show a
-- disabled option rather than silently hiding it (§8.4)
create policy product_variants_public_read on product_variants
  for select using (
    exists (select 1 from products p where p.id = product_id
            and (p.status = 'published' or is_staff()))
  );

create policy newsletter_self_insert on newsletter_subscribers
  for insert with check (true);

create policy store_settings_public_read on store_settings
  for select using (true);
create policy homepage_public_read on homepage_sections
  for select using (true);

-- -------------------------------------------------------------------- staff
create policy collections_staff_write on collections for all
  using (is_staff()) with check (is_staff());
create policy products_staff_write on products for all
  using (is_staff()) with check (is_staff());
create policy product_collections_staff_write on product_collections for all
  using (is_staff()) with check (is_staff());
create policy product_images_staff_write on product_images for all
  using (is_staff()) with check (is_staff());
create policy product_variants_staff_write on product_variants for all
  using (is_staff()) with check (is_staff());
create policy inventory_staff_read on inventory_adjustments
  for select using (is_staff());
create policy orders_staff_write on orders for update
  using (is_staff()) with check (is_staff());
create policy returns_staff_write on returns for update
  using (is_staff()) with check (is_staff());
create policy homepage_staff_write on homepage_sections for all
  using (is_staff()) with check (is_staff());
create policy audit_read_staff on audit_logs for select using (is_staff());

-- owner only
create policy settings_owner_write on store_settings for update
  using (is_owner()) with check (is_owner());

-- ------------------------------------------------------- server-role only
-- webhook_events has NO policy: the browser must never see or touch it.
-- inventory_adjustments has read-only staff access and no client write path;
-- stock only ever moves through the functions in 003_functions.sql.
-- audit_logs is insert-by-server, read-by-staff, and updates and deletes are
-- blocked by trigger as well as by the absence of a policy.

revoke all on webhook_events from anon, authenticated;
revoke insert, update, delete on inventory_adjustments from anon, authenticated;
revoke insert, update, delete on audit_logs from anon, authenticated;

-- NOTE ON GUEST ORDERS
-- A guest has no auth.uid(), so no policy here can reach their order. Guest
-- order lookup must go through a server route that takes order number + email
-- and uses the service role. Do not be tempted to add a policy that matches on
-- email alone — email is not a secret and that would expose every guest order
-- to anyone who can guess an address.
