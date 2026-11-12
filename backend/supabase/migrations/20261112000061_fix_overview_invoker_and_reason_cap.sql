-- Fixes found by the first run of the tests on the central database.
-- 1. Migration 56 re-created inventory.stock_overview without security_invoker, so Row Level Security was skipped
--    and every user with stock.view saw every place. Put the option back.
alter view inventory.stock_overview set (security_invoker = true);

-- 2. Migration 44 dropped the 300-character cap that migration 26 added on the ledger reason, so a long remark
--    made the whole stock entry fail on stock_movements_reason_check. Cap it again.
create or replace function inventory.stock_entry_post(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e inventory.stock_entries%rowtype;
begin
  select * into e from inventory.stock_entries where id = p_id;
  insert into inventory.stock_movements (item_id, from_location_id, to_location_id, quantity, movement_type, reason, reference)
  select l.item_id,
         case when e.direction = 'OUT' then e.location_id end,
         case when e.direction = 'IN' then e.location_id end,
         l.quantity,
         (case when e.direction = 'OUT' then 'STOCK_OUT' else 'STOCK_IN' end)::inventory.stock_movement_type,
         left(inventory.stock_entry_reason_label(e.reason) || coalesce(': ' || e.remarks, ''), 300),
         e.entry_no
    from inventory.stock_entry_lines l where l.entry_id = p_id;
end $$;
