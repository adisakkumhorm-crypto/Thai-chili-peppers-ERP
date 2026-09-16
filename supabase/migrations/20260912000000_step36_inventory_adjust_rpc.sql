-- Migration: 20260912000000_step36_inventory_adjust_rpc.sql
-- Description: Inventory Adjustment RPC with Moving Average Cost Calculation

CREATE OR REPLACE FUNCTION rpc_adjust_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_location_id UUID,
    p_quantity INTEGER,
    p_unit_cost NUMERIC DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_product RECORD;
    v_balance RECORD;
    v_existing_tx UUID;
    v_new_total_qty INTEGER;
    v_new_total_value NUMERIC(19,4);
    v_new_avg_cost NUMERIC(19,4);
    v_tx_total_cost NUMERIC(19,4);
    v_current_avg_cost NUMERIC(19,4);
    v_available_qty INTEGER;
BEGIN
    -- 1. Validate Quantity
    IF p_quantity = 0 THEN
        RAISE EXCEPTION 'Quantity cannot be zero';
    END IF;

    -- 2. Check Idempotency Key
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_tx
        FROM public.inventory_transactions
        WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Idempotency hit: safe return (already processed)
            RETURN;
        END IF;
    END IF;

    -- 3. Lock Product (First in hierarchy to prevent deadlocks)
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    v_current_avg_cost := COALESCE(v_product.average_cost, 0);

    -- 4. Lock Inventory Balance
    SELECT * INTO v_balance
    FROM public.inventory_balances
    WHERE product_id = p_product_id AND location_id = p_location_id AND org_id = p_org_id
    FOR UPDATE;

    -- 5. Process Adjustment Based on Quantity Sign
    IF p_quantity > 0 THEN
        -- POSITIVE ADJUSTMENT (Add Stock)
        -- Must have explicit unit_cost
        IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN
            RAISE EXCEPTION 'Positive adjustment requires explicit non-negative unit_cost';
        END IF;

        -- Calculate new moving average
        v_tx_total_cost := p_quantity * p_unit_cost;
        v_new_total_qty := v_product.stock_quantity + p_quantity;
        v_new_total_value := v_product.total_inventory_value + v_tx_total_cost;

        IF v_new_total_qty > 0 THEN
            v_new_avg_cost := ROUND(v_new_total_value / v_new_total_qty, 4);
        ELSE
            v_new_avg_cost := 0;
        END IF;

        -- Update Inventory Balance (Upsert for new location)
        INSERT INTO public.inventory_balances (
            org_id, product_id, location_id, on_hand_quantity, allocated_quantity
        ) VALUES (
            p_org_id, p_product_id, p_location_id, p_quantity, 0
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            on_hand_quantity = inventory_balances.on_hand_quantity + EXCLUDED.on_hand_quantity,
            updated_at = NOW();

        -- Update Product Aggregate with new moving average
        PERFORM set_config('app.bypass_cost_readonly', 'true', true);

        UPDATE public.products
        SET stock_quantity = v_new_total_qty,
            average_cost = v_new_avg_cost,
            total_inventory_value = v_new_total_value,
            updated_at = NOW()
        WHERE id = p_product_id;

    ELSE
        -- NEGATIVE ADJUSTMENT (Remove Stock)
        -- Use current average cost as frozen unit cost
        v_tx_total_cost := ABS(p_quantity) * v_current_avg_cost;
        v_new_total_qty := v_product.stock_quantity + p_quantity; -- p_quantity is negative

        -- Validate: Cannot reduce below allocated quantity
        IF v_balance IS NULL THEN
            RAISE EXCEPTION 'Inventory balance not found for this product and location';
        END IF;

        v_available_qty := v_balance.on_hand_quantity - v_balance.allocated_quantity;
        IF ABS(p_quantity) > v_available_qty THEN
            RAISE EXCEPTION 'Insufficient available stock for adjustment (Available: %, Requested: %)', v_available_qty, ABS(p_quantity);
        END IF;

        -- Update Inventory Balance
        UPDATE public.inventory_balances
        SET on_hand_quantity = on_hand_quantity + p_quantity  -- p_quantity is negative
        WHERE id = v_balance.id;

        -- Update Product Aggregate (no average cost change)
        PERFORM set_config('app.bypass_cost_readonly', 'true', true);

        UPDATE public.products
        SET stock_quantity = v_new_total_qty,
            -- average_cost stays the same
            total_inventory_value = v_product.total_inventory_value - v_tx_total_cost,
            updated_at = NOW()
        WHERE id = p_product_id;

        -- Force total value to 0 if quantity becomes 0
        IF v_new_total_qty = 0 THEN
            UPDATE public.products
            SET total_inventory_value = 0,
                average_cost = 0,
                updated_at = NOW()
            WHERE id = p_product_id;
        END IF;
    END IF;

    -- 6. Insert Transaction History
    INSERT INTO public.inventory_transactions (
        org_id,
        product_id,
        location_id,
        transaction_type,
        quantity,
        unit_cost,
        total_cost,
        reference_no,
        reason,
        created_by,
        idempotency_key
    ) VALUES (
        p_org_id,
        p_product_id,
        p_location_id,
        'adjust',
        p_quantity,
        CASE
            WHEN p_quantity > 0 THEN p_unit_cost
            ELSE v_current_avg_cost
        END,
        v_tx_total_cost,
        p_reference_no,
        p_reason,
        p_user_id,
        p_idempotency_key
    );

END;
$$;
