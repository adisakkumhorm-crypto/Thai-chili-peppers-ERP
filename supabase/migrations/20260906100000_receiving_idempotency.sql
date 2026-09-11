ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE INDEX IF NOT EXISTS idx_inv_tx_idempotency ON inventory_transactions(idempotency_key);
