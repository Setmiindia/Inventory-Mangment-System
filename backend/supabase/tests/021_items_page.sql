-- Test 021: items_page (migration 31). Rolled back at the end; prints result lines.
-- Checks: an admin gets rows and the 5 top numbers, filters work, a stranger is refused, anonymous is denied,
-- and strange text in the search (quotes, % and _) does not break or match everything.
do $$
declare v_admin uuid; v_r jsonb; v_out text := ''; v_n int;
begin
  -- test prerequisites (all rolled back): a throw-away admin and a little demo data (the live database may be empty)
  v_admin := gen_random_uuid();
  insert into auth.users (id, email) values (v_admin, 'adm@test.local');
  insert into public.staff_profiles (id, full_name) values (v_admin, 'adm@test.local') on conflict do nothing;
  update inventory.user_access set is_active = true, is_admin = true where user_id = v_admin;
  insert into inventory.categories (name) values ('DEMO CATEGORY');
  insert into inventory.locations (code, name, type) values ('DEMO-WH', 'Demo warehouse', 'WAREHOUSE'), ('DEMO-SHOP1', 'Demo shop', 'SHOP');
  insert into inventory.items (internal_item_code, item_name, selling_item_name, purchase_source, category_id)
    values ('DEMO-3RCA-1.5M', '3 core cable', '3 core cable', 'LOCAL', (select id from inventory.categories where name = 'DEMO CATEGORY'));
  insert into inventory.stock_movements (item_id, to_location_id, quantity, movement_type)
    select i.id, l.id, 50, 'OPENING' from inventory.items i, inventory.locations l where i.internal_item_code = 'DEMO-3RCA-1.5M' and l.code = 'DEMO-WH';
  select id into v_admin from inventory.people where is_admin and is_active limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := inventory.items_page(null, null, null, null, 10, 0);
  v_out := v_out || case when (v_r->>'total')::int > 0 and jsonb_array_length(v_r->'rows') between 1 and 10 then E'\nPASS admin gets rows' else E'\nFAIL no rows' end;
  v_out := v_out || case when v_r->'kpi' ?& array['total','active','inactive','low','out'] then E'\nPASS five top numbers' else E'\nFAIL kpi' end;
  v_r := inventory.items_page(null, null, null, 'low', 100, 0);
  select count(*) into v_n from jsonb_array_elements(v_r->'rows') e where e->>'status' <> 'low';
  v_out := v_out || case when v_n = 0 then E'\nPASS status filter low' else E'\nFAIL status filter' end;
  v_r := inventory.items_page('%', null, null, null, 100, 0);
  v_out := v_out || case when (v_r->>'total')::int < (inventory.items_page(null,null,null,null,1,0)->>'total')::int then E'\nPASS percent sign is treated as text' else E'\nFAIL percent matched everything' end;
  v_r := inventory.items_page('x''; drop table inventory.items; --', null, null, null, 10, 0);
  v_out := v_out || case when (v_r->>'total')::int = 0 then E'\nPASS quote text is harmless' else E'\nFAIL quote text' end;
  begin perform inventory.items_page(null, null, null, 'bogus', 10, 0); v_out := v_out || E'\nFAIL bad status accepted';
  exception when others then v_out := v_out || E'\nPASS bad status refused'; end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform inventory.items_page(null, null, null, null, 10, 0); v_out := v_out || E'\nFAIL stranger got data';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS stranger refused'; end;
  reset role;
  set local role anon;
  begin perform inventory.items_page(null, null, null, null, 10, 0); v_out := v_out || E'\nFAIL anon';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon denied'; end;
  reset role;
  raise exception 'TEST 021 RESULT:%', v_out;
end $$;
