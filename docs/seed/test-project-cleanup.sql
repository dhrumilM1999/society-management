-- TEST PROJECT ONLY (sonalpark-gate-2-test). DO NOT RUN ON PRODUCTION.
-- Removes all synthetic Navratri data (seasons, houses, payments, tokens, expenses).
-- Houses 31-49, profiles and login accounts are kept.
delete from public.navratri_tokens;
delete from public.navratri_expenses;
delete from public.navratri_contributions;
delete from public.navratri_households;
delete from public.navratri_seasons;
