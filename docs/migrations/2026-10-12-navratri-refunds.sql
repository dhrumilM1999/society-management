-- Navratri: allow returning an overpayment to a household.
-- Run in the Supabase SQL editor (test project first, then production).
-- A refund is stored as a normal positive amount with entry_type = 'refund';
-- the app subtracts refunds from what the house has paid. Existing rows stay 'payment'.
alter table public.navratri_contributions
  add column if not exists entry_type text not null default 'payment';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'navratri_contributions_entry_type_check') then
    alter table public.navratri_contributions
      add constraint navratri_contributions_entry_type_check check (entry_type in ('payment','refund'));
  end if;
end $$;
