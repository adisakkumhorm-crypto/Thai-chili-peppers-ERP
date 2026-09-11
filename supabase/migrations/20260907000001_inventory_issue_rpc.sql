-- 1. Ensure idempotency_key exists on inventory_transactions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='inventory_transactions' AND column_name='idempotency_key') THEN
        ALTER TABLE public.inventory_transactions ADD COLUMN idempotency_key UUID;
    END IF;
END $$;

-- Drop index if exists to avoid conflicts, then create unique index for idempotency
DROP INDEX IF EXISTS idx_inventory_transactions_idempotency;
CREATE UNIQUE INDEX idx_inventory_transactions_idempotency 
ON public.inventory_transactions (org_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. Create RPC for Issue Stock
CREATE OR REPLACE FUNCTION rpc_issue_stock(
    p_org_id UUID,
    p_mode TEXT, -- 'DIRECT' or 'ALLOCATED_FULFILLMENT'
    p_quantity INT,
    p_idempotency_key UUID,
    p_user_id UUID,
    
    -- For DIRECT
    p_product_id UUID DEFAULT NULL,
    p_location_id UUID DEFAULT NULL,
    p_reference_no TEXT DEFAULT NULL,
    
    -- For ALLOCATED_FULFILLMENT
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
    v_product_stock INT;
    v_so_status TEXT;
BEGIN
    -- 0. Check Idempotency First
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_tx
        FROM public.inventory_transactions
        WHERE org_id = p_org_id AND idempotency_key = p_idempotency_key;

        IF FOUND THEN
            -- Idempotency hit: return existing transaction
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

    -- 1. Derive & Validate Inputs based on Mode
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

        -- Retrieve SO item details and check order status lock implicitly if needed (we just need the location and product)
        SELECT i.product_id, i.location_id, i.quantity, o.status
        INTO v_product_id, v_location_id, v_so_item_qty, v_so_status
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

    -- 2. Lock the Inventory Balance Row FOR UPDATE
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

    -- 3. Check availability based on Mode
    IF p_mode = 'DIRECT' THEN
        IF p_quantity > v_available THEN
            RAISE EXCEPTION 'Insufficient available stock for DIRECT issue (Available: %, Requested: %)', v_available, p_quantity;
        END IF;
        
        -- DIRECT: Decrease on_hand, leave allocated unchanged
        v_on_hand := v_on_hand - p_quantity;
        
    ELSIF p_mode = 'ALLOCATED_FULFILLMENT' THEN
        IF p_quantity > v_allocated THEN
            RAISE EXCEPTION 'Insufficient allocated stock for fulfillment (Allocated: %, Requested: %)', v_allocated, p_quantity;
        END IF;
        
        IF p_quantity > v_on_hand THEN
            RAISE EXCEPTION 'Insufficient on hand stock for fulfillment (On Hand: %, Requested: %)', v_on_hand, p_quantity;
        END IF;

        -- ALLOCATED_FULFILLMENT: Decrease BOTH on_hand and allocated
        v_on_hand := v_on_hand - p_quantity;
        v_allocated := v_allocated - p_quantity;
    END IF;

    -- 4. Update Inventory Balance
    UPDATE public.inventory_balances
    SET on_hand_quantity = v_on_hand,
        allocated_quantity = v_allocated,
        updated_at = NOW()
    WHERE id = v_balance_id;

    -- 5. Update Global Product Stock
    SELECT stock_quantity INTO v_product_stock
    FROM public.products
    WHERE id = v_product_id AND org_id = p_org_id
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.products
        SET stock_quantity = GREATEST(0, v_product_stock - p_quantity),
            updated_at = NOW()
        WHERE id = v_product_id;
    END IF;

    -- 6. Insert Transaction
    INSERT INTO public.inventory_transactions (
        org_id,
        product_id,
        location_id,
        transaction_type,
        quantity,
        reference_no,
        idempotency_key,
        created_by,
        created_at
    ) VALUES (
        p_org_id,
        v_product_id,
        v_location_id,
        'issue',
        p_quantity,
        COALESCE(p_reference_no, (CASE WHEN p_mode = 'ALLOCATED_FULFILLMENT' THEN 'SO_ITEM:' || p_sales_order_item_id ELSE NULL END)),
        p_idempotency_key,
        p_user_id,
        NOW()
    ) RETURNING id INTO v_transaction_id;

    -- 7. Return Success
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_on_hand', v_on_hand,
        'new_allocated', v_allocated
    );

END;
$$ LANGUAGE plpgsql;
