-- Link Costs to Purchase Orders and Suppliers
ALTER TABLE costs ADD COLUMN po_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;
ALTER TABLE costs ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
