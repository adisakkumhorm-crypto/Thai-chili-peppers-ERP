-- Add partially_received to po_status enum
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partially_received';

-- Add received_quantity to purchase_order_items
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity integer not null default 0;
