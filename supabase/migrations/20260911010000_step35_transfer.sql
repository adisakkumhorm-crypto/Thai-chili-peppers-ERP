-- Migration: 20260911010000_step35_transfer.sql
-- Description: Inventory Transfer Engine

-- Adjust idempotency unique constraint to allow two rows (source/dest) for transfers
DROP INDEX IF EXISTS idx_inventory_transactions_idempotency;

CREATE UNIQUE INDEX idx_inv_tx_idempotency_non_transfer 
ON inventory_transactions (org_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL AND transaction_type != 'transfer';

CREATE UNIQUE INDEX idx_inv_tx_idempotency_transfer 
ON inventory_transactions (org_id, idempotency_key, location_id) 
WHERE idempotency_key IS NOT NULL AND transaction_type = 'transfer';

CREATE OR REPLACE FUNCTION rpc_transfer_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_from_location_id UUID,
    p_to_location_id UUID,
    p_quantity INTEGER,
    p_reference_no TEXT,
    p_idempotency_key TEXT,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_product RECORD;
    v_source_balance RECORD;
    v_available_qty INTEGER;
    v_total_on_hand INTEGER;
    v_unit_cost NUMERIC;
    v_first_loc UUID;
    v_second_loc UUID;
BEGIN
    -- 1. Validation
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Transfer quantity must be greater than 0';
    END IF;

    IF p_from_location_id IS NULL OR p_to_location_id IS NULL THEN
        RAISE EXCEPTION 'Source and destination locations are required';
    END IF;

    IF p_from_location_id = p_to_location_id THEN
        RAISE EXCEPTION 'Source and destination locations cannot be the same';
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM inventory_transactions
            WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key
        ) THEN
            -- Check if it matches the current request (checking source deduction)
            IF NOT EXISTS (
                SELECT 1 FROM inventory_transactions
                WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key
                  AND transaction_type = 'transfer'
                  AND product_id = p_product_id
                  AND location_id = p_from_location_id
                  AND quantity = -p_quantity
            ) THEN
                RAISE EXCEPTION 'Idempotency conflict: Key % used for a different request', p_idempotency_key;
            END IF;
            RETURN;
        END IF;
    END IF;

    -- 3. Lock Product (First in hierarchy, prevents deadlocks with Receive/Issue)
    SELECT * INTO v_product
    FROM products
    WHERE id = p_product_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied';
    END IF;

    v_unit_cost := COALESCE(v_product.average_cost, 0);

    -- 4. Lock Balances Deterministically
    IF p_from_location_id < p_to_location_id THEN
        v_first_loc := p_from_location_id;
        v_second_loc := p_to_location_id;
    ELSE
        v_first_loc := p_to_location_id;
        v_second_loc := p_from_location_id;
    END IF;

    -- Lock first location
    PERFORM 1 FROM inventory_balances WHERE product_id = p_product_id AND location_id = v_first_loc FOR UPDATE;
    -- Lock second location
    PERFORM 1 FROM inventory_balances WHERE product_id = p_product_id AND location_id = v_second_loc FOR UPDATE;

    -- 5. Validate and Deduct Source
    SELECT * INTO v_source_balance
    FROM inventory_balances
    WHERE product_id = p_product_id AND location_id = p_from_location_id AND org_id = p_org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source location balance not found';
    END IF;

    v_available_qty := v_source_balance.on_hand_quantity - v_source_balance.allocated_quantity;
    IF v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient available quantity in source location';
    END IF;

    UPDATE inventory_balances
    SET on_hand_quantity = on_hand_quantity - p_quantity
    WHERE id = v_source_balance.id;

    -- 6. Validate Destination Location
    IF NOT EXISTS (SELECT 1 FROM inventory_locations WHERE id = p_to_location_id AND org_id = p_org_id) THEN
        RAISE EXCEPTION 'Destination location not found or access denied';
    END IF;

    -- Upsert Destination Balance
    INSERT INTO inventory_balances (
        org_id, product_id, location_id, on_hand_quantity, allocated_quantity
    ) VALUES (
        p_org_id, p_product_id, p_to_location_id, p_quantity, 0
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET 
        on_hand_quantity = inventory_balances.on_hand_quantity + EXCLUDED.on_hand_quantity;

    -- 7. Sync Product Aggregate (stock_quantity = SUM(on_hand_quantity))
    SELECT COALESCE(SUM(on_hand_quantity), 0) INTO v_total_on_hand
    FROM inventory_balances
    WHERE product_id = p_product_id AND org_id = p_org_id;

    UPDATE products
    SET stock_quantity = v_total_on_hand
    WHERE id = p_product_id;

    -- 8. Insert Transactions (Source and Destination)
    -- Source (Negative Qty, but total_cost must be positive to satisfy DB check constraint)
    INSERT INTO inventory_transactions (
        org_id, product_id, location_id, transaction_type, quantity, 
        unit_cost, total_cost, reference_no, batch_qr_code, 
        created_by, idempotency_key
    ) VALUES (
        p_org_id, p_product_id, p_from_location_id, 'transfer', -p_quantity,
        v_unit_cost, (p_quantity * v_unit_cost), p_reference_no, NULL,
        p_user_id, p_idempotency_key
    );

    -- Destination (Positive Qty)
    INSERT INTO inventory_transactions (
        org_id, product_id, location_id, transaction_type, quantity, 
        unit_cost, total_cost, reference_no, batch_qr_code, 
        created_by, idempotency_key
    ) VALUES (
        p_org_id, p_product_id, p_to_location_id, 'transfer', p_quantity,
        v_unit_cost, (p_quantity * v_unit_cost), p_reference_no, NULL,
        p_user_id, p_idempotency_key
    );

END;
$$;
