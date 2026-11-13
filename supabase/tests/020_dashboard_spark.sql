-- Test 020: dashboard_spark (migration 30). Rolled back at the end; prints result lines.
do $$
declare v_admin uuid; v_r jsonb; v_out text := ''; v_s jsonb;
begin
  -- the database may hold no admin yet: make a throw-away one (rolled back with everything else)
  if not exists (select 1 from inventory.people where is_admin and is_active) then
    v_admin := gen_random_uuid();
    insert into auth.users (id, email) values (v_admin, 'adm@test.local');
    update inventory.user_access set is_active = true, is_admin = true where user_id = v_admin;
  end if;
  select id into v_admin from inventory.people where is_admin and is_active limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_r := inventory.dashboard_spark(null);
  v_out := v_out || case when (select bool_and(jsonb_array_length(v) = 30) from jsonb_each(v_r) e(k, v)) then E'\nPASS every line has 30 days' else E'\nFAIL length' end;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_s := inventory.dashboard_spark(null);
  v_out := v_out || case when v_s = '{}'::jsonb then E'\nPASS stranger gets nothing' else E'\nFAIL stranger' end;
  reset role;
  set local role anon;
  begin perform inventory.dashboard_spark(null); v_out := v_out || E'\nFAIL anon';
  exception when insufficient_privilege then v_out := v_out || E'\nPASS anon denied'; end;
  reset role;
  raise exception 'TEST 020 RESULT:%', v_out;
end $$;
