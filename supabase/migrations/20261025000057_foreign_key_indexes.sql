-- Indexes for foreign keys that are looked up or joined often (found by the Supabase performance advisor).
-- Only lookup columns: the "created_by / updated_by / decided_by ..." person columns are left out on purpose
-- (they are written, almost never searched, and every extra index slows writes). Safe to run twice.
create index if not exists bill_lines_item_id_idx on inventory.bill_lines (item_id);
create index if not exists dispatch_events_dispatch_id_idx on inventory.dispatch_events (dispatch_id);
create index if not exists dispatches_job_id_idx on inventory.dispatches (job_id);
create index if not exists goods_receipt_lines_item_id_idx on inventory.goods_receipt_lines (item_id);
create index if not exists import_shipment_lines_po_line_id_idx on inventory.import_shipment_lines (po_line_id);
create index if not exists item_bins_bin_id_location_id_idx on inventory.item_bins (bin_id, location_id);
create index if not exists item_bins_item_id_idx on inventory.item_bins (item_id);
create index if not exists items_unit_idx on inventory.items (unit);
create index if not exists physical_count_lines_item_id_idx on inventory.physical_count_lines (item_id);
create index if not exists physical_counts_category_id_idx on inventory.physical_counts (category_id);
create index if not exists pick_pack_lines_item_id_idx on inventory.pick_pack_lines (item_id);
create index if not exists user_access_department_id_idx on inventory.user_access (department_id);
create index if not exists user_access_role_id_idx on inventory.user_access (role_id);
create index if not exists purchase_order_lines_item_id_idx on inventory.purchase_order_lines (item_id);
create index if not exists quality_check_lines_receipt_line_id_idx on inventory.quality_check_lines (receipt_line_id);
create index if not exists reorder_levels_location_id_idx on inventory.reorder_levels (location_id);
create index if not exists role_permissions_permission_key_idx on inventory.role_permissions (permission_key);
create index if not exists sales_order_lines_item_id_idx on inventory.sales_order_lines (item_id);
create index if not exists sales_return_events_return_id_idx on inventory.sales_return_events (return_id);
create index if not exists sales_return_lines_item_id_idx on inventory.sales_return_lines (item_id);
create index if not exists stock_entry_lines_item_id_idx on inventory.stock_entry_lines (item_id);
create index if not exists stock_transfer_lines_item_id_idx on inventory.stock_transfer_lines (item_id);
create index if not exists user_invites_department_id_idx on inventory.user_invites (department_id);
create index if not exists user_invites_role_id_idx on inventory.user_invites (role_id);
create index if not exists user_permissions_permission_key_idx on inventory.user_permissions (permission_key);
