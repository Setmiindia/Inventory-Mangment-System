-- New enum values must be committed before they can be used, so they get their own migration.
-- TRANSIT: the hidden system place that holds goods while they are on the way between two places.
-- TRANSFER_SHORTAGE: stock that left a place but did not arrive (booked out of the in-transit place).
alter type inventory.location_type add value if not exists 'TRANSIT';
alter type inventory.stock_movement_type add value if not exists 'TRANSFER_SHORTAGE';
