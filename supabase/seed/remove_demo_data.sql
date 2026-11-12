-- REMOVE DEMO DATA, DEVELOPMENT ONLY. Run in the Supabase SQL editor as the project owner.
-- Deletes only things whose code / name starts with DEMO. Real items, locations and stock are not touched.
-- Stock history, goods receipts and transfers are normally impossible to delete (append-only / locked
-- triggers). This script switches those triggers off for the length of the transaction, deletes ONLY rows
-- that belong to DEMO items or DEMO locations, and switches them on again before it commits.
-- NEVER run this on a database that holds real history for DEMO-named things.
begin;

alter table inventory.stock_movements disable trigger stock_movements_no_change;
delete from inventory.stock_movements
 where item_id in (select id from inventory.items where internal_item_code like 'DEMO-%')
    or from_location_id in (select id from inventory.locations where code like 'DEMO-%')
    or to_location_id   in (select id from inventory.locations where code like 'DEMO-%');
alter table inventory.stock_movements enable trigger stock_movements_no_change;

-- quality checks of those receipts (lines go with them)
delete from inventory.quality_checks
 where receipt_id in (select id from inventory.goods_receipts where location_id in (select id from inventory.locations where code like 'DEMO-%'));

-- goods receipts that belong to a DEMO place (lines and prices go with them)
alter table inventory.goods_receipts disable trigger goods_receipts_no_change;
alter table inventory.goods_receipt_lines disable trigger goods_receipt_lines_guard;
alter table inventory.goods_receipt_costs disable trigger goods_receipt_costs_guard;
delete from inventory.goods_receipts where location_id in (select id from inventory.locations where code like 'DEMO-%');
alter table inventory.goods_receipt_costs enable trigger goods_receipt_costs_guard;
alter table inventory.goods_receipt_lines enable trigger goods_receipt_lines_guard;
alter table inventory.goods_receipts enable trigger goods_receipts_no_change;

-- import shipments of those orders (items, history and charges go with them)
delete from inventory.import_shipments
 where po_id in (select id from inventory.purchase_orders
                  where location_id in (select id from inventory.locations where code like 'DEMO-%')
                     or supplier_id in (select id from inventory.suppliers where name like 'DEMO %'));

-- purchase orders for a DEMO place or a DEMO supplier (lines and prices go with them)
alter table inventory.purchase_orders disable trigger purchase_orders_flow_guard;
alter table inventory.purchase_order_lines disable trigger purchase_order_lines_guard;
alter table inventory.purchase_order_costs disable trigger purchase_order_costs_guard;
delete from inventory.purchase_orders
 where location_id in (select id from inventory.locations where code like 'DEMO-%')
    or supplier_id in (select id from inventory.suppliers where name like 'DEMO %');
alter table inventory.purchase_order_costs enable trigger purchase_order_costs_guard;
alter table inventory.purchase_order_lines enable trigger purchase_order_lines_guard;
alter table inventory.purchase_orders enable trigger purchase_orders_flow_guard;

-- customer returns of a DEMO place (lines and history go with them), before the sales orders they belong to
delete from inventory.sales_returns where location_id in (select id from inventory.locations where code like 'DEMO-%');

-- dispatches of a DEMO place (their status history goes with them), before the pick jobs and sales orders they belong to
delete from inventory.dispatches where location_id in (select id from inventory.locations where code like 'DEMO-%');

-- picking and packing jobs of a DEMO place (their lines go with them), before the sales orders they belong to
delete from inventory.pick_pack_jobs where location_id in (select id from inventory.locations where code like 'DEMO-%');

-- sales orders shipped from a DEMO place (lines go with them), before the DEMO customers are removed
delete from inventory.sales_orders where location_id in (select id from inventory.locations where code like 'DEMO-%');

-- physical counts of a DEMO place (their lines go with them)
delete from inventory.physical_counts where location_id in (select id from inventory.locations where code like 'DEMO-%');

-- stock adjustments (Stock In / Out entries) of a DEMO place (lines go first)
alter table inventory.stock_entries disable trigger stock_entries_no_change;
alter table inventory.stock_entry_lines disable trigger stock_entry_lines_no_change;
delete from inventory.stock_entry_lines where entry_id in (select id from inventory.stock_entries where location_id in (select id from inventory.locations where code like 'DEMO-%'));
delete from inventory.stock_entries where location_id in (select id from inventory.locations where code like 'DEMO-%');
alter table inventory.stock_entry_lines enable trigger stock_entry_lines_no_change;
alter table inventory.stock_entries enable trigger stock_entries_no_change;

-- transfers that start or end at a DEMO place
alter table inventory.stock_transfers disable trigger stock_transfers_flow_trg;
alter table inventory.stock_transfer_lines disable trigger stock_transfer_lines_flow_trg;
delete from inventory.stock_transfers
 where from_location_id in (select id from inventory.locations where code like 'DEMO-%')
    or to_location_id   in (select id from inventory.locations where code like 'DEMO-%');
alter table inventory.stock_transfer_lines enable trigger stock_transfer_lines_flow_trg;
alter table inventory.stock_transfers enable trigger stock_transfers_flow_trg;

delete from inventory.stock_balances
 where item_id in (select id from inventory.items where internal_item_code like 'DEMO-%')
    or location_id in (select id from inventory.locations where code like 'DEMO-%');
delete from inventory.reorder_levels
 where item_id in (select id from inventory.items where internal_item_code like 'DEMO-%')
    or location_id in (select id from inventory.locations where code like 'DEMO-%');
-- racks and bins of DEMO places (and the products placed in them)
delete from inventory.item_bins where location_id in (select id from inventory.locations where code like 'DEMO-%');
delete from inventory.storage_bins where location_id in (select id from inventory.locations where code like 'DEMO-%');
delete from inventory.user_locations where location_id in (select id from inventory.locations where code like 'DEMO-%');
delete from inventory.item_barcodes where item_id in (select id from inventory.items where internal_item_code like 'DEMO-%');
delete from inventory.items where internal_item_code like 'DEMO-%';
delete from inventory.locations where code like 'DEMO-%';
delete from inventory.categories where name like 'DEMO %';
delete from inventory.suppliers where name like 'DEMO %';
-- DEMO customers that no bill points at (a customer with a bill must stay: bills are history)
delete from inventory.customers where name like 'DEMO %' and id not in (select customer_id from inventory.bills where customer_id is not null);

commit;
