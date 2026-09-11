-- Migration: Direct Receive RPC

CREATE OR REPLACE FUNCTION rpc_receive_stock_direct(
    p_org_id UUID,
    p_location_id UUID,
    p_product_id UUID,
    p_quantity INTEGER,
    p_unit_cost NUMERIC,
    p_reference_no TEXT,
    p_batch_qr_code TEXT,
    p_idempotency_key TEXT,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_product RECORD;
    v_new_total_qty INTEGER;
    v_new_total_value NUMERIC(19,4);
    v_new_avg_cost NUMERIC(19,4);
    v_tx_total_cost NUMERIC(19,4);
BEGIN
    -- 1. Validate inputs
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
        RAISE EXCEPTION 'Unit cost is required and cannot be negative';
    END IF;

    -- 2. Check Idempotency Key
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM inventory_transactions 
            WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key
        ) THEN
            -- Already processed, safe return
            RETURN;
        END IF;
    END IF;

    -- 3. Lock Product
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- 4. Check for legacy unvalued stock
    IF v_product.stock_quantity > 0 AND v_product.average_cost = 0 AND v_product.total_inventory_value = 0 THEN
        RAISE EXCEPTION 'OPENING_INVENTORY_REQUIRED: Cannot receive new stock into unvalued legacy stock. Please set opening inventory first.';
    END IF;

    -- 5. Lock Inventory Balance
    PERFORM 1
    FROM public.inventory_balances
    WHERE product_id = p_product_id AND location_id = p_location_id AND org_id = p_org_id
    FOR UPDATE;

    -- 6. Calculate Moving Average
    v_tx_total_cost := p_quantity * p_unit_cost;
    v_new_total_qty := v_product.stock_quantity + p_quantity;
    v_new_total_value := v_product.total_inventory_value + v_tx_total_cost;
    
    IF v_new_total_qty > 0 THEN
        v_new_avg_cost := ROUND(v_new_total_value / v_new_total_qty, 4);
    ELSE
        v_new_avg_cost := 0;
    END IF;

    -- 7. Update Inventory Balance
    INSERT INTO public.inventory_balances (
        org_id, product_id, location_id, on_hand_quantity, allocated_quantity
    ) VALUES (
        p_org_id, p_product_id, p_location_id, p_quantity, 0
    )
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET 
        on_hand_quantity = inventory_balances.on_hand_quantity + EXCLUDED.on_hand_quantity,
        updated_at = NOW();

    -- 8. Update Product Aggregate
    PERFORM set_config('app.bypass_cost_readonly', 'true', true);

    UPDATE public.products
    SET stock_quantity = v_new_total_qty,
        average_cost = v_new_avg_cost,
        total_inventory_value = v_new_total_value,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- 9. Insert Transaction History
    INSERT INTO public.inventory_transactions (
        org_id,
        product_id,
        location_id,
        transaction_type,
        quantity,
        unit_cost,
        total_cost,
        reference_no,
        batch_qr_code,
        created_by,
        idempotency_key
    ) VALUES (
        p_org_id,
        p_product_id,
        p_location_id,
        'receive',
        p_quantity,
        p_unit_cost,
        v_tx_total_cost,
        p_reference_no,
        p_batch_qr_code,
        p_user_id,
        p_idempotency_key
    );

END;
$$;
