-- Order and return numbers come from the database, not the application.
-- Generating them in app code means two requests can race to the same number
-- and the unique constraint turns a checkout into a 500. A sequence cannot race.

create sequence order_number_seq start 10001;
create sequence return_number_seq start 4400;

alter table orders
  alter column order_number set default 'MC-' || nextval('order_number_seq');

alter table returns
  alter column return_number set default 'RET-' || nextval('return_number_seq');

-- Sequences are not transactional: a rolled-back checkout burns a number and
-- leaves a gap. That is correct and intended — a gap in order numbers is
-- harmless, whereas reusing one would attach a new order to an old paper trail.
