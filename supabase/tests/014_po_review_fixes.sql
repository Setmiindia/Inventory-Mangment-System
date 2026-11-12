-- Tests for 20261025000020 (review fixes of the purchase order feature). Ends with a deliberate exception (rollback).
do $$
declare
  bp uuid := gen_random_uuid(); rc uuid := gen_random_uuid(); vw uuid := gen_random_uuid();
  wh uuid; s1 uuid; ia uuid; po_draft uuid; po_sent uuid; x jsonb;
  res text := ''; cnt int; r jsonb;
begin
  insert into auth.users (id, email) values (bp,'bp@t.l'),(rc,'rc@t.l'),(vw,'vw@t.l');
  insert into public.staff_profiles (id, full_name) select id, coalesce(email, 'x') from auth.users where id in (bp,rc,vw) on conflict do nothing;
  update inventory.user_access set is_active = true where user_id in (bp,rc,vw);
  insert into inventory.user_permissions (user_id, permission_key) values
    (bp,'purchase.create'),(bp,'purchase.approve'),(bp,'items.view'),
    (rc,'receipts.create'),
    (vw,'items.view');
  insert into inventory.locations (code, name, type) values ('WH','Warehouse','WAREHOUSE') returning id into wh;
  insert into inventory.user_locations values (bp, wh), (rc, wh), (vw, wh);
  insert into inventory.suppliers (name, supplier_type) values ('Sup','LOCAL') returning id into s1;
  insert into inventory.items (internal_item_code, item_name, selling_item_name, purchase_source, unit) values ('IA','a','A','LOCAL','PCS') returning id into ia;

  perform set_config('request.jwt.claims', json_build_object('sub',bp,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from inventory.suppliers;
  res := res || 'Q1 a user with only purchase permissions sees suppliers (' || cnt || ' >= 1): ' || case when cnt >= 1 then 'PASS' else 'FAIL' end || E'\n';
  x := inventory.save_purchase_order(null, jsonb_build_object('supplier_id',s1,'location_id',wh), jsonb_build_array(jsonb_build_object('item_id',ia,'quantity',3)));
  po_draft := (x->>'id')::uuid;
  x := inventory.save_purchase_order(null, jsonb_build_object('supplier_id',s1,'location_id',wh), jsonb_build_array(jsonb_build_object('item_id',ia,'quantity',3)));
  po_sent := (x->>'id')::uuid;
  perform inventory.send_purchase_order(po_sent);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',vw,'role','authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from inventory.suppliers;
  res := res || 'Q2 a user with no supplier, receipt or purchase permission still sees no suppliers (' || cnt || '): ' || case when cnt = 0 then 'PASS' else 'FAIL' end || E'\n';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',rc,'role','authenticated')::text, true);
  set local role authenticated;
  begin perform inventory.purchase_order_open_lines(po_draft); res := res || 'Q3 open lines of a DRAFT order: FAIL' || E'\n';
  exception when others then res := res || 'Q3 the helper refuses a draft order (' || sqlerrm || '): ' || case when sqlerrm = 'purchase order not found' then 'PASS' else 'FAIL' end || E'\n'; end;
  r := inventory.purchase_order_open_lines(po_sent);
  res := res || 'Q4 the helper still answers for a SENT order (' || jsonb_array_length(r->'lines') || ' line): ' || case when jsonb_array_length(r->'lines') = 1 then 'PASS' else 'FAIL' end || E'\n';
  reset role;

  raise exception E'TEST RESULTS (rolled back):\n%', coalesce(res, 'RES IS NULL');
end $$;
