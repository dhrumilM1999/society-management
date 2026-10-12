-- Navratri 2026: real member counts per house, copied from the handwritten list.
-- Rate on the list is Rs 600 per person.
--
-- BEFORE RUNNING: in the app (admin > Navratri festival) create the season once.
-- That creates all 19 house rows. Then run this in the Supabase SQL editor.
-- Safe to re-run; it only updates member counts and the rate of the ACTIVE season.
--
-- Please double-check these readings against the paper before running:
--   39 -> 6  (the "5" was overwritten; amount 3600 = 6 x 600)
--   43 -> 6  (written "2 + 4", amount 1200 + 2400)
--   37 and 44 -> 0 (blank / dash on the list)
update public.navratri_households h
set participant_count = v.n,
    contribution_per_person_paise = 60000,
    is_participating = v.n > 0,
    updated_at = now()
from (values
  (31,2),(32,5),(33,3),(34,2),(35,3),(36,4),(37,0),
  (38,2),(39,6),(40,6),(41,4),(42,3),(43,6),(44,0),
  (45,3),(46,2),(47,10),(48,5),(49,1)
) as v(house_number, n)
where h.house_number = v.house_number
  and h.season_id = (select id from public.navratri_seasons
                     where status = 'active' order by starts_on desc limit 1);

-- Check: expect 19 rows, 67 people, Rs 40,200 total due.
select count(*) as houses, sum(participant_count) as people,
       sum(amount_due_paise) / 100.0 as total_due_rupees
from public.navratri_households
where season_id = (select id from public.navratri_seasons
                   where status = 'active' order by starts_on desc limit 1);
