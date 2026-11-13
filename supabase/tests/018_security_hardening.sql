-- Test 018: security hardening (migration 28). Rolled back at the end; prints PASS/FAIL lines.
do $$
declare
  v_admin uuid; v_n int; v_ok boolean; v_out text := '';
begin
  -- the database may hold no admin yet: make a throw-away one (rolled back with everything else)
  if not exists (select 1 from inventory.people where is_admin and is_active) then
    v_admin := gen_random_uuid();
    insert into auth.users (id, email) values (v_admin, 'adm@test.local');
    update inventory.user_access set is_active = true, is_admin = true where user_id = v_admin;
  end if;
  select id into v_admin from inventory.people where is_admin and is_active limit 1;
  if v_admin is null then raise exception 'no admin profile to test with'; end if;

  -- anonymous: no table access at all, and no trigger function
  set local role anon;
  begin perform 1 from inventory.items limit 1; v_out := v_out || E'\nFAIL anon can read items';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon cannot read items'; end;
  begin perform 1 from inventory.units limit 1; v_out := v_out || E'\nFAIL anon can read units';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon cannot read units'; end;
  begin perform inventory.set_updated_at(); v_out := v_out || E'\nFAIL anon can call trigger function';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon cannot call trigger function'; end;
  reset role;

  -- active admin can still read look-up tables
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from inventory.units;
  v_out := v_out || case when v_n > 0 then E'\nPASS active admin reads units' else E'\nFAIL active admin cannot read units' end;
  select count(*) into v_n from inventory.permissions;
  v_out := v_out || case when v_n > 0 then E'\nPASS active admin reads permissions' else E'\nFAIL active admin cannot read permissions' end;
  select count(*) into v_n from inventory.app_settings;
  v_out := v_out || case when v_n > 0 then E'\nPASS active admin reads app_settings' else E'\nFAIL active admin cannot read app_settings' end;
  -- the trigger on items still works for a normal update
  update inventory.items set updated_at = now() where id = (select id from inventory.items limit 1);
  v_out := v_out || E'\nPASS item update still fires its trigger';
  reset role;

  -- a signed-in but switched-off (or unknown) account sees nothing in the look-up tables
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from inventory.units;
  v_out := v_out || case when v_n = 0 then E'\nPASS stranger sees no units' else E'\nFAIL stranger sees units' end;
  select count(*) into v_n from inventory.permissions;
  v_out := v_out || case when v_n = 0 then E'\nPASS stranger sees no permissions' else E'\nFAIL stranger sees permissions' end;
  select count(*) into v_n from inventory.app_settings;
  v_out := v_out || case when v_n = 0 then E'\nPASS stranger sees no settings' else E'\nFAIL stranger sees settings' end;
  reset role;

  raise exception 'TEST 018 RESULT:%', v_out;
end $$;
