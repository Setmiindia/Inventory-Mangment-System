-- Identity moves from public.staff_profiles to core.profiles.
-- WHY: the central database already has a shared identity for every Setmi system: core.profiles (one row per login, created
-- by the trigger on_auth_user_created), core.roles and core.user_roles. Inventory had been wired to an older table,
-- public.staff_profiles, so there were two competing "staff" tables and an invited person never got inventory access.
-- After this migration inventory reads the person from core.profiles (name, email, central on/off) and keeps ONLY the
-- inventory rights in inventory.user_access. public.staff_profiles and the old public.customers/orders/products tables are
-- not touched (they belong to an older draft; their future is decided when the CRM is built).
-- Rule for "active": a person can use inventory only when core.profiles.is_active AND inventory.user_access.is_active.

-- 1. Point every inventory "who did it" / "which user" link at core.profiles (the delete rule of each link is kept).
do $$
declare r record; v_rule text;
begin
  for r in
    select c.conrelid::regclass::text as tbl, c.conname, a.attname as col, c.confdeltype
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.confrelid = 'public.staff_profiles'::regclass and c.contype = 'f' and c.connamespace = 'inventory'::regnamespace
  loop
    v_rule := case r.confdeltype when 'c' then ' on delete cascade' when 'n' then ' on delete set null' when 'r' then ' on delete restrict' when 'd' then ' on delete set default' else '' end;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references core.profiles (id)%s', r.tbl, r.conname, r.col, v_rule);
  end loop;
end $$;

-- 2. Every existing central profile gets an (inactive, no-rights) inventory row.
insert into inventory.user_access (user_id) select id from core.profiles on conflict do nothing;

-- 3. The read-only helper view and the permission functions now read core.profiles.
drop view if exists inventory.people;
create view inventory.people as
  select cp.id, cp.email::text as email, cp.full_name, (cp.is_active and ua.is_active) as is_active, ua.is_admin, ua.created_at
    from core.profiles cp
    join inventory.user_access ua on ua.user_id = cp.id;
revoke all on inventory.people from public, anon, authenticated;

create or replace function inventory.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join core.profiles cp on cp.id = ua.user_id
    where ua.user_id = (select auth.uid()) and ua.is_active and cp.is_active and ua.is_admin
  );
$$;

create or replace function inventory.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join core.profiles cp on cp.id = ua.user_id
    where ua.user_id = (select auth.uid())
      and ua.is_active and cp.is_active
      and (ua.is_admin or exists (
        select 1 from inventory.user_permissions up
        where up.user_id = ua.user_id and up.permission_key = p_key))
  );
$$;

create or replace function inventory.can_access_location(p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select inventory.is_admin() or exists (
    select 1 from inventory.user_locations ul
    join inventory.user_access ua on ua.user_id = ul.user_id
    join core.profiles cp on cp.id = ul.user_id
    where ul.user_id = (select auth.uid()) and ul.location_id = p_location and ua.is_active and cp.is_active);
$$;

create or replace function inventory.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join core.profiles cp on cp.id = ua.user_id
    where ua.user_id = (select auth.uid()) and ua.is_active and cp.is_active);
$$;

create or replace function inventory.my_profile()
returns table (email text, full_name text, is_active boolean, is_admin boolean)
language sql stable security definer set search_path = '' as $$
  select cp.email::text, cp.full_name, (cp.is_active and ua.is_active), ua.is_admin
    from core.profiles cp
    join inventory.user_access ua on ua.user_id = cp.id
   where cp.id = (select auth.uid());
$$;

-- 4. A new central profile (made by core.handle_new_user when a login is created) starts the inventory side:
--    an inactive row, and if the email has an OPEN invite the invite is applied at once: the role's permissions, department
--    and places are given, the person is switched on here AND centrally (an invite is an administrator's approval), and the
--    invite is marked used. Without an invite nothing is switched on.
drop trigger if exists inventory_on_staff_created on public.staff_profiles;
create or replace function inventory.handle_new_staff()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inv inventory.user_invites%rowtype; v_admin boolean;
begin
  insert into inventory.user_access (user_id) values (new.id) on conflict do nothing;
  select * into inv from inventory.user_invites where lower(email) = lower(coalesce(new.email, '')) and used_at is null order by invited_at desc limit 1;
  if found then
    select coalesce(grants_admin, false) into v_admin from inventory.roles where id = inv.role_id;
    update inventory.user_access set is_active = true, role_id = inv.role_id, department_id = inv.department_id, is_admin = coalesce(v_admin, false)
     where user_id = new.id;
    update core.profiles set is_active = true, full_name = coalesce(nullif(btrim(coalesce(full_name, '')), ''), inv.full_name) where id = new.id;
    insert into inventory.user_permissions (user_id, permission_key, granted_by)
    select new.id, k, inv.invited_by from unnest(inv.permission_keys) k where exists (select 1 from inventory.permissions p where p.key = k);
    insert into inventory.user_locations (user_id, location_id)
    select new.id, l from unnest(inv.location_ids) l where exists (select 1 from inventory.locations x where x.id = l);
    update inventory.user_invites set used_at = now() where id = inv.id;
    insert into inventory.audit_log (actor, action, entity, entity_id, details)
    values (inv.invited_by, 'INVITE_USED', 'user_invites', inv.id::text, jsonb_build_object('email', inv.email, 'user', new.id));
  end if;
  return new;
end $$;
revoke all on function inventory.handle_new_staff() from public, anon, authenticated;
drop trigger if exists inventory_on_profile_created on core.profiles;
create trigger inventory_on_profile_created after insert on core.profiles
  for each row execute function inventory.handle_new_staff();

-- 5. Switching a person ON in inventory also switches the central profile on (otherwise "on" would do nothing).
--    Switching OFF only switches off inventory: another system may still need that person.
create or replace function inventory.admin_set_user_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) and not p_active then
    raise exception 'you cannot deactivate yourself';
  end if;
  update inventory.user_access set is_active = p_active where user_id = p_user;
  if p_active then update core.profiles set is_active = true where id = p_user and not is_active; end if;
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), 'SET_ACTIVE', 'profiles', p_user::text, jsonb_build_object('active', p_active));
end $$;
revoke all on function inventory.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function inventory.admin_set_user_active(uuid, boolean) to authenticated;
