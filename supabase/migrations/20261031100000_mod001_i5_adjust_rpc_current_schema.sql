-- MOD-001 I-5
-- Current-schema Inventory Adjust RPC.
--
-- IMPORTANT:
-- The historical 20260912000000_step36_inventory_adjust_rpc.sql migration
-- was never applied to production and references the removed
-- inventory_transactions.reason column.
--
-- This migration intentionally keeps the existing application RPC argument
-- p_reason for compatibility, but stores that value in batch_qr_code, which
-- is the current production schema column used by the Inventory action.

CREATE OR REPLACE FUNCTION public.rpc_adjust_stock(
    p_org_id UUID,
    p_product_id UUID,
    p_location_id UUID,
    p_quantity INTEGER,
    p_unit_cost NUMERIC DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_product RECORD;
    v_balance RECORD;
    v_current_avg_cost NUMERIC(19,4);
    v_tx_unit_cost NUMERIC(19,4);
    v_tx_total_cost NUMERIC(19,4);
    v_new_total_qty INTEGER;
    v_new_total_value NUMERIC(19,4);
    v_new_avg_cost NUMERIC(19,4);
    v_available_qty INTEGER;
BEGIN
    -- 1) Validate request contract.
    IF p_quantity = 0 THEN
        RAISE EXCEPTION 'Quantity cannot be zero';
    END IF;

    IF p_user_id IS NULL THEN
        RAISE EXCEPTION
            'Authenticated user context is required for stock adjustment';
    END IF;

    IF p_quantity > 0
       AND (p_unit_cost IS NULL OR p_unit_cost < 0) THEN
        RAISE EXCEPTION
            'Positive adjustment requires explicit non-negative unit_cost';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.inventory_locations
        WHERE id = p_location_id
          AND org_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Inventory location not found or access denied';
    END IF;

    -- 2) Idempotency.
    --
    -- Non-transfer inventory transactions have a unique
    -- (org_id, idempotency_key) index. A duplicate key is accepted only
    -- when it represents the same adjustment request.
    IF p_idempotency_key IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.inventory_transactions
            WHERE org_id = p_org_id
              AND idempotency_key = p_idempotency_key
       ) THEN

        IF NOT EXISTS (
            SELECT 1
            FROM public.inventory_transactions
            WHERE org_id = p_org_id
              AND idempotency_key = p_idempotency_key
              AND transaction_type = 'adjust'
              AND product_id = p_product_id
              AND location_id = p_location_id
              AND quantity = p_quantity
              AND reference_no IS NOT DISTINCT FROM p_reference_no
              AND batch_qr_code IS NOT DISTINCT FROM p_reason
              AND (
                    p_quantity < 0
                    OR unit_cost IS NOT DISTINCT FROM p_unit_cost
                  )
        ) THEN
            RAISE EXCEPTION
                'Idempotency conflict: Key % used for a different request',
                p_idempotency_key;
        END IF;

        RETURN;
    END IF;

    -- 3) Product lock first to preserve the Inventory lock hierarchy.
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = p_product_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found or access denied';
    END IF;

    -- Keep valuation behavior consistent with Receive / Issue.
    IF v_product.stock_quantity > 0
       AND COALESCE(v_product.average_cost, 0) = 0
       AND COALESCE(v_product.total_inventory_value, 0) = 0 THEN
        RAISE EXCEPTION
            'OPENING_INVENTORY_REQUIRED: Cannot adjust valuation for legacy unvalued stock';
    END IF;

    v_current_avg_cost := COALESCE(v_product.average_cost, 0);

    -- 4) Lock the target location balance after the product lock.
    SELECT *
    INTO v_balance
    FROM public.inventory_balances
    WHERE org_id = p_org_id
      AND product_id = p_product_id
      AND location_id = p_location_id
    FOR UPDATE;

    -- 5) Apply balance movement and calculate transaction valuation.
    IF p_quantity > 0 THEN

        v_tx_unit_cost := ROUND(p_unit_cost, 4);
        v_tx_total_cost := ROUND(p_quantity * v_tx_unit_cost, 4);
        v_new_total_value :=
            COALESCE(v_product.total_inventory_value, 0)
            + v_tx_total_cost;

        INSERT INTO public.inventory_balances (
            org_id,
            product_id,
            location_id,
            on_hand_quantity,
            allocated_quantity
        )
        VALUES (
            p_org_id,
            p_product_id,
            p_location_id,
            p_quantity,
            0
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            on_hand_quantity =
                public.inventory_balances.on_hand_quantity
                + EXCLUDED.on_hand_quantity,
            updated_at = NOW();

    ELSE

        IF v_balance IS NULL THEN
            RAISE EXCEPTION
                'Inventory balance not found for this product and location';
        END IF;

        v_available_qty :=
            v_balance.on_hand_quantity
            - v_balance.allocated_quantity;

        IF ABS(p_quantity) > v_available_qty THEN
            RAISE EXCEPTION
                'Insufficient available stock for adjustment (Available: %, Requested: %)',
                v_available_qty,
                ABS(p_quantity);
        END IF;

        v_tx_unit_cost := v_current_avg_cost;
        v_tx_total_cost :=
            ROUND(ABS(p_quantity) * v_tx_unit_cost, 4);

        UPDATE public.inventory_balances
        SET on_hand_quantity = on_hand_quantity + p_quantity,
            updated_at = NOW()
        WHERE id = v_balance.id;

    END IF;

    -- 6) Recalculate the authoritative aggregate quantity from balances.
    SELECT COALESCE(SUM(on_hand_quantity), 0)::INTEGER
    INTO v_new_total_qty
    FROM public.inventory_balances
    WHERE org_id = p_org_id
      AND product_id = p_product_id;

    IF v_new_total_qty < 0 THEN
        RAISE EXCEPTION
            'Invalid resulting inventory quantity';
    END IF;

    -- 7) Final valuation.
    IF p_quantity > 0 THEN

        IF v_new_total_qty > 0 THEN
            v_new_avg_cost :=
                ROUND(v_new_total_value / v_new_total_qty, 4);
        ELSE
            v_new_avg_cost := 0;
            v_new_total_value := 0;
        END IF;

    ELSE

        IF v_new_total_qty = 0 THEN
            v_new_avg_cost := 0;
            v_new_total_value := 0;
        ELSE
            v_new_avg_cost := v_current_avg_cost;
            v_new_total_value :=
                COALESCE(v_product.total_inventory_value, 0)
                - v_tx_total_cost;

            IF v_new_total_value < 0 THEN
                v_new_total_value := 0;
            END IF;
        END IF;

    END IF;

    -- 8) Update product valuation through the existing protection seam.
    PERFORM set_config(
        'app.bypass_cost_readonly',
        'true',
        true
    );

    UPDATE public.products
    SET stock_quantity = v_new_total_qty,
        average_cost = v_new_avg_cost,
        total_inventory_value = v_new_total_value,
        updated_at = NOW()
    WHERE id = p_product_id
      AND org_id = p_org_id;

    PERFORM set_config(
        'app.bypass_cost_readonly',
        'false',
        true
    );

    -- 9) Record one immutable adjustment transaction.
    --
    -- p_reason remains the RPC compatibility name used by the current
    -- Inventory action. Current production schema stores it in batch_qr_code.
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
    )
    VALUES (
        p_org_id,
        p_product_id,
        p_location_id,
        'adjust',
        p_quantity,
        v_tx_unit_cost,
        v_tx_total_cost,
        p_reference_no,
        p_reason,
        p_user_id,
        p_idempotency_key
    );
END;
$function$;

REVOKE ALL
ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_adjust_stock(
    UUID,
    UUID,
    UUID,
    INTEGER,
    NUMERIC,
    TEXT,
    TEXT,
    TEXT,
    UUID
)
IS 'MOD-001 I-5 current-schema inventory stock adjustment RPC';
