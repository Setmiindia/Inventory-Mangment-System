-- Test 022: categories_page and the new code/description columns (migration 32). Rolled back at the end.
do $$
declare v_admin uuid; v_r jsonb; v_out text := ''; v_cat uuid;
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

  v_r := inventory.categories_page(null, null, null, 10, 0);
  v_out := v_out || case when (v_r->>'total')::int >= 1 and v_r->'kpi' ?& array['total','active','inactive','products','new_categories','new_products'] then E'\nPASS admin gets rows and the numbers' else E'\nFAIL rows or numbers' end;
  v_out := v_out || case when (v_r->'rows'->0) ? 'products' and (v_r->'rows'->0) ? 'image' then E'\nPASS rows carry product count and picture' else E'\nFAIL row shape' end;

  -- code and description can be saved; a code must look right and be unique
  insert into inventory.categories (name, code, description) values ('TEST CAT ONE', 'TC1', 'first') returning id into v_cat;
  begin insert into inventory.categories (name, code) values ('TEST CAT TWO', 'TC1'); v_out := v_out || E'\nFAIL duplicate code accepted';
  exception when unique_violation then v_out := v_out || E'\nPASS duplicate code refused'; end;
  begin insert into inventory.categories (name, code) values ('TEST CAT THREE', 'bad code!'); v_out := v_out || E'\nFAIL bad code accepted';
  exception when check_violation then v_out := v_out || E'\nPASS bad code refused'; end;
  begin insert into inventory.categories (name, description) values ('TEST CAT FOUR', repeat('x', 301)); v_out := v_out || E'\nFAIL long description accepted';
  exception when check_violation then v_out := v_out || E'\nPASS long description refused'; end;

  v_r := inventory.categories_page('tc1', 'active', 'products', 10, 0);
  v_out := v_out || case when (v_r->>'total')::int = 1 then E'\nPASS search by code' else E'\nFAIL search by code' end;
  v_r := inventory.categories_page('%', null, null, 100, 0);
  v_out := v_out || case when (v_r->>'total')::int = 0 then E'\nPASS percent sign is text' else E'\nFAIL percent matched' end;
  begin perform inventory.categories_page(null, 'bogus', null, 10, 0); v_out := v_out || E'\nFAIL bad status';
  exception when others then v_out := v_out || E'\nPASS bad status refused'; end;
  begin perform inventory.categories_page(null, null, 'drop', 10, 0); v_out := v_out || E'\nFAIL bad sort';
  exception when others then v_out := v_out || E'\nPASS bad sort refused'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform inventory.categories_page(null, null, null, 10, 0); v_out := v_out || E'\nFAIL stranger got data';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS stranger refused'; end;
  reset role;
  set local role anon;
  begin perform inventory.categories_page(null, null, null, 10, 0); v_out := v_out || E'\nFAIL anon';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon denied'; end;
  reset role;
  raise exception 'TEST 022 RESULT:%', v_out;
end $$;
