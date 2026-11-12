-- Floor for racks / bins. A warehouse can have several floors (G = ground, 1, 2, B1 = basement...). The floor is optional:
-- a bin without a floor keeps the old code (WH01-A-01-01); a bin with a floor gets it in the code (WH01-F2-A-01-01),
-- so the same rack letter on two floors never clashes.

alter table inventory.storage_bins
  add column floor text check (floor is null or floor ~ '^[A-Z0-9]{1,4}$');

create or replace function inventory.storage_bins_before_write()
returns trigger language plpgsql set search_path = '' as $$
declare v_place text;
begin
  select l.code into v_place from inventory.locations l where l.id = new.location_id;
  if v_place is null then raise exception 'Unknown place' using errcode = 'P0001'; end if;
  if tg_op = 'INSERT' or new.rack is distinct from old.rack or new.level is distinct from old.level
     or new.bin_no is distinct from old.bin_no or new.location_id is distinct from old.location_id
     or new.floor is distinct from old.floor then
    new.code := upper(regexp_replace(btrim(v_place), '\s+', '', 'g'))
                || case when new.floor is null then '' else '-F' || new.floor end
                || '-' || new.rack || '-' || new.level || '-' || new.bin_no;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end $$;

-- The list function gets a floor column, a floor filter (p_floor, last argument) and the list of floors in use.
drop function inventory.bins_page(text, uuid, text, text, integer, integer);
create or replace function inventory.bins_page(
  p_q text default null, p_location uuid default null, p_rack text default null, p_status text default null,
  p_limit int default 10, p_offset int default 0, p_floor text default null
) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_like text;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_result jsonb;
begin
  if p_status is not null and p_status not in ('', 'all', 'occupied', 'available', 'blocked') then
    raise exception 'Unknown status filter' using errcode = 'P0001';
  end if;
  if p_rack is not null and p_rack <> '' and p_rack !~ '^[A-Z0-9]{1,6}$' then
    raise exception 'Unknown rack' using errcode = 'P0001';
  end if;
  if p_floor is not null and p_floor <> '' and p_floor <> '-' and p_floor !~ '^[A-Z0-9]{1,4}$' then
    raise exception 'Unknown floor' using errcode = 'P0001';
  end if;
  v_like := '%' || replace(replace(replace(coalesce(p_q, ''), '\', '\'), '%', '\%'), '_', '\_') || '%';

  with base as (
    select b.id, b.code, b.location_id, l.code as place_code, l.name as place_name, l.city, b.floor, b.rack, b.level, b.bin_no,
           b.bin_type as type, b.capacity, b.is_blocked as blocked, b.created_at,
           coalesce(a.items, 0) as items, coalesce(a.qty, 0) as qty,
           case when b.is_blocked then 'blocked' when coalesce(a.qty, 0) > 0 then 'occupied' else 'available' end as status,
           case when b.capacity is not null and b.capacity > 0 then round(coalesce(a.qty, 0) * 100.0 / b.capacity) end as utilization
      from inventory.storage_bins b
      join inventory.locations l on l.id = b.location_id
      left join (select ib.bin_id, count(*) as items, sum(coalesce(so.quantity, 0)) as qty
                   from inventory.item_bins ib
                   left join inventory.stock_overview so on so.item_id = ib.item_id and so.location_id = ib.location_id
                  group by ib.bin_id) a on a.bin_id = b.id
  ),
  filtered as (
    select x.* from base x
     where (p_location is null or x.location_id = p_location)
       and (coalesce(p_rack, '') = '' or x.rack = p_rack)
       -- p_floor: '' or null = every floor, '-' = bins that have no floor set, otherwise that floor
       and (coalesce(p_floor, '') = '' or (p_floor = '-' and x.floor is null) or x.floor = p_floor)
       and (coalesce(p_status, '') in ('', 'all') or x.status = p_status)
       and (coalesce(p_q, '') = '' or x.code ilike v_like or x.place_name ilike v_like or x.rack ilike v_like
            or exists (select 1 from inventory.item_bins ib join inventory.items i on i.id = ib.item_id
                        where ib.bin_id = x.id and (i.internal_item_code ilike v_like or i.item_name ilike v_like)))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', (select coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]'::jsonb)
               from (select * from filtered order by code limit v_limit offset v_offset) t),
    'racks', (select coalesce(jsonb_agg(distinct rack order by rack), '[]'::jsonb) from base where p_location is null or location_id = p_location),
    'floors', (select coalesce(jsonb_agg(distinct floor order by floor), '[]'::jsonb) from base where floor is not null and (p_location is null or location_id = p_location)),
    'places', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name) order by name), '[]'::jsonb)
                 from inventory.locations where type <> 'TRANSIT' and is_active),
    'kpi', jsonb_build_object(
      'total', (select count(*) from base),
      'occupied', (select count(*) from base where status = 'occupied'),
      'available', (select count(*) from base where status = 'available'),
      'blocked', (select count(*) from base where status = 'blocked'),
      'new_month', (select count(*) from base where (created_at at time zone 'Asia/Kolkata')::date >= date_trunc('month', v_today)::date)))
  into v_result;
  return v_result;
end $$;
revoke all on function inventory.bins_page(text, uuid, text, text, int, int, text) from public, anon;
grant execute on function inventory.bins_page(text, uuid, text, text, int, int, text) to authenticated;
