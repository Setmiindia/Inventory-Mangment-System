-- Test 023: suppliers_page and the new supplier columns (migration 33). Rolled back at the end.
do $$
declare v_admin uuid; v_r jsonb; v_out text := ''; v_code text;
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

  insert into inventory.suppliers (name, supplier_type, country, city, website, payment_terms) values ('TEST SUP ONE', 'IMPORT', 'China', 'Shenzhen', 'www.example.cn', '30 Days') returning code into v_code;
  insert into inventory.suppliers (name, supplier_type, country, city) values ('TEST SUP TWO', 'LOCAL', 'India', 'Delhi');
  v_out := v_out || case when v_code ~ '^SUP-[0-9]{3,}$' then E'\nPASS code is made automatically: ' || v_code else E'\nFAIL code ' || coalesce(v_code, 'null') end;
  begin insert into inventory.suppliers (name, supplier_type, currency) values ('TEST SUP THREE', 'LOCAL', 'rupee'); v_out := v_out || E'\nFAIL bad currency accepted';
  exception when check_violation then v_out := v_out || E'\nPASS bad currency refused'; end;

  v_r := inventory.suppliers_page(null, null, null, null, 10, 0);
  v_out := v_out || case when (v_r->>'total')::int >= 2 and v_r->'kpi' ?& array['total','active','inactive','with_orders','import','new_month'] then E'\nPASS rows and numbers' else E'\nFAIL rows or numbers' end;
  v_out := v_out || case when v_r->'countries' @> '["China","India"]'::jsonb then E'\nPASS countries listed' else E'\nFAIL countries' end;
  v_r := inventory.suppliers_page('shenzhen', 'IMPORT', 'active', 'China', 10, 0);
  v_out := v_out || case when (v_r->>'total')::int = 1 then E'\nPASS filters together' else E'\nFAIL filters' end;
  v_r := inventory.suppliers_page('%', null, null, null, 10, 0);
  v_out := v_out || case when (v_r->>'total')::int = 0 then E'\nPASS percent sign is text' else E'\nFAIL percent matched' end;
  begin perform inventory.suppliers_page(null, 'ALIEN', null, null, 10, 0); v_out := v_out || E'\nFAIL bad type';
  exception when others then v_out := v_out || E'\nPASS bad type refused'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform inventory.suppliers_page(null, null, null, null, 10, 0); v_out := v_out || E'\nFAIL stranger got data';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS stranger refused'; end;
  reset role;
  set local role anon;
  begin perform inventory.suppliers_page(null, null, null, null, 10, 0); v_out := v_out || E'\nFAIL anon';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon denied'; end;
  reset role;
  raise exception 'TEST 023 RESULT:%', v_out;
end $$;
