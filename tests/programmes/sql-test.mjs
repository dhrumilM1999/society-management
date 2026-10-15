// Runs docs/migrations/2026-10-13-programmes.sql on an in-memory Postgres (PGlite) and checks the
// split maths, atomic finalize, payments and row-level security for admin vs resident vs anonymous.
//   npm i --no-save @electric-sql/pglite && node tests/programmes/sql-test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const sql = fs.readFileSync(new URL('../../docs/migrations/2026-10-13-programmes.sql', import.meta.url), 'utf8');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const db = new PGlite();
const ADMIN = '00000000-0000-0000-0000-0000000000a1', R33 = '00000000-0000-0000-0000-000000000033', R34 = '00000000-0000-0000-0000-000000000034';

// Stand-ins for Supabase's own objects, copied from how production is built (app_private.is_admin etc.)
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon; create role authenticated;
  create schema app_private;
  create type public.account_role as enum ('admin', 'resident');
  create table public.houses (house_number integer primary key check (house_number between 31 and 49), is_active boolean not null default true);
  insert into public.houses (house_number) select generate_series(31, 49);
  create table public.profiles (id uuid primary key references auth.users(id), display_name text, role public.account_role not null default 'resident', house_number integer unique references public.houses(house_number));
  alter table public.profiles enable row level security;
  create table public.audit_log (id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
  alter table public.audit_log enable row level security;
  grant select on public.audit_log to authenticated;
  grant select on public.profiles, public.houses to authenticated;
  create function app_private.is_admin() returns boolean language sql stable security definer set search_path to '' as $$
    select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin') $$;
  create function app_private.is_current_resident_of(p_house_number integer) returns boolean language sql stable security definer set search_path to '' as $$
    select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'resident' and p.house_number = p_house_number) $$;
  grant usage on schema public, auth to anon, authenticated;
  create policy audit_read_admin_only on public.audit_log for select to authenticated using ((select app_private.is_admin()));
  grant usage on schema app_private to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant execute on function app_private.is_admin(), app_private.is_current_resident_of(integer) to authenticated;
  insert into auth.users values ('${ADMIN}'), ('${R33}'), ('${R34}');
  insert into public.profiles values ('${ADMIN}', 'Admin', 'admin', null), ('${R33}', 'R33', 'resident', 33), ('${R34}', 'R34', 'resident', 34);
`);
await db.exec(sql);
await db.exec(sql); // idempotent: running twice must not fail
ok(true, 'migration runs, and runs again without errors');

async function as(uid, fn) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid || ''}', false)`);
  try { return await fn(); } finally { await db.exec('reset role'); }
}
const q = (s, p) => db.query(s, p).then(r => r.rows);
const fails_ = async (fn) => { try { await fn(); return null; } catch (e) { return e.message; } };

// ---------- admin builds a programme ----------
const newProg = async (method, title = 'Garba night') => as(ADMIN, async () =>
  (await q(`insert into public.prog_programmes (title_en, held_on, split_method, created_by) values ($1, '2026-10-20', $2, $3) returning id`, [title, method, ADMIN]))[0].id);
const addExp = (pid, amt) => as(ADMIN, () => q(`insert into public.prog_expenses (programme_id, description, amount_paise) values ($1, 'Sound', $2)`, [pid, amt]));
const setAtt = (pid, house, n) => as(ADMIN, () => q(`insert into public.prog_attendance values ($1, $2, $3) on conflict (programme_id, house_number) do update set attendees = excluded.attendees`, [pid, house, n]));
const shares = pid => as(ADMIN, () => q(`select house_number, share_paise::int as s from public.prog_shares where programme_id = $1 order by house_number`, [pid]));
const finalize = pid => as(ADMIN, () => q(`select public.prog_finalize($1) as r`, [pid]));

// equal_houses: 100.00 over 19 houses -> shares add up to exactly 10000 paise
let p1 = await newProg('equal_houses'); await addExp(p1, 10000);
await finalize(p1);
let sh = await shares(p1);
ok(sh.length === 19 && sh.reduce((n, x) => n + x.s, 0) === 10000, 'equal split: 19 houses, shares add up to exactly the total');
ok(Math.max(...sh.map(x => x.s)) - Math.min(...sh.map(x => x.s)) === 1 && sh[0].s === 527 && sh[18].s === 526, 'rounding leftover paise go to the lowest house numbers (527 ... 526)');
ok((await q(`select status, total_paise::int t from public.prog_programmes where id = $1`, [p1]))[0].status === 'finalized', 'programme becomes finalized with its total');

// per_attendee: weights 1:2:3 over 6001 paise
let p2 = await newProg('per_attendee'); await addExp(p2, 6001);
await setAtt(p2, 31, 1); await setAtt(p2, 32, 2); await setAtt(p2, 40, 3);
await finalize(p2); sh = await shares(p2);
ok(sh.length === 3 && sh.reduce((n, x) => n + x.s, 0) === 6001, 'per-attendee split only includes attending houses and adds up exactly');
ok(sh[0].s <= sh[1].s && sh[1].s < sh[2].s, 'more attendees pay more (' + sh.map(x => x.house_number + ':' + x.s).join(', ') + ')');

// attending_houses: equal among houses with attendees > 0 (house 33 has 0)
let p3 = await newProg('attending_houses'); await addExp(p3, 1000);
await setAtt(p3, 31, 4); await setAtt(p3, 33, 0); await setAtt(p3, 35, 1);
await finalize(p3); sh = await shares(p3);
ok(sh.length === 2 && sh[0].s === 500 && sh[1].s === 500 && !sh.some(x => x.house_number === 33), 'attending-houses split ignores houses with 0 attendees');

// ---------- safety rules ----------
let p4 = await newProg('per_attendee');
ok((await as(ADMIN, () => fails_(() => q(`select public.prog_finalize($1)`, [p4])))).includes('at least one expense'), 'cannot finalize with no expenses');
await addExp(p4, 500);
ok((await as(ADMIN, () => fails_(() => q(`select public.prog_finalize($1)`, [p4])))).includes('No house is marked as attending'), 'cannot finalize when nobody attended (per attendee)');
ok((await as(ADMIN, () => fails_(() => q(`select public.prog_finalize($1)`, [p1])))).includes('already finalized'), 'cannot finalize twice');
ok((await q(`select count(*)::int c from public.prog_shares where programme_id = $1`, [p4]))[0].c === 0, 'failed finalize leaves no partial shares');
ok((await as(R33, () => fails_(() => q(`select public.prog_finalize($1)`, [p4])))).includes('Only an administrator'), 'resident cannot finalize');
ok((await as(null, () => fails_(() => q(`select public.prog_finalize($1)`, [p4])))) !== null, 'anonymous cannot call finalize');

// finalized data is frozen
ok((await as(ADMIN, () => fails_(() => q(`insert into public.prog_expenses (programme_id, description, amount_paise) values ($1, 'Late', 100)`, [p1])))) !== null, 'cannot add an expense to a finalized programme');
ok((await as(ADMIN, async () => (await q(`update public.prog_programmes set title_en = 'Hacked' where id = $1 returning id`, [p1])).length)) === 0, 'cannot edit a finalized programme');
ok((await as(ADMIN, async () => (await q(`delete from public.prog_programmes where id = $1 returning id`, [p1])).length)) === 0, 'cannot delete a finalized programme');
ok((await as(ADMIN, () => fails_(() => q(`update public.prog_programmes set status = 'finalized' where id = $1`, [p4])))) !== null, 'admin cannot flip a draft to finalized directly');
ok((await as(ADMIN, () => fails_(() => q(`insert into public.prog_shares values ($1, 31, 10, 0)`, [p4])))) !== null, 'nobody can write shares directly');

// ---------- visibility ----------
ok((await as(R33, () => q(`select id from public.prog_programmes`))).length === 3, 'resident sees finalized programmes only (3, not the draft)');
ok((await as(ADMIN, () => q(`select id from public.prog_programmes`))).length === 4, 'admin sees drafts too');
const r33 = await as(R33, () => q(`select house_number from public.prog_shares`));
ok(r33.length === 1 && r33[0].house_number === 33, 'resident sees only their own house share row (house 33 is only in the equal split)');
ok((await as(R34, () => q(`select house_number from public.prog_shares`))).every(x => x.house_number === 34), 'house 34 cannot see other houses\' shares');
ok((await as(R33, () => q(`select id from public.prog_expenses where programme_id = $1`, [p4]))).length === 0, 'resident cannot read expenses of a draft');
ok((await as(R33, () => q(`select id from public.prog_expenses where programme_id = $1`, [p1]))).length === 1, 'resident can read expenses of a finalized programme');
ok((await as(null, () => fails_(() => q(`select * from public.prog_programmes`)))) !== null, 'anonymous cannot read programmes');
ok((await as(R33, () => fails_(() => q(`insert into public.prog_programmes (title_en, held_on, created_by) values ('x1', '2026-10-20', $1)`, [R33])))) !== null, 'resident cannot create a programme');

// ---------- payments ----------
const payRaw = (pid, h, amt) => q(`select public.prog_record_payment($1, $2, $3) as r`, [pid, h, amt]);
const pay = (pid, h, amt) => as(ADMIN, () => payRaw(pid, h, amt));
await pay(p1, 31, 300);
ok((await q(`select paid_paise::int p from public.prog_shares where programme_id = $1 and house_number = 31`, [p1]))[0].p === 300, 'payment recorded against a house share');
ok((await as(ADMIN, () => fails_(() => payRaw(p1, 31, 10000)))).includes('more than the pending'), 'cannot pay more than the share');
await pay(p1, 31, -100);
ok((await q(`select paid_paise::int p from public.prog_shares where programme_id = $1 and house_number = 31`, [p1]))[0].p === 200, 'a negative amount corrects a mistaken payment');
ok((await as(ADMIN, () => fails_(() => payRaw(p1, 31, -1000)))).includes('more than what was paid'), 'cannot reverse more than was paid');
ok((await as(R33, () => fails_(() => payRaw(p1, 33, 100)))).includes('Only an administrator'), 'resident cannot record a payment');
ok((await as(ADMIN, () => fails_(() => payRaw(p1, 50, 100)))).includes('no share'), 'payment for a house without a share is rejected');

// ---------- reopen ----------
ok((await as(ADMIN, () => fails_(() => q(`select public.prog_reopen($1)`, [p1])))).includes('Payments are already recorded'), 'cannot reopen while payments exist');
await pay(p1, 31, -200);
await as(ADMIN, () => q(`select public.prog_reopen($1)`, [p1]));
ok((await q(`select status from public.prog_programmes where id = $1`, [p1]))[0].status === 'draft' && (await shares(p1)).length === 0, 'reopen returns to draft and clears shares');
await addExp(p1, 5000); await finalize(p1);
ok((await shares(p1)).reduce((n, x) => n + x.s, 0) === 15000, 'after reopening, a corrected expense list re-finalizes to the new total (15000)');

// ---------- audit trail ----------
const aud = (await q(`select action from public.audit_log order by id`)).map(x => x.action);
ok(aud.includes('programme_finalized') && aud.includes('programme_share_paid') && aud.includes('programme_share_payment_reversed') && aud.includes('programme_reopened'), 'finalize, payment, reversal and reopen are all written to the audit log');
ok((await as(R33, () => q(`select count(*)::int c from public.audit_log`)))[0].c === 0, 'residents cannot read the audit log');
ok((await as(ADMIN, () => q(`select count(*)::int c from public.audit_log`)))[0].c >= 4, 'admins can read the audit log');

// ---------- constraints ----------
ok((await as(ADMIN, () => fails_(() => q(`insert into public.prog_attendance values ($1, 55, 1)`, [p4])))) !== null, 'house numbers outside 31-49 are rejected');
ok((await as(ADMIN, () => fails_(() => q(`insert into public.prog_expenses (programme_id, description, amount_paise) values ($1, 'Zero', 0)`, [p4])))) !== null, 'zero or negative expense amounts are rejected');
ok((await as(ADMIN, () => fails_(() => q(`insert into public.prog_programmes (title_en, held_on, split_method, created_by) values ('Ok title', '2026-10-20', 'random', $1)`, [ADMIN])))) !== null, 'unknown split method is rejected');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
