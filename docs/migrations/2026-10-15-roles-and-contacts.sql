-- Roles (super admin / admin / user), shared contacts, resident self-service member count.
-- Built on production's existing design: role enum account_role (admin|resident), app_private.is_admin(),
-- audit_log, and the profile protection trigger. Idempotent: safe to re-run.
--
-- ROLES
--   super admin = profiles.role 'admin' AND is_super   -> everything, incl. admin accounts and permanent deletes
--   admin       = profiles.role 'admin'                 -> day-to-day management; cannot touch admin accounts or delete for good
--   user        = profiles.role 'resident'              -> sees what is going on, manages own house details
-- "Removing" an admin = deactivating the account (is_active = false). It keeps history and can be undone.
-- (profile_role_house_consistency forces admins to have no house, so demoting an admin to a resident is not possible.)

-- ---------- 1. profile flags ----------
alter table public.profiles add column if not exists is_super boolean not null default false;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles drop constraint if exists profile_super_only_admin;
alter table public.profiles add constraint profile_super_only_admin check (not is_super or role = 'admin');

-- ---------- 2. helpers ----------
-- An inactive admin loses all admin power immediately, even with a still-valid session.
create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;

create or replace function app_private.is_super()
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_super and p.is_active
  );
$$;
revoke all on function app_private.is_super() from public, anon;
grant execute on function app_private.is_super() to authenticated;

-- ---------- 3. first super admin = the existing administrator (only if there is none yet) ----------
update public.profiles set is_super = true
where id = (select id from public.profiles where role = 'admin' order by created_at, id limit 1)
  and not exists (select 1 from public.profiles where is_super);

-- ---------- 4. protect roles on profiles (replaces the body of the existing trigger function) ----------
create or replace function app_private.protect_profile_authorization_fields()
returns trigger language plpgsql security definer set search_path to '' as $$
declare caller uuid := (select auth.uid());
begin
  -- server-side calls (Edge Functions with the service key, migrations) have no signed-in user
  if caller is null then return new; end if;
  -- role, super flag, active flag: only the super admin, and never on their own account
  if new.role is distinct from old.role or new.is_super is distinct from old.is_super or new.is_active is distinct from old.is_active then
    if not app_private.is_super() then
      raise exception 'Only the super admin can change roles or account status' using errcode = '42501';
    end if;
    if old.id = caller then
      raise exception 'You cannot change your own role or account status' using errcode = '42501';
    end if;
  end if;
  -- house assignment: admins only (residents can never move themselves)
  if new.house_number is distinct from old.house_number and not app_private.is_admin() then
    raise exception 'Residents cannot change their role or house assignment' using errcode = '42501';
  end if;
  -- admin accounts can only be changed by their owner or the super admin
  if old.role = 'admin' and old.id <> caller and not app_private.is_super() then
    raise exception 'Only the super admin can change another admin account' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------- 5. permanent deletes become super-admin only ----------
-- Admins keep insert + update (they record and correct); only the super admin may delete for good.
-- Tokens and daily expenses stay fully manageable by admins (day-to-day corrections).
do $$
declare t text;
begin
  foreach t in array array['navratri_contributions', 'navratri_households', 'navratri_seasons', 'navratri_refunds'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_super_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select app_private.is_admin()))', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()))', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app_private.is_super()))', t || '_super_delete', t);
  end loop;
  foreach t in array array['notices', 'meetings', 'maintenance_charges'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app_private.is_super()))', t || '_admin_delete', t);
  end loop;
  execute 'drop policy if exists programmes_admin_delete on public.programmes';
  execute 'create policy programmes_admin_delete on public.programmes for delete to authenticated using ((select app_private.is_super()))';
  execute 'drop policy if exists programme_shares_admin_delete on public.programme_shares';
  execute 'create policy programme_shares_admin_delete on public.programme_shares for delete to authenticated using ((select app_private.is_super()))';
end $$;

-- ---------- 6. shared contacts (plumber, mistri, electrician, election, ...) ----------
create table if not exists public.useful_contacts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('plumber', 'electrician', 'mistri', 'carpenter', 'painter', 'doctor', 'ambulance', 'police', 'fire', 'election', 'society_office', 'other')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  phone text not null check (char_length(btrim(phone)) between 5 and 30),
  note text check (note is null or char_length(note) <= 300),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists useful_contacts_category_idx on public.useful_contacts (category, sort_order);
create index if not exists useful_contacts_created_by_idx on public.useful_contacts (created_by);
alter table public.useful_contacts enable row level security;
revoke all on public.useful_contacts from anon;
grant select, insert, update, delete on public.useful_contacts to authenticated;

drop policy if exists useful_contacts_select on public.useful_contacts;
create policy useful_contacts_select on public.useful_contacts for select to authenticated
  using (is_active or (select app_private.is_admin()));
drop policy if exists useful_contacts_insert on public.useful_contacts;
create policy useful_contacts_insert on public.useful_contacts for insert to authenticated
  with check ((select app_private.is_admin()) and created_by = (select auth.uid()));
drop policy if exists useful_contacts_update on public.useful_contacts;
create policy useful_contacts_update on public.useful_contacts for update to authenticated
  using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
drop policy if exists useful_contacts_delete on public.useful_contacts;
create policy useful_contacts_delete on public.useful_contacts for delete to authenticated
  using ((select app_private.is_admin()));

-- ---------- 7. resident updates their own festival member count (before any money or token exists) ----------
create or replace function app_private.set_my_member_count(p_count integer)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  caller uuid := (select auth.uid());
  my_house integer;
  sid uuid;
  hh public.navratri_households%rowtype;
begin
  if p_count is null or p_count < 0 or p_count > 100 then raise exception 'Enter a number of members from 0 to 100.'; end if;
  select p.house_number into my_house from public.profiles p
    where p.id = caller and p.role = 'resident' and p.is_active;
  if my_house is null then raise exception 'Only a resident can update their own house members.' using errcode = '42501'; end if;
  select s.id into sid from public.navratri_seasons s where s.status = 'active' order by s.starts_on desc limit 1;
  if sid is null then raise exception 'There is no active festival right now.'; end if;
  select * into hh from public.navratri_households h where h.season_id = sid and h.house_number = my_house for update;
  if not found then raise exception 'Your house is not part of this festival yet. Please ask the administrator.'; end if;
  if exists (select 1 from public.navratri_contributions c where c.household_id = hh.id)
     or exists (select 1 from public.navratri_refunds r where r.household_id = hh.id) then
    raise exception 'A payment is already recorded for your house. Please ask the administrator to change the members.';
  end if;
  if exists (select 1 from public.navratri_tokens t where t.season_id = sid and t.house_number = my_house) then
    raise exception 'Tokens have already been given to your house. Please ask the administrator to change the members.';
  end if;
  update public.navratri_households
    set participant_count = p_count, is_participating = p_count > 0, updated_at = now()
    where id = hh.id;
  insert into public.audit_log (actor_id, action, entity_type, entity_id, details)
  values (caller, 'member_count_self_updated', 'household', hh.id,
          jsonb_build_object('house_number', my_house, 'from', hh.participant_count, 'to', p_count));
  return jsonb_build_object('house_number', my_house, 'participant_count', p_count,
                            'amount_due_paise', p_count::bigint * hh.contribution_per_person_paise);
end;
$$;
revoke all on function app_private.set_my_member_count(integer) from public, anon;
grant execute on function app_private.set_my_member_count(integer) to authenticated;

create or replace function public.set_my_member_count(p_count integer)
returns jsonb language sql set search_path to '' as $$ select app_private.set_my_member_count(p_count); $$;
revoke all on function public.set_my_member_count(integer) from public, anon;
grant execute on function public.set_my_member_count(integer) to authenticated;
