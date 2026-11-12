-- Foundation: profiles, permission toggles, locations (warehouses + shops), audit log.
-- Rules: deny by default. RLS on every table. No end-user write policies on
-- profiles / user_permissions / user_locations: those change only through the
-- admin_* functions below, which require is_admin().

-- ---------- helpers ----------
create or replace function inventory.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- who may use inventory ----------
-- WHO a person is (name, mobile, switched on/off) lives in the central table public.staff_profiles, shared by every system
-- (inventory, CRM, checklist, delegation ...). Inventory keeps only WHAT the person may do here, in inventory.user_access.
-- A person has NO access until an inventory admin switches them on (is_active defaults to false).
create table inventory.user_access (
  user_id     uuid primary key references public.staff_profiles (id) on delete cascade,
  -- is_active = inventory switch. The person must ALSO be active in staff_profiles (the central switch, owned by the central admin).
  is_active   boolean not null default false,
  -- is_admin = may manage inventory users and implicitly holds every inventory permission.
  -- Set only by SQL / by an existing admin through admin_set_user_admin().
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table inventory.user_access enable row level security;
create trigger user_access_updated_at before update on inventory.user_access
  for each row execute function inventory.set_updated_at();

-- Read-only helper for the security-definer functions below: staff + login email + inventory access in one row.
-- Nobody can select it directly (no grants): only functions owned by the database owner use it.
create view inventory.people as
  select sp.id, au.email::text as email, sp.full_name, (sp.is_active and ua.is_active) as is_active, ua.is_admin, ua.created_at
    from public.staff_profiles sp
    join inventory.user_access ua on ua.user_id = sp.id
    left join auth.users au on au.id = sp.id;
revoke all on inventory.people from public, anon, authenticated;

-- Every new central staff member gets an (inactive, no-rights) inventory row.
create or replace function inventory.handle_new_staff()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into inventory.user_access (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
revoke all on function inventory.handle_new_staff() from public, anon, authenticated;
create trigger inventory_on_staff_created after insert on public.staff_profiles
  for each row execute function inventory.handle_new_staff();
-- Staff who already exist when this migration runs.
insert into inventory.user_access (user_id) select id from public.staff_profiles on conflict do nothing;

-- ---------- permissions ----------
create table inventory.permissions (
  key         text primary key,
  module      text not null,
  description text not null
);
alter table inventory.permissions enable row level security;

create table inventory.user_permissions (
  user_id        uuid not null references public.staff_profiles (id) on delete cascade,
  permission_key text not null references inventory.permissions (key) on delete cascade,
  granted_by     uuid references public.staff_profiles (id),
  granted_at     timestamptz not null default now(),
  primary key (user_id, permission_key)
);
alter table inventory.user_permissions enable row level security;

insert into inventory.permissions (key, module, description) values
  ('items.view',              'items',      'View items'),
  ('items.create',            'items',      'Create items'),
  ('items.edit',              'items',      'Edit item details, barcodes, images, datasheet'),
  ('items.edit_selling_name', 'items',      'Change the Selling_Item_Name printed on bills'),
  ('items.archive',           'items',      'Archive or restore items'),
  ('items.import',            'items',      'Import items from Excel'),
  ('categories.manage',       'items',      'Create and edit item categories'),
  ('locations.manage',        'locations',  'Create and edit warehouses and shops'),
  ('audit.view',              'system',     'View the audit log');

-- ---------- permission checks ----------
-- Stable + security definer so RLS policies can call them without recursion.
create or replace function inventory.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join public.staff_profiles sp on sp.id = ua.user_id
    where ua.user_id = (select auth.uid()) and ua.is_active and sp.is_active and ua.is_admin
  );
$$;

create or replace function inventory.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join public.staff_profiles sp on sp.id = ua.user_id
    where ua.user_id = (select auth.uid())
      and ua.is_active and sp.is_active
      and (ua.is_admin or exists (
        select 1 from inventory.user_permissions up
        where up.user_id = ua.user_id and up.permission_key = p_key))
  );
$$;

create or replace function inventory.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from inventory.user_access ua join public.staff_profiles sp on sp.id = ua.user_id
    where ua.user_id = (select auth.uid()) and ua.is_active and sp.is_active);
$$;

revoke all on function inventory.is_admin() from public, anon;
revoke all on function inventory.is_active_user() from public, anon;
grant execute on function inventory.is_active_user() to authenticated;
revoke all on function inventory.has_permission(text) from public, anon;
grant execute on function inventory.is_admin() to authenticated;
grant execute on function inventory.has_permission(text) to authenticated;

-- ---------- locations (warehouses and shops) ----------
create type inventory.location_type as enum ('WAREHOUSE', 'SHOP');

create table inventory.locations (
  id          uuid primary key default gen_random_uuid(),
  code        text not null check (btrim(code) <> ''),
  name        text not null check (btrim(name) <> ''),
  type        inventory.location_type not null,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.staff_profiles (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.staff_profiles (id)
);
create unique index locations_code_uq on inventory.locations (lower(btrim(code)));
alter table inventory.locations enable row level security;
create trigger locations_updated_at before update on inventory.locations
  for each row execute function inventory.set_updated_at();

-- Which locations a user may work in (a shop user sees only their shop).
create table inventory.user_locations (
  user_id     uuid not null references public.staff_profiles (id) on delete cascade,
  location_id uuid not null references inventory.locations (id) on delete restrict,
  primary key (user_id, location_id)
);
create index user_locations_location_idx on inventory.user_locations (location_id);
alter table inventory.user_locations enable row level security;

create or replace function inventory.can_access_location(p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select inventory.is_admin() or exists (
    select 1 from inventory.user_locations ul
    join inventory.user_access ua on ua.user_id = ul.user_id
    join public.staff_profiles sp on sp.id = ul.user_id
    where ul.user_id = (select auth.uid()) and ul.location_id = p_location and ua.is_active and sp.is_active);
$$;
revoke all on function inventory.can_access_location(uuid) from public, anon;
grant execute on function inventory.can_access_location(uuid) to authenticated;

-- ---------- audit log (append only) ----------
create table inventory.audit_log (
  id        bigint generated always as identity primary key,
  at        timestamptz not null default now(),
  actor     uuid,
  action    text not null,
  entity    text not null,
  entity_id text,
  details   jsonb
);
create index audit_log_entity_idx on inventory.audit_log (entity, entity_id);
create index audit_log_at_idx on inventory.audit_log (at desc);
alter table inventory.audit_log enable row level security;

-- Generic trigger: records who changed what. Attach to important tables.
create or replace function inventory.log_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id text;
begin
  v_id := coalesce(to_jsonb(coalesce(new, old)) ->> 'id', '');
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values (
    (select auth.uid()), tg_op, tg_table_name, v_id,
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end);
  return coalesce(new, old);
end $$;
revoke all on function inventory.log_audit() from public, anon, authenticated;

create trigger locations_audit after insert or update or delete on inventory.locations
  for each row execute function inventory.log_audit();

-- ---------- admin functions (only way to change users, permissions, scope) ----------
create or replace function inventory.admin_set_user_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) and not p_active then
    raise exception 'you cannot deactivate yourself';
  end if;
  update inventory.user_access set is_active = p_active where user_id = p_user;
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), 'SET_ACTIVE', 'profiles', p_user::text, jsonb_build_object('active', p_active));
end $$;

create or replace function inventory.admin_set_user_admin(p_user uuid, p_admin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) and not p_admin then
    raise exception 'you cannot remove your own admin right';
  end if;
  update inventory.user_access set is_admin = p_admin where user_id = p_user;
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), 'SET_ADMIN', 'profiles', p_user::text, jsonb_build_object('admin', p_admin));
end $$;

-- Replace the user's whole permission set in one transaction.
create or replace function inventory.admin_set_user_permissions(p_user uuid, p_keys text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from inventory.user_permissions where user_id = p_user;
  insert into inventory.user_permissions (user_id, permission_key, granted_by)
  select p_user, k, (select auth.uid()) from unnest(coalesce(p_keys, '{}')) as k;
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), 'SET_PERMISSIONS', 'user_permissions', p_user::text, jsonb_build_object('keys', p_keys));
end $$;

create or replace function inventory.admin_set_user_locations(p_user uuid, p_locations uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from inventory.user_locations where user_id = p_user;
  insert into inventory.user_locations (user_id, location_id)
  select p_user, l from unnest(coalesce(p_locations, '{}')) as l;
  insert into inventory.audit_log (actor, action, entity, entity_id, details)
  values ((select auth.uid()), 'SET_LOCATIONS', 'user_locations', p_user::text, jsonb_build_object('locations', p_locations));
end $$;

revoke all on function inventory.admin_set_user_active(uuid, boolean) from public, anon;
revoke all on function inventory.admin_set_user_admin(uuid, boolean) from public, anon;
revoke all on function inventory.admin_set_user_permissions(uuid, text[]) from public, anon;
revoke all on function inventory.admin_set_user_locations(uuid, uuid[]) from public, anon;
grant execute on function inventory.admin_set_user_active(uuid, boolean) to authenticated;
grant execute on function inventory.admin_set_user_admin(uuid, boolean) to authenticated;
grant execute on function inventory.admin_set_user_permissions(uuid, text[]) to authenticated;
grant execute on function inventory.admin_set_user_locations(uuid, uuid[]) to authenticated;

-- ---------- RLS policies (all "to authenticated"; anon gets nothing) ----------
create policy user_access_select on inventory.user_access for select to authenticated
  using (user_id = (select auth.uid()) or (select inventory.is_admin()));

create policy permissions_select on inventory.permissions for select to authenticated
  using (true);

create policy user_permissions_select on inventory.user_permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select inventory.is_admin()));

create policy locations_select on inventory.locations for select to authenticated
  using ((select inventory.can_access_location(id)) or (select inventory.has_permission('locations.manage')));
create policy locations_insert on inventory.locations for insert to authenticated
  with check ((select inventory.has_permission('locations.manage')));
create policy locations_update on inventory.locations for update to authenticated
  using ((select inventory.has_permission('locations.manage')))
  with check ((select inventory.has_permission('locations.manage')));

create policy user_locations_select on inventory.user_locations for select to authenticated
  using (user_id = (select auth.uid()) or (select inventory.is_admin()));

create policy audit_log_select on inventory.audit_log for select to authenticated
  using ((select inventory.has_permission('audit.view')));
