-- ========================================================================================
-- ERP Purchase Request (PR) Step 7 - Approval
-- ========================================================================================

ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'revision_requested' AFTER 'rejected';

ALTER TABLE purchase_requests 
ADD COLUMN approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN rejected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN rejected_at TIMESTAMPTZ,
ADD COLUMN rejection_reason TEXT,
ADD COLUMN revision_requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN revision_requested_at TIMESTAMPTZ,
ADD COLUMN revision_reason TEXT;
