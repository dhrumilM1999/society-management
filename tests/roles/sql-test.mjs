// Replays the roles/contacts migration on an in-memory Postgres (PGlite) that mimics PRODUCTION
// (same enum, constraints, policies, is_admin(), profile-protection trigger — copied from the live database).
//   npm i --no-save @electric-sql/pglite && node tests/roles/sql-test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const migration = fs.readFileSync(new URL('../../docs/migrations/2026-10-15-roles-and-contacts.sql', import.meta.url), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const db = new PGlite();
const SUPER = '00000000-0000-0000-0000-0000000000a1', ADMIN2 = '00000000-0000-0000-0000-0000000000a2', RES33 = '00000000-0000-0000-0000-000000000033', RES34 = '00000000-0000-0000-0000-000000000034';

await db.exec(`
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated; create schema app_private;
  create type public.account_role as enum ('admin', 'resident');
  create type public.notice_status as enum ('draft', 'published', 'archived');
  create table public.houses (house_number integer primary key check (house_number between 31 and 49), is_active boolean not null default true);
  insert into public.houses (house_number) select generate_series(31, 49);
  create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null, role public.account_role not null default 'resident',
    house_number integer unique references public.houses(house_number),
    preferred_language text not null default 'gu' check (preferred_language in ('en','gu')),
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    contact_phone text, updated_by uuid references public.profiles(id),
    constraint profile_role_house_consistency check ((role = 'resident' and house_number is not null) or (role = 'admin' and house_number is null)));
  create table public.audit_log (id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
  create table public.navratri_seasons (id uuid primary key default gen_random_uuid(), title text not null default 'Navratri', starts_on date not null, ends_on date not null, status text not null default 'draft' check (status in ('draft','active','closed')), created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
  create table public.navratri_households (id uuid primary key default gen_random_uuid(), season_id uuid not null references public.navratri_seasons(id), house_number integer not null references public.houses(house_number), participant_count integer not null default 0 check (participant_count between 0 and 100), contribution_per_person_paise bigint not null default 50000, amount_due_paise bigint generated always as (participant_count::bigint * contribution_per_person_paise) stored, is_participating boolean not null default true, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (season_id, house_number));
  create table public.navratri_contributions (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.navratri_households(id), amount_paise bigint not null check (amount_paise > 0), paid_on date not null default current_date, payment_method text not null default 'cash', reference_note text, received_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
  create table public.navratri_refunds (id uuid primary key default gen_random_uuid(), household_id uuid not null references public.navratri_households(id), amount_paise bigint not null check (amount_paise > 0), refunded_on date not null default current_date, refund_method text not null default 'cash', reference_note text, refunded_by uuid references public.profiles(id), created_at timestamptz not null default now());
  create table public.navratri_tokens (id uuid primary key default gen_random_uuid(), season_id uuid not null references public.navratri_seasons(id), house_number integer not null references public.houses(house_number), token_date date not null, member_label text not null, token_count integer not null default 1, status text not null default 'pending', received_at timestamptz, issued_by uuid references public.profiles(id), notes text, created_at timestamptz not null default now());
  create table public.navratri_expenses (id uuid primary key default gen_random_uuid(), season_id uuid not null references public.navratri_seasons(id), spent_on date not null default current_date, category text not null, description text not null, amount_paise bigint not null, paid_from text not null default 'navratri_contributions', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
  create table public.notices (id uuid primary key default gen_random_uuid(), title_en text not null, body_en text not null, status public.notice_status not null default 'draft', created_by uuid not null references public.profiles(id));
  create table public.meetings (id uuid primary key default gen_random_uuid(), title_en text not null, created_by uuid not null references public.profiles(id));
  create table public.maintenance_charges (id uuid primary key default gen_random_uuid(), house_number integer not null references public.houses(house_number), amount_paise bigint not null, created_by uuid not null references public.profiles(id));
  create table public.programmes (id uuid primary key default gen_random_uuid(), title_en text not null, created_by uuid not null references public.profiles(id));
  create table public.programme_shares (id uuid primary key default gen_random_uuid(), programme_id uuid not null references public.programmes(id), house_number integer not null references public.houses(house_number));

  -- production's helpers and trigger, exactly as deployed before this migration
  create function app_private.is_admin() returns boolean language sql stable security definer set search_path to '' as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'); $$;
  create function app_private.is_current_resident_of(p_house_number integer) returns boolean language sql stable security definer set search_path to '' as $$ select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'resident' and p.house_number = p_house_number); $$;
  create function app_private.protect_profile_authorization_fields() returns trigger language plpgsql security definer set search_path to '' as $$
  begin
    if old.id = (select auth.uid()) and not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
       and (new.role is distinct from old.role or new.house_number is distinct from old.house_number) then
      raise exception 'Residents cannot change their role or house assignment' using errcode = '42501';
    end if;
    return new;
  end; $$;
  create trigger protect_profile_authorization_fields before update on public.profiles for each row execute function app_private.protect_profile_authorization_fields();
  alter table public.profiles enable row level security;
  create policy profiles_read_self_or_admin on public.profiles for select to authenticated using ((id = (select auth.uid())) or (select app_private.is_admin()));
  create policy profiles_update_self_or_admin on public.profiles for update to authenticated using ((id = (select auth.uid())) or (select app_private.is_admin())) with check ((id = (select auth.uid())) or (select app_private.is_admin()));

  -- production's policies on the tables this migration touches
  do $p$ declare t text; begin
    foreach t in array array['navratri_seasons','navratri_households','navratri_contributions','navratri_refunds','navratri_tokens','navratri_expenses','notices','meetings','maintenance_charges','programmes','programme_shares','audit_log'] loop
      execute format('alter table public.%I enable row level security', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    end loop;
  end $p$;
  create policy navratri_seasons_admin_write on public.navratri_seasons for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
  create policy navratri_seasons_read on public.navratri_seasons for select to authenticated using ((select app_private.is_admin()) or status in ('active','closed'));
  create policy navratri_households_admin_write on public.navratri_households for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
  create policy navratri_households_read on public.navratri_households for select to authenticated using ((select app_private.is_admin()) or house_number = (select house_number from public.profiles where id = (select auth.uid())));
  create policy navratri_contributions_admin_write on public.navratri_contributions for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
  create policy navratri_contributions_read on public.navratri_contributions for select to authenticated using ((select app_private.is_admin()) or exists (select 1 from public.navratri_households h join public.profiles p on p.house_number = h.house_number where h.id = household_id and p.id = (select auth.uid())));
  create policy navratri_refunds_admin_write on public.navratri_refunds for all using (app_private.is_admin()) with check (app_private.is_admin());
  create policy navratri_refunds_read on public.navratri_refunds for select using ((select app_private.is_admin()) or exists (select 1 from public.navratri_households h join public.profiles p on p.house_number = h.house_number where h.id = household_id and p.id = (select auth.uid())));
  create policy navratri_tokens_admin_write on public.navratri_tokens for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
  create policy navratri_tokens_read on public.navratri_tokens for select to authenticated using ((select app_private.is_admin()) or house_number = (select house_number from public.profiles where id = (select auth.uid())));
  create policy navratri_expenses_admin_only on public.navratri_expenses for all to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
  create policy notices_admin_delete on public.notices for delete to authenticated using ((select app_private.is_admin()));
  create policy notices_admin_insert on public.notices for insert to authenticated with check ((select app_private.is_admin()) and created_by = (select auth.uid()));
  create policy notices_read on public.notices for select to authenticated using (status = 'published' or (select app_private.is_admin()));
  create policy meetings_admin_delete on public.meetings for delete to authenticated using ((select app_private.is_admin()));
  create policy meetings_read on public.meetings for select to authenticated using (true);
  create policy maintenance_charges_admin_delete on public.maintenance_charges for delete to authenticated using ((select app_private.is_admin()));
  create policy maintenance_charges_read on public.maintenance_charges for select to authenticated using (true);
  create policy programmes_admin_delete on public.programmes for delete to authenticated using ((select app_private.is_admin()));
  create policy programmes_read on public.programmes for select to authenticated using (true);
  create policy programme_shares_admin_delete on public.programme_shares for delete to authenticated using ((select app_private.is_admin()));
  create policy programme_shares_read on public.programme_shares for select to authenticated using (true);
  create policy audit_read_admin_only on public.audit_log for select to authenticated using ((select app_private.is_admin()));
  grant select, insert, update, delete on public.profiles, public.houses to authenticated;
  grant usage on schema public, auth to anon, authenticated; grant usage on schema app_private to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function app_private.is_admin(), app_private.is_current_resident_of(integer) to authenticated;

  insert into auth.users values ('${SUPER}'), ('${ADMIN2}'), ('${RES33}'), ('${RES34}');
  insert into public.profiles (id, display_name, role, house_number, created_at) values
    ('${SUPER}', 'Society Administrator', 'admin', null, now() - interval '3 day'),
    ('${ADMIN2}', 'Second Admin', 'admin', null, now() - interval '1 day'),
    ('${RES33}', 'R33', 'resident', 33, now()), ('${RES34}', 'R34', 'resident', 34, now());
  insert into public.navratri_seasons (id, starts_on, ends_on, status, created_by) values ('11111111-1111-1111-1111-111111111111', '2026-10-11', '2026-10-20', 'active', '${SUPER}');
  insert into public.navratri_households (id, season_id, house_number, participant_count, contribution_per_person_paise) values
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 33, 2, 60000),
    ('34343434-3434-3434-3434-343434343434', '11111111-1111-1111-1111-111111111111', 34, 3, 60000);
`);

async function as(uid, fn) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid || ''}', false)`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const q = (s, p) => db.query(s, p).then(r => r.rows);
const err = async fn => { try { await fn(); return null; } catch (e) { return e.message; } };
const rows = async (uid, s, p) => as(uid, () => q(s, p));

await db.exec(migration); await db.exec(migration);
ok(true, 'migration applies on a production-like database, twice, without errors');

// ---------- who is who ----------
const flags = Object.fromEntries((await q(`select id, is_super, is_active from public.profiles`)).map(x => [x.id, x]));
ok(flags[SUPER].is_super && !flags[ADMIN2].is_super && !flags[RES33].is_super, 'the original administrator became super admin; the second admin and residents did not');
ok(flags[SUPER].is_active && flags[ADMIN2].is_active, 'everyone starts active');
ok((await err(() => q(`update public.profiles set is_super = true where id = '${RES33}'`))) !== null, 'a resident can never be marked super (only admins)');

// ---------- profile protection ----------
ok((await err(() => as(ADMIN2, () => q(`update public.profiles set is_super = true where id = '${ADMIN2}'`)))).includes('super admin'), 'a normal admin cannot make themselves super admin');
ok((await err(() => as(ADMIN2, () => q(`update public.profiles set is_active = false where id = '${SUPER}'`)))).includes('super admin'), 'a normal admin cannot deactivate the super admin');
ok((await err(() => as(ADMIN2, () => q(`update public.profiles set display_name = 'Hacked' where id = '${SUPER}'`)))).includes('another admin account'), 'a normal admin cannot edit the super admin account');
ok((await err(() => as(ADMIN2, () => q(`update public.profiles set is_active = false where id = '${RES33}'`)))).includes('super admin'), 'a normal admin cannot change account status of anyone');
await as(ADMIN2, () => q(`update public.profiles set display_name = 'Second Admin Edited' where id = '${ADMIN2}'`));
ok((await q(`select display_name from public.profiles where id = '${ADMIN2}'`))[0].display_name === 'Second Admin Edited', 'an admin can still edit their own name');
await as(ADMIN2, () => q(`update public.profiles set display_name = 'R33 by admin', contact_phone = '9876543210' where id = '${RES33}'`));
ok((await q(`select display_name from public.profiles where id = '${RES33}'`))[0].display_name === 'R33 by admin', 'an admin can still edit a resident (name, phone)');
await as(RES33, () => q(`update public.profiles set display_name = 'Mine', contact_phone = '9000000000', preferred_language = 'en' where id = '${RES33}'`));
ok((await q(`select display_name, preferred_language from public.profiles where id = '${RES33}'`))[0].display_name === 'Mine', 'a resident can edit their own name, phone and language');
ok((await err(() => as(RES33, () => q(`update public.profiles set house_number = 40 where id = '${RES33}'`)))) !== null, 'a resident cannot change their house');
ok((await err(() => as(RES33, () => q(`update public.profiles set is_active = false where id = '${RES33}'`)))).includes('super admin'), 'a resident cannot change their own status');
ok((await rows(RES33, `update public.profiles set display_name = 'x' where id = '${RES34}' returning id`)).length === 0, 'a resident cannot edit another resident');

// super admin powers
await as(SUPER, () => q(`update public.profiles set is_active = false where id = '${ADMIN2}'`));
ok((await rows(ADMIN2, `select app_private.is_admin() a`))[0].a === false, 'a deactivated admin immediately stops being an admin');
ok((await err(() => as(ADMIN2, () => q(`insert into public.navratri_contributions (household_id, amount_paise, received_by) values ('33333333-3333-3333-3333-333333333333', 100, '${ADMIN2}')`)))) !== null, 'a deactivated admin cannot record payments any more');
await as(SUPER, () => q(`update public.profiles set is_active = true where id = '${ADMIN2}'`));
ok((await rows(ADMIN2, `select app_private.is_admin() a`))[0].a === true, 'the super admin can reactivate an admin');
ok((await err(() => as(SUPER, () => q(`update public.profiles set is_active = false where id = '${SUPER}'`)))).includes('own role'), 'the super admin cannot lock themselves out');
ok((await err(() => as(SUPER, () => q(`update public.profiles set is_super = false where id = '${SUPER}'`)))).includes('own role'), 'the super admin cannot demote themselves');
await as(SUPER, () => q(`update public.profiles set is_super = true where id = '${ADMIN2}'`));
ok((await rows(SUPER, `select is_super from public.profiles where id = '${ADMIN2}'`))[0].is_super === true, 'the super admin can make another admin a super admin');
await as(SUPER, () => q(`update public.profiles set is_super = false where id = '${ADMIN2}'`));
ok((await rows(ADMIN2, `select app_private.is_super() s`))[0].s === false, 'and take it back');
ok((await err(() => as(SUPER, () => q(`update public.profiles set role = 'resident' where id = '${ADMIN2}'`)))) !== null, 'an admin cannot be turned into a resident (database rule: admins have no house)');

// ---------- day-to-day vs permanent deletes ----------
await as(ADMIN2, () => q(`insert into public.navratri_contributions (id, household_id, amount_paise, received_by) values ('c0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 1200, '${ADMIN2}')`));
await as(ADMIN2, () => q(`update public.navratri_contributions set reference_note = 'ok' where id = 'c0000000-0000-0000-0000-000000000001'`));
ok((await q(`select reference_note from public.navratri_contributions where id = 'c0000000-0000-0000-0000-000000000001'`))[0].reference_note === 'ok', 'an admin can record and correct a payment');
ok((await rows(ADMIN2, `delete from public.navratri_contributions where id = 'c0000000-0000-0000-0000-000000000001' returning id`)).length === 0, 'an admin cannot delete a payment for good');
await as(ADMIN2, () => q(`insert into public.navratri_refunds (id, household_id, amount_paise, refunded_by) values ('f0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 100, '${ADMIN2}')`));
ok((await rows(ADMIN2, `delete from public.navratri_refunds where id = 'f0000000-0000-0000-0000-000000000001' returning id`)).length === 0, 'an admin cannot delete a refund');
ok((await rows(ADMIN2, `delete from public.navratri_seasons returning id`)).length === 0, 'an admin cannot delete a season');
ok((await rows(ADMIN2, `delete from public.navratri_households returning id`)).length === 0, 'an admin cannot delete households');
await as(ADMIN2, () => q(`insert into public.navratri_tokens (id, season_id, house_number, token_date, member_label) values ('70000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 33, '2026-10-12', 'x')`));
ok((await rows(ADMIN2, `delete from public.navratri_tokens where id = '70000000-0000-0000-0000-000000000001' returning id`)).length === 1, 'an admin can still remove a mistaken token');
await as(ADMIN2, () => q(`insert into public.navratri_expenses (id, season_id, category, description, amount_paise, created_by) values ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'snacks', 'Tea', 100, '${ADMIN2}')`));
ok((await rows(ADMIN2, `delete from public.navratri_expenses where id = 'e0000000-0000-0000-0000-000000000001' returning id`)).length === 1, 'an admin can still remove a mistaken expense');
await as(ADMIN2, () => q(`update public.navratri_seasons set status = 'closed' where id = '11111111-1111-1111-1111-111111111111'`));
await as(ADMIN2, () => q(`update public.navratri_seasons set status = 'active' where id = '11111111-1111-1111-1111-111111111111'`));
ok((await q(`select status from public.navratri_seasons`))[0].status === 'active', 'an admin can still close and reopen a season');
await as(ADMIN2, () => q(`insert into public.notices (id, title_en, body_en, created_by) values ('b0000000-0000-0000-0000-000000000001', 'Hi', 'Body', '${ADMIN2}')`));
ok((await rows(ADMIN2, `delete from public.notices returning id`)).length === 0, 'an admin can publish a notice but cannot delete notices');
ok((await rows(SUPER, `delete from public.notices returning id`)).length === 1, 'the super admin can delete a notice');
ok((await rows(SUPER, `delete from public.navratri_refunds where id = 'f0000000-0000-0000-0000-000000000001' returning id`)).length === 1, 'the super admin can delete a refund');
ok((await rows(SUPER, `delete from public.navratri_contributions where id = 'c0000000-0000-0000-0000-000000000001' returning id`)).length === 1, 'the super admin can delete a payment');
ok((await rows(RES33, `select id from public.navratri_households`)).length === 1 && (await rows(RES33, `select id from public.navratri_contributions`)).length === 0, 'a resident still sees only their own house festival data');

// ---------- contacts ----------
await as(ADMIN2, () => q(`insert into public.useful_contacts (category, name, phone, created_by) values ('plumber', 'Ramesh Plumber', '9876500001', '${ADMIN2}'), ('mistri', 'Old Mistri', '9876500002', '${ADMIN2}')`));
await as(ADMIN2, () => q(`update public.useful_contacts set is_active = false where name = 'Old Mistri'`));
ok((await rows(RES33, `select name from public.useful_contacts`)).length === 1, 'residents see active contacts only');
ok((await rows(ADMIN2, `select name from public.useful_contacts`)).length === 2, 'admins also see inactive contacts');
ok((await err(() => as(RES33, () => q(`insert into public.useful_contacts (category, name, phone, created_by) values ('plumber', 'Spam', '99999', '${RES33}')`)))) !== null, 'a resident cannot add a contact');
ok((await rows(RES33, `update public.useful_contacts set phone = '1' returning id`)).length === 0, 'a resident cannot edit a contact');
ok((await rows(RES33, `delete from public.useful_contacts returning id`)).length === 0, 'a resident cannot delete a contact');
ok((await err(() => as(null, () => q(`select * from public.useful_contacts`)))) !== null, 'signed-out visitors cannot read contacts');
ok((await err(() => as(ADMIN2, () => q(`insert into public.useful_contacts (category, name, phone, created_by) values ('robber', 'X', '123456', '${ADMIN2}')`)))) !== null, 'unknown categories are rejected');
ok((await err(() => as(ADMIN2, () => q(`insert into public.useful_contacts (category, name, phone, created_by) values ('plumber', 'X', '1', '${ADMIN2}')`)))) !== null, 'too-short phone numbers are rejected');
ok((await rows(ADMIN2, `delete from public.useful_contacts where name = 'Old Mistri' returning id`)).length === 1, 'an admin can remove a contact');

// ---------- resident updates their own member count ----------
const setCount = (uid, n) => as(uid, () => q(`select public.set_my_member_count($1) r`, [n]));
const hh = async n => (await q(`select participant_count c, is_participating p from public.navratri_households where house_number = ${n}`))[0];
await db.exec(`delete from public.navratri_contributions; delete from public.navratri_refunds;`);
const r1 = (await setCount(RES34, 5))[0].r;
ok((await hh(34)).c === 5 && r1.participant_count === 5 && Number(r1.amount_due_paise) === 5 * 60000, 'a resident sets their members (5 x Rs 600 = Rs 3000 due)');
ok((await hh(33)).c === 2, 'it only ever changes their own house');
ok((await err(() => setCount(RES34, 101))).includes('0 to 100'), 'members must be 0 to 100');
ok((await err(() => setCount(RES34, -1))).includes('0 to 100'), 'negative members are rejected');
ok((await err(() => setCount(ADMIN2, 3))).includes('Only a resident'), 'an admin cannot use the resident function');
ok((await err(() => as(null, () => q(`select public.set_my_member_count(3)`)))) !== null, 'a signed-out visitor cannot call it');
await setCount(RES34, 0);
ok((await hh(34)).p === false, 'zero members marks the house as not participating');
await db.exec(`insert into public.navratri_contributions (household_id, amount_paise, received_by) values ('34343434-3434-3434-3434-343434343434', 100, '${ADMIN2}')`);
ok((await err(() => setCount(RES34, 2))).includes('payment is already recorded'), 'after a payment exists, the resident must ask the administrator');
await db.exec(`delete from public.navratri_contributions; insert into public.navratri_tokens (season_id, house_number, token_date, member_label) values ('11111111-1111-1111-1111-111111111111', 34, '2026-10-12', 'x')`);
ok((await err(() => setCount(RES34, 2))).includes('Tokens have already been given'), 'after tokens are given, the resident must ask the administrator');
await db.exec(`delete from public.navratri_tokens; update public.navratri_seasons set status = 'closed'`);
ok((await err(() => setCount(RES34, 2))).includes('no active festival'), 'no changes when the festival is not active');
await db.exec(`update public.navratri_seasons set status = 'active'`);
ok((await q(`select count(*)::int c from public.audit_log where action = 'member_count_self_updated'`))[0].c === 2, 'each self-service change is written to the audit log');

// ---------- exposure ----------
ok((await q(`select has_function_privilege('anon','public.set_my_member_count(integer)','execute') a, has_function_privilege('authenticated','public.set_my_member_count(integer)','execute') b, has_function_privilege('anon','app_private.is_super()','execute') c`))[0].a === false, 'signed-out visitors cannot execute the new functions');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
