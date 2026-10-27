-- Metheues Clothings — migration 022
-- A working unsubscribe, which the mailing list has never had.
--
-- `newsletter_subscribers.unsubscribed_at` has existed since 001. A20
-- renders "Unsubscribed <date>" from it and the A20 export includes it, and
-- NOTHING EVER WROTE IT — no route, no link, no token. It was the last
-- "column read by something and written by nothing" on this project's list,
-- and it was latent rather than live only because nothing sends marketing
-- email yet. PECR requires a working opt-out in every marketing message, so
-- it has to exist before the first newsletter goes out, not after.
--
-- A TOKEN, NOT THE EMAIL ADDRESS, for the reason rules 5 and 6 give about
-- guest orders. A link carrying `?email=` lets anyone unsubscribe anyone,
-- and answers "is this person on your list?" to whoever asks. A uuid names
-- a subscription and proves nothing about an address somebody guessed.
--
-- NOT NULL WITH A DEFAULT, so every row that already existed gets one and
-- no address is stranded without a way out. The table was empty when this
-- ran, so there was nothing to backfill, but a default is what makes that
-- true for the next row rather than only for today's.
--
-- Rule 3 needs no advisor run here: this adds no SECURITY DEFINER function.
--
-- ===================================================== HOW THIS FILE EXISTS
-- RECONSTRUCTED ON 27 OCTOBER from the live database, because it was applied
-- and never committed. `supabase_migrations.schema_migrations` holds
-- `20261026093757 / 022_newsletter_unsubscribe_token` and the column, its
-- NOT NULL, its default and the unique index are all present on the live
-- project — but there was no file in this repository and none in the git
-- history, so the statements below are read back off the database rather
-- than written from memory.
--
-- That is the mirror image of 020's hole, which ran through the dashboard
-- and was missing from the HISTORY while the file was in the repo. Both
-- directions are worth knowing about: the history and the repo are two
-- separate records of the same thing and either can be the one that is
-- short.

alter table newsletter_subscribers
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists newsletter_subscribers_unsubscribe_token_key
  on newsletter_subscribers (unsubscribe_token);
