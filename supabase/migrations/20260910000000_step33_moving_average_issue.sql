-- PHASE 7 STEP C: Moving Average Issue / Ship Cost Engine

CREATE OR REPLACE FUNCTION public.rpc_issue_stock(
    p_org_id UUID,
    p_mode TEXT,
    p_quantity INT,
    p_idempotency_key TEXT,
    p_user_id UUID,
    p_product_id UUID DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    p_sales_order_item_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_product_id UUID;
    v_location_id UUID;
    v_balance_id UUID;
    v_on_hand INT;
    v_allocated INT;
    v_available INT;
    v_transaction_id UUID;
    v_so_item_qty INT;
    v_existing_tx UUID;
    v_so_status TEXT;
    v_so_number TEXT;
    
    -- Valuation vars
    v_product RECORD;
    v_issue_unit_cost NUMERIC(19,4);
    v_issue_total_cost NUMERIC(19,4);
    v_new_total_val NUMERIC(19,4);
    v_new_stock_qty INT;
BEGIN
    -- 0. Check Idempotency First
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_tx
        FROM public.inventory_transactions
        WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'transaction_id', v_existing_tx,
                'message', 'Idempotent request, stock already issued.'
            );
        END IF;
    END IF;

    -- Validate Quantity
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    -- 1. Derive & Validate Inputs
    IF p_mode = 'DIRECT' THEN
        IF p_product_id IS NULL OR p_location_id IS NULL THEN
            RAISE EXCEPTION 'DIRECT mode requires product_id and location_id';
        END IF;
        v_product_id := p_product_id;
        v_location_id := p_location_id;

    ELSIF p_mode = 'ALLOCATED_FULFILLMENT' THEN
        IF p_sales_order_item_id IS NULL THEN
            RAISE EXCEPTION 'ALLOCATED_FULFILLMENT mode requires sales_order_item_id';
        END IF;

        SELECT i.product_id, i.location_id, i.quantity, o.status, o.order_number
        INTO v_product_id, v_location_id, v_so_item_qty, v_so_status, v_so_number
        FROM public.sales_order_items i
        JOIN public.sales_orders o ON o.id = i.order_id
        WHERE i.id = p_sales_order_item_id AND i.org_id = p_org_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Sales order item not found';
        END IF;

        IF v_location_id IS NULL THEN
            RAISE EXCEPTION 'Sales order item does not have a location assigned. Cannot fulfill.';
        END IF;
        
        IF p_quantity > v_so_item_qty THEN
            RAISE EXCEPTION 'Issue quantity exceeds sales order item quantity';
        END IF;

    ELSE
        RAISE EXCEPTION 'Invalid issue mode: %', p_mode;
    END IF;

    -- 2. CRITICAL LOCK HIERARCHY FIX: Lock Products FIRST, then Balances.
    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- Legacy protection
    IF v_product.stock_quantity > 0 AND v_product.average_cost = 0 AND v_product.total_inventory_value = 0 THEN
        RAISE EXCEPTION 'OPENING_INVENTORY_REQUIRED: Cannot issue valuation for legacy product % without opening inventory balance', v_product.name;
    END IF;

    -- 3. Lock Inventory Balance SECOND
    SELECT id, on_hand_quantity, allocated_quantity
    INTO v_balance_id, v_on_hand, v_allocated
    FROM public.inventory_balances
    WHERE org_id = p_org_id 
      AND product_id = v_product_id 
      AND location_id = v_location_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory balance not found for product at this location';
    END IF;

    v_available := v_on_hand - v_allocated;

    -- 4. Check availability based on Mode
    IF p_mode = 'DIRECT' THEN
        IF p_quantity > v_available THEN
            RAISE EXCEPTION 'Insufficient available stock for DIRECT issue (Available: %, Requested: %)', v_available, p_quantity;
        END IF;
        
        v_on_hand := v_on_hand - p_quantity;
        
    ELSIF p_mode = 'ALLOCATED_FULFILLMENT' THEN
        IF p_quantity > v_allocated THEN
            RAISE EXCEPTION 'Insufficient allocated stock for fulfillment (Allocated: %, Requested: %)', v_allocated, p_quantity;
        END IF;
        
        IF p_quantity > v_on_hand THEN
            RAISE EXCEPTION 'Insufficient on hand stock for fulfillment (On Hand: %, Requested: %)', v_on_hand, p_quantity;
        END IF;

        v_on_hand := v_on_hand - p_quantity;
        v_allocated := v_allocated - p_quantity;
    END IF;

    -- 5. Calculate Valuation Issue Cost
    v_issue_unit_cost := v_product.average_cost;
    v_issue_total_cost := (p_quantity * v_issue_unit_cost)::NUMERIC(19,4);
    
    v_new_stock_qty := v_product.stock_quantity - p_quantity;

    -- If all stock depleted company-wide, force value to strictly 0 to clear precision residue
    IF v_new_stock_qty <= 0 THEN
        v_issue_total_cost := v_product.total_inventory_value;
        v_new_total_val := 0;
    ELSE
        v_new_total_val := v_product.total_inventory_value - v_issue_total_cost;
        -- Failsafe against precision underflow making value negative
        IF v_new_total_val < 0 THEN
             v_new_total_val := 0;
        END IF;
    END IF;

    -- 6. Execute Updates
    UPDATE public.inventory_balances
    SET on_hand_quantity = v_on_hand,
        allocated_quantity = v_allocated,
        updated_at = NOW()
    WHERE id = v_balance_id;

    -- Bypass UI readonly trigger
    PERFORM set_config('app.bypass_cost_readonly', 'true', true);

    UPDATE public.products
    SET stock_quantity = v_new_stock_qty,
        total_inventory_value = v_new_total_val,
        updated_at = NOW()
    WHERE id = v_product_id;

    PERFORM set_config('app.bypass_cost_readonly', 'false', true);

    -- 7. Insert Transaction with Frozen Historical Cost
    INSERT INTO public.inventory_transactions (
        org_id, product_id, location_id, transaction_type, quantity, reference_no, idempotency_key, created_by, created_at, unit_cost, total_cost
    ) VALUES (
        p_org_id, v_product_id, v_location_id, 'issue', p_quantity,
        COALESCE(p_reference_no, (CASE WHEN p_mode = 'ALLOCATED_FULFILLMENT' THEN 'SO:' || v_so_number || '-ITEM:' || p_sales_order_item_id ELSE NULL END)),
        p_idempotency_key, p_user_id, NOW(), v_issue_unit_cost, v_issue_total_cost
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_on_hand', v_on_hand,
        'new_allocated', v_allocated
    );

END;
$$ LANGUAGE plpgsql;
