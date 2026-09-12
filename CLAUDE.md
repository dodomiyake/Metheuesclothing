# Metheues Clothings — working notes

T-shirt-first storefront and admin. UK, GBP, integer pence everywhere.

`docs/SPEC.md` is authoritative. Section numbers in comments (§10, §12, §18)
refer to it. When this file and the spec disagree, the spec wins.

| | |
|---|---|
| Figma | `9SzUlTWGVKOCkAULkbqOsr` — 64 screens, 9 email templates, 16 components |
| Supabase | project `afzuhymegntqjwtdkmfb`, eu-west-2 |
| Stack | Next.js App Router, TypeScript, Supabase, Stripe, Resend |

`docs/design-system-state.json` is the design ledger: every Figma node id,
component property key and build hazard. Read it before touching the Figma file;
it is the only record of which node is which.

## Rules this codebase is built around

These are not preferences. Each one is here because the alternative was tried,
or because the database enforces it and application code cannot opt out.

1. **Money is integer pence.** Never floats, never formatted strings parsed back.
2. **Prices come from the database.** `price_cart()` accepts variant ids and
   quantities only. Every checkout schema is `.strict()` so that a client sending
   `unit_price_pence` gets a 400, not a discount.
3. **Every `SECURITY DEFINER` function needs an explicit `REVOKE`.** Supabase
   exposes functions over `/rest/v1/rpc/` and grants EXECUTE to `anon` by
   default. Three functions shipped callable by the public internet before the
   security advisor caught it (see commit `fcd256a`). The pattern is:
   ```sql
   revoke execute on function f(args) from public, anon, authenticated;
   grant  execute on function f(args) to service_role;
   ```
   Run `get_advisors(type: "security")` after every migration that adds one.
4. **Multi-row writes belong in a Postgres function.** The Supabase JS client has
   no transaction. `request_return()` exists because doing it from the route
   leaves half-created returns behind when the second insert fails.
5. **Guests prove order number AND email, together, through a server route.**
   There is deliberately no RLS policy for guest order access — a policy matching
   on email alone would let anyone who knows an address read that customer's
   orders. See the note in `002_rls.sql`.
6. **Lookup failures are indistinguishable.** One message for "no such order" and
   "wrong email", or the endpoint becomes an order-number oracle.
7. **`import 'server-only'`** at the top of anything that touches the service role
   key, so importing it from a client component is a build error rather than a
   leak.
8. **Colour is never the only signal for state**, and interactive targets are
   44px minimum. `design/tokens/README.md` has the rest, including the one
   palette correction: Stone `#68635D` fails AA on dark, use `#8A8178`.

## Things that have already gone wrong

Worth reading before repeating them.

- A webhook handler that threw *after* claiming its event left the claim row
  behind. Stripe's retry then hit the duplicate guard and got a 200 — the work
  never happened and nothing reported it. The catch block deletes the claim.
- `store_settings` had no row. `now() > ts + make_interval(days => NULL)` is
  NULL, not true, so the returns window check silently never fired. A missing
  config row meant an unlimited returns window. Functions now raise rather than
  assume.
- Rate limiting in a `Map` does not work on serverless — no single process, so a
  cold instance hands out a fresh allowance. It is counted in Postgres.
- `x-forwarded-for` is a request header. It is only trustworthy because Vercel
  overwrites it at the edge. Change hosting and the limiter silently stops.

## State

Done: schema + RLS + integrity functions (migrations 001–008, all applied),
checkout, Stripe webhook, guest order lookup, returns, rate limiting, design
tokens. The §18 guarantees were verified against the live database rather than
assumed — see `supabase/migrations/README.md`.

Next: Resend wiring for the nine email templates (E3 goes where the TODO sits in
the webhook), the admin side of returns, auth rate limiting, and the catalogue,
product, bag and account pages.

Blocked on the owner, not on code: photography, verified garment measurements
(§8.5 — the size tables in the design are placeholders and must not ship), real
delivery rates, the £150 threshold, a verified sending domain for Resend, and
legal review of the returns and privacy copy. Three seeded values in migration
008 are marked PLACEHOLDER for the same reason.

## Conventions

- Commit messages explain *why*, and name the failure mode when fixing one. The
  history is meant to be readable as a record of decisions.
- Migrations are numbered and never edited once applied. Fix forward.
- Test destructive database work against the live project only with data you
  created, and delete it afterwards — confirm the tables are back to zero.
