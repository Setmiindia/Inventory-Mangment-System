-- The website used to read the `profiles` table. Identity now lives in public.staff_profiles (central) and inventory rights in
-- inventory.user_access. These small functions give the website the same answers without letting it read other people's rows.

-- Who am I? (name, login email, may I use inventory, am I an inventory admin)
create or replace function inventory.my_profile()
returns table (email text, full_name text, is_active boolean, is_admin boolean)
language sql stable security definer set search_path = '' as $$
  select au.email::text, sp.full_name, (sp.is_active and ua.is_active), ua.is_admin
    from public.staff_profiles sp
    join inventory.user_access ua on ua.user_id = sp.id
    left join auth.users au on au.id = sp.id
   where sp.id = (select auth.uid());
$$;

-- How many people can use inventory right now (admin only; feeds the dashboard "add staff" step).
create or replace function inventory.active_people_count()
returns bigint language plpgsql stable security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return (select count(*) from inventory.people where is_active);
end $$;

-- Who works at a place (admin only).
create or replace function inventory.location_team(p_location uuid)
returns table (id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not inventory.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
    select p.id, p.email, p.full_name from inventory.user_locations ul
      join inventory.people p on p.id = ul.user_id where ul.location_id = p_location order by lower(coalesce(p.full_name, p.email));
end $$;

revoke all on function inventory.my_profile(), inventory.active_people_count(), inventory.location_team(uuid) from public, anon;
grant execute on function inventory.my_profile(), inventory.active_people_count(), inventory.location_team(uuid) to authenticated;
