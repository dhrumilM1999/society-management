-- Programmes & expense sharing (self-contained module, additive: creates new prog_* tables only).
-- Follows the conventions already used in production: app_private.* holds the privileged logic,
-- thin public.* wrappers are what the app calls, admin checks use app_private.is_admin(), and every
-- money action is written to public.audit_log.
-- Safe to re-run: every statement is idempotent.
--
-- Model
--   prog_programmes  one event (title, date, how its cost is split, draft/finalized)
--   prog_expenses    what was spent on it (editable only while the programme is a draft)
--   prog_attendance  how many people each house sent (draft only; used by two split methods)
--   prog_shares      each house's share + what it has paid; written ONLY by prog_finalize / prog_record_payment
-- Split methods
--   equal_houses      all 19 houses pay the same
--   attending_houses  only houses with at least 1 attendee, equal amounts
--   per_attendee      proportional to the number of attendees
-- Money is stored in paise. Rounding left-overs (a few paise) go to the lowest house numbers,
-- so the shares always add up to exactly the total.

create table if not exists public.prog_programmes (
  id uuid primary key default gen_random_uuid(),
  title_en text not null check (char_length(btrim(title_en)) between 2 and 160),
  title_gu text check (title_gu is null or char_length(title_gu) <= 160),
  details text check (details is null or char_length(details) <= 2000),
  held_on date not null,
  split_method text not null default 'equal_houses'
    check (split_method in ('equal_houses', 'attending_houses', 'per_attendee')),
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  total_paise bigint check (total_paise is null or total_paise > 0),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

create table if not exists public.prog_expenses (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.prog_programmes (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount_paise bigint not null check (amount_paise > 0),
  paid_from text not null default 'main_society_fund'
    check (paid_from in ('main_society_fund', 'navratri_contributions')),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.prog_attendance (
  programme_id uuid not null references public.prog_programmes (id) on delete cascade,
  house_number integer not null references public.houses (house_number),
  attendees integer not null default 0 check (attendees between 0 and 100),
  primary key (programme_id, house_number)
);

create table if not exists public.prog_shares (
  programme_id uuid not null references public.prog_programmes (id) on delete cascade,
  house_number integer not null references public.houses (house_number),
  share_paise bigint not null check (share_paise >= 0),
  paid_paise bigint not null default 0,
  primary key (programme_id, house_number),
  check (paid_paise >= 0 and paid_paise <= share_paise)
);

create index if not exists prog_expenses_programme_idx on public.prog_expenses (programme_id);
create index if not exists prog_programmes_held_on_idx on public.prog_programmes (held_on desc);
create index if not exists prog_programmes_created_by_idx on public.prog_programmes (created_by);
create index if not exists prog_attendance_house_idx on public.prog_attendance (house_number);
create index if not exists prog_shares_house_idx on public.prog_shares (house_number);

-- ---------- row level security ----------
alter table public.prog_programmes enable row level security;
alter table public.prog_expenses enable row level security;
alter table public.prog_attendance enable row level security;
alter table public.prog_shares enable row level security;

revoke all on public.prog_programmes, public.prog_expenses, public.prog_attendance, public.prog_shares from anon;
grant select, insert, update, delete on public.prog_programmes, public.prog_expenses, public.prog_attendance to authenticated;
grant select on public.prog_shares to authenticated;

-- programmes: everyone signed in sees finalized ones; admins see drafts too and edit only drafts
drop policy if exists prog_programmes_select on public.prog_programmes;
create policy prog_programmes_select on public.prog_programmes for select to authenticated
  using ((select app_private.is_admin()) or status = 'finalized');
drop policy if exists prog_programmes_insert on public.prog_programmes;
create policy prog_programmes_insert on public.prog_programmes for insert to authenticated
  with check ((select app_private.is_admin()) and status = 'draft' and created_by = (select auth.uid()));
drop policy if exists prog_programmes_update on public.prog_programmes;
create policy prog_programmes_update on public.prog_programmes for update to authenticated
  using ((select app_private.is_admin()) and status = 'draft')
  with check ((select app_private.is_admin()) and status = 'draft');
drop policy if exists prog_programmes_delete on public.prog_programmes;
create policy prog_programmes_delete on public.prog_programmes for delete to authenticated
  using ((select app_private.is_admin()) and status = 'draft');

-- expenses: readable once finalized (or by admins); writable only while the programme is a draft
drop policy if exists prog_expenses_select on public.prog_expenses;
create policy prog_expenses_select on public.prog_expenses for select to authenticated
  using ((select app_private.is_admin()) or exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'finalized'));
drop policy if exists prog_expenses_insert on public.prog_expenses;
create policy prog_expenses_insert on public.prog_expenses for insert to authenticated
  with check ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));
drop policy if exists prog_expenses_update on public.prog_expenses;
create policy prog_expenses_update on public.prog_expenses for update to authenticated
  using ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'))
  with check ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));
drop policy if exists prog_expenses_delete on public.prog_expenses;
create policy prog_expenses_delete on public.prog_expenses for delete to authenticated
  using ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));

-- attendance: admins edit while draft; a resident sees only their own house's row of a finalized programme
drop policy if exists prog_attendance_select on public.prog_attendance;
create policy prog_attendance_select on public.prog_attendance for select to authenticated
  using ((select app_private.is_admin()) or ((select app_private.is_current_resident_of(house_number))
    and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'finalized')));
drop policy if exists prog_attendance_insert on public.prog_attendance;
create policy prog_attendance_insert on public.prog_attendance for insert to authenticated
  with check ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));
drop policy if exists prog_attendance_update on public.prog_attendance;
create policy prog_attendance_update on public.prog_attendance for update to authenticated
  using ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'))
  with check ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));
drop policy if exists prog_attendance_delete on public.prog_attendance;
create policy prog_attendance_delete on public.prog_attendance for delete to authenticated
  using ((select app_private.is_admin()) and exists (select 1 from public.prog_programmes p where p.id = programme_id and p.status = 'draft'));

-- shares: admins see all; a resident sees only their own house. No client can write: only the functions below.
drop policy if exists prog_shares_select on public.prog_shares;
create policy prog_shares_select on public.prog_shares for select to authenticated
  using ((select app_private.is_admin()) or (select app_private.is_current_resident_of(house_number)));

-- ---------- split / finalize / reopen / payments (logic lives in app_private, like confirm_payment) ----------
create or replace function app_private.prog_weights(p_programme_id uuid, p_method text)
returns table (house_number integer, wt bigint)
language sql stable set search_path = '' as $$
  select h.n,
    case p_method
      when 'equal_houses' then 1
      when 'attending_houses' then case when coalesce(a.attendees, 0) > 0 then 1 else 0 end
      when 'per_attendee' then coalesce(a.attendees, 0)
      else 0
    end::bigint
  from generate_series(31, 49) as h(n)
  left join public.prog_attendance a on a.programme_id = p_programme_id and a.house_number = h.n;
$$;

create or replace function app_private.prog_finalize(p_programme_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  prog public.prog_programmes%rowtype;
  total bigint;
  wsum bigint;
  leftover bigint;
  houses integer;
begin
  if not app_private.is_admin() then raise exception 'Only an administrator can finalize a programme.' using errcode = '42501'; end if;
  select * into prog from public.prog_programmes where id = p_programme_id for update;
  if not found then raise exception 'Programme not found.'; end if;
  if prog.status <> 'draft' then raise exception 'This programme is already finalized.'; end if;

  select coalesce(sum(amount_paise), 0) into total from public.prog_expenses where programme_id = p_programme_id;
  if total <= 0 then raise exception 'Add at least one expense before finalizing.'; end if;

  select coalesce(sum(w.wt), 0) into wsum from app_private.prog_weights(p_programme_id, prog.split_method) w;
  if wsum <= 0 then raise exception 'No house is marked as attending, so the cost cannot be shared.'; end if;

  delete from public.prog_shares where programme_id = p_programme_id;
  insert into public.prog_shares (programme_id, house_number, share_paise)
  select p_programme_id, w.house_number, floor(total::numeric * w.wt / wsum)::bigint
  from app_private.prog_weights(p_programme_id, prog.split_method) w
  where w.wt > 0;

  select total - coalesce(sum(share_paise), 0) into leftover from public.prog_shares where programme_id = p_programme_id;
  if leftover > 0 then
    update public.prog_shares s set share_paise = s.share_paise + 1
    where s.programme_id = p_programme_id
      and s.house_number in (select house_number from public.prog_shares where programme_id = p_programme_id order by house_number limit leftover);
  end if;

  update public.prog_programmes set status = 'finalized', finalized_at = now(), total_paise = total where id = p_programme_id;
  select count(*) into houses from public.prog_shares where programme_id = p_programme_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'programme_finalized', 'programme', p_programme_id,
          jsonb_build_object('total_paise', total, 'houses', houses, 'split_method', prog.split_method));
  return jsonb_build_object('total_paise', total, 'houses', houses);
end;
$$;

create or replace function app_private.prog_reopen(p_programme_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare prog public.prog_programmes%rowtype;
begin
  if not app_private.is_admin() then raise exception 'Only an administrator can reopen a programme.' using errcode = '42501'; end if;
  select * into prog from public.prog_programmes where id = p_programme_id for update;
  if not found then raise exception 'Programme not found.'; end if;
  if prog.status <> 'finalized' then raise exception 'This programme is not finalized.'; end if;
  if exists (select 1 from public.prog_shares where programme_id = p_programme_id and paid_paise > 0) then
    raise exception 'Payments are already recorded against this programme. Reverse them before reopening.';
  end if;
  delete from public.prog_shares where programme_id = p_programme_id;
  update public.prog_programmes set status = 'draft', finalized_at = null, total_paise = null where id = p_programme_id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'programme_reopened', 'programme', p_programme_id, '{}'::jsonb);
end;
$$;

-- p_amount_paise may be negative to correct a mistake; the paid amount always stays between 0 and the share.
create or replace function app_private.prog_record_payment(p_programme_id uuid, p_house_number integer, p_amount_paise bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare sh public.prog_shares%rowtype;
begin
  if not app_private.is_admin() then raise exception 'Only an administrator can record payments.' using errcode = '42501'; end if;
  if p_amount_paise is null or p_amount_paise = 0 then raise exception 'Enter an amount.'; end if;
  select * into sh from public.prog_shares where programme_id = p_programme_id and house_number = p_house_number for update;
  if not found then raise exception 'This house has no share in this programme.'; end if;
  if sh.paid_paise + p_amount_paise > sh.share_paise then raise exception 'That is more than the pending share.'; end if;
  if sh.paid_paise + p_amount_paise < 0 then raise exception 'That is more than what was paid.'; end if;
  update public.prog_shares set paid_paise = paid_paise + p_amount_paise
    where programme_id = p_programme_id and house_number = p_house_number;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), case when p_amount_paise > 0 then 'programme_share_paid' else 'programme_share_payment_reversed' end,
          'programme', p_programme_id, jsonb_build_object('house_number', p_house_number, 'amount_paise', p_amount_paise));
  return sh.paid_paise + p_amount_paise;
end;
$$;

-- thin public wrappers: what the app calls (same pattern as public.confirm_payment)
create or replace function public.prog_finalize(p_programme_id uuid)
returns jsonb language sql set search_path = '' as $$ select app_private.prog_finalize(p_programme_id); $$;
create or replace function public.prog_reopen(p_programme_id uuid)
returns void language sql set search_path = '' as $$ select app_private.prog_reopen(p_programme_id); $$;
create or replace function public.prog_record_payment(p_programme_id uuid, p_house_number integer, p_amount_paise bigint)
returns bigint language sql set search_path = '' as $$ select app_private.prog_record_payment(p_programme_id, p_house_number, p_amount_paise); $$;

revoke all on function app_private.prog_weights(uuid, text), app_private.prog_finalize(uuid), app_private.prog_reopen(uuid), app_private.prog_record_payment(uuid, integer, bigint) from public, anon;
grant execute on function app_private.prog_finalize(uuid), app_private.prog_reopen(uuid), app_private.prog_record_payment(uuid, integer, bigint) to authenticated;
revoke all on function public.prog_finalize(uuid), public.prog_reopen(uuid), public.prog_record_payment(uuid, integer, bigint) from public, anon;
grant execute on function public.prog_finalize(uuid), public.prog_reopen(uuid), public.prog_record_payment(uuid, integer, bigint) to authenticated;
