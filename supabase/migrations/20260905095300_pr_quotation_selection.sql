-- ========================================================================================
-- ERP Purchase Request (PR) Step 6 - Quotation Comparison & Selection
-- ========================================================================================

ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'in_procurement';

ALTER TABLE purchase_requests 
ADD COLUMN selected_quotation_id UUID REFERENCES pr_quotations(id) ON DELETE SET NULL,
ADD COLUMN selection_reason TEXT,
ADD COLUMN selected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN selected_at TIMESTAMPTZ;
