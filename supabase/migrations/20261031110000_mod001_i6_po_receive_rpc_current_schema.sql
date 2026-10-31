-- MOD-001 I-6
-- Correct the Purchase Order receive RPC before routing it through a
-- capability seam.
--
-- Production defects proven in isolated validation:
--   1. A multi-item receipt reused one idempotency key on every transaction,
--      colliding with the non-transfer unique idempotency index.
--   2. JSON product_id was trusted instead of the authoritative PO item.
--   3. A zero-quantity batch could mutate PO status.
--   4. A location from another organization could be accepted.
--
-- Keep the existing six-argument RPC signature for caller compatibility.
-- Use one batch idempotency key externally and derive one deterministic
-- transaction idempotency key per PO item internally.

CREATE OR REPLACE FUNCTION public.rpc_receive_po_items(
    p_po_id UUID,
    p_location_id UUID,
    p_org_id UUID,
    p_user_id UUID,
    p_items JSONB,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_po RECORD;
    v_item JSONB;
    v_po_item RECORD;
    v_product RECORD;

    v_po_item_id UUID;
    v_supplied_product_id UUID;
    v_qty_to_receive INTEGER;

    v_request_count INTEGER;
    v_distinct_item_count INTEGER;
    v_matching_item_count INTEGER;

    v_existing_batch_tx_count INTEGER;
    v_exact_batch_tx_count INTEGER;

    v_remaining INTEGER;
    v_unit_cost NUMERIC(19,4);
    v_total_cost NUMERIC(19,4);
    v_new_total_qty INTEGER;
    v_new_total_value NUMERIC(19,4);
    v_new_avg_cost NUMERIC(19,4);

    v_tx_key_prefix TEXT;
    v_tx_key TEXT;

    v_all_fully_received BOOLEAN := TRUE;
BEGIN
    -- 1) Request contract.
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION
            'Authenticated user context is required for PO receipt';
    END IF;

    IF p_idempotency_key IS NULL
       OR btrim(p_idempotency_key) = '' THEN
        RAISE EXCEPTION
            'Idempotency key is required for PO receipt';
    END IF;

    IF p_items IS NULL
       OR jsonb_typeof(p_items) <> 'array'
       OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'No items to receive';
    END IF;

    -- The current UI sends only quantityToReceive > 0. Fail closed at the
    -- database boundary instead of silently ignoring invalid lines.
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS j(item)
        WHERE NOT (j.item ? 'id')
           OR NOT (j.item ? 'quantityToReceive')
           OR NULLIF(j.item->>'id', '') IS NULL
           OR NULLIF(j.item->>'quantityToReceive', '') IS NULL
           OR (j.item->>'quantityToReceive')::INTEGER <= 0
    ) THEN
        RAISE EXCEPTION
            'PO receipt quantities must be greater than 0';
    END IF;

    SELECT
        count(*),
        count(DISTINCT (j.item->>'id')::UUID)
    INTO
        v_request_count,
        v_distinct_item_count
    FROM jsonb_array_elements(p_items) AS j(item);

    IF v_request_count <> v_distinct_item_count THEN
        RAISE EXCEPTION
            'Duplicate PO item ids are not allowed in one receipt batch';
    END IF;

    -- 2) Location must belong to the request organization.
    IF NOT EXISTS (
        SELECT 1
        FROM public.inventory_locations
        WHERE id = p_location_id
          AND org_id = p_org_id
    ) THEN
        RAISE EXCEPTION
            'Inventory location not found or access denied';
    END IF;

    -- 3) Lock the PO to serialize receives for the same order.
    SELECT *
    INTO v_po
    FROM public.purchase_orders
    WHERE id = p_po_id
      AND org_id = p_org_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PO not found';
    END IF;

    -- 4) Every requested item must belong to this PO and organization.
    SELECT count(*)
    INTO v_matching_item_count
    FROM public.purchase_order_items poi
    JOIN (
        SELECT DISTINCT (j.item->>'id')::UUID AS po_item_id
        FROM jsonb_array_elements(p_items) AS j(item)
    ) requested
      ON requested.po_item_id = poi.id
    WHERE poi.po_id = p_po_id
      AND poi.org_id = p_org_id;

    IF v_matching_item_count <> v_request_count THEN
        RAISE EXCEPTION
            'One or more PO items were not found or do not belong to this PO';
    END IF;

    -- The PO item is authoritative for product identity. product_id remains
    -- accepted in the JSON payload for compatibility, but when supplied it
    -- must match the locked PO item.
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_items) AS j(item)
        JOIN public.purchase_order_items poi
          ON poi.id = (j.item->>'id')::UUID
         AND poi.po_id = p_po_id
         AND poi.org_id = p_org_id
        WHERE j.item ? 'product_id'
          AND NULLIF(j.item->>'product_id', '') IS NOT NULL
          AND (j.item->>'product_id')::UUID <> poi.product_id
    ) THEN
        RAISE EXCEPTION
            'PO item product does not match supplied product_id';
    END IF;

    -- 5) Preserve the Inventory lock hierarchy: Products first.
    -- Lock authoritative products in deterministic UUID order.
    PERFORM p.id
    FROM public.products p
    JOIN (
        SELECT DISTINCT poi.product_id
        FROM public.purchase_order_items poi
        JOIN (
            SELECT DISTINCT (j.item->>'id')::UUID AS po_item_id
            FROM jsonb_array_elements(p_items) AS j(item)
        ) requested
          ON requested.po_item_id = poi.id
        WHERE poi.po_id = p_po_id
          AND poi.org_id = p_org_id
    ) requested_products
      ON requested_products.product_id = p.id
    WHERE p.org_id = p_org_id
    ORDER BY p.id
    FOR UPDATE OF p;

    -- Then lock the requested PO items deterministically.
    PERFORM poi.id
    FROM public.purchase_order_items poi
    JOIN (
        SELECT DISTINCT (j.item->>'id')::UUID AS po_item_id
        FROM jsonb_array_elements(p_items) AS j(item)
    ) requested
      ON requested.po_item_id = poi.id
    WHERE poi.po_id = p_po_id
      AND poi.org_id = p_org_id
    ORDER BY poi.id
    FOR UPDATE OF poi;

    -- 6) Batch-safe idempotency.
    --
    -- External key:
    --   <batch-key>
    --
    -- Transaction keys:
    --   <batch-key>:po-item:<po-item-uuid>
    --
    -- The prefix scan lets us distinguish:
    --   * no prior rows       -> execute
    --   * all exact rows      -> idempotent replay, return
    --   * partial/mismatched  -> fail closed
    v_tx_key_prefix :=
        p_idempotency_key || ':po-item:';

    SELECT count(*)
    INTO v_existing_batch_tx_count
    FROM public.inventory_transactions tx
    WHERE tx.org_id = p_org_id
      AND tx.idempotency_key IS NOT NULL
      AND left(
            tx.idempotency_key,
            length(v_tx_key_prefix)
          ) = v_tx_key_prefix;

    SELECT count(*)
    INTO v_exact_batch_tx_count
    FROM jsonb_array_elements(p_items) AS j(item)
    JOIN public.purchase_order_items poi
      ON poi.id = (j.item->>'id')::UUID
     AND poi.po_id = p_po_id
     AND poi.org_id = p_org_id
    JOIN public.inventory_transactions tx
      ON tx.org_id = p_org_id
     AND tx.idempotency_key =
            v_tx_key_prefix || poi.id::TEXT
     AND tx.transaction_type = 'receive'
     AND tx.product_id = poi.product_id
     AND tx.location_id = p_location_id
     AND tx.quantity =
            (j.item->>'quantityToReceive')::INTEGER
     AND tx.reference_no IS NOT DISTINCT FROM v_po.po_number
     AND tx.unit_cost IS NOT DISTINCT FROM
            ROUND(poi.unit_price::NUMERIC, 4)
     AND tx.total_cost IS NOT DISTINCT FROM
            ROUND(
                (j.item->>'quantityToReceive')::INTEGER
                * ROUND(poi.unit_price::NUMERIC, 4),
                4
            );

    IF v_existing_batch_tx_count > 0 THEN
        IF v_existing_batch_tx_count = v_request_count
           AND v_exact_batch_tx_count = v_request_count THEN
            RETURN;
        END IF;

        RAISE EXCEPTION
            'Idempotency conflict: PO receipt key % is partial or belongs to a different request',
            p_idempotency_key;
    END IF;

    -- 7) Execute each positive receipt line atomically.
    FOR v_item IN
        SELECT j.item
        FROM jsonb_array_elements(p_items) AS j(item)
        ORDER BY (j.item->>'id')::UUID
    LOOP
        v_po_item_id :=
            (v_item->>'id')::UUID;

        v_qty_to_receive :=
            (v_item->>'quantityToReceive')::INTEGER;

        IF v_item ? 'product_id'
           AND NULLIF(v_item->>'product_id', '') IS NOT NULL THEN
            v_supplied_product_id :=
                (v_item->>'product_id')::UUID;
        ELSE
            v_supplied_product_id := NULL;
        END IF;

        SELECT *
        INTO v_po_item
        FROM public.purchase_order_items
        WHERE id = v_po_item_id
          AND po_id = p_po_id
          AND org_id = p_org_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'PO Item % not found',
                v_po_item_id;
        END IF;

        IF v_supplied_product_id IS NOT NULL
           AND v_supplied_product_id <> v_po_item.product_id THEN
            RAISE EXCEPTION
                'PO item product does not match supplied product_id';
        END IF;

        v_remaining :=
            v_po_item.quantity
            - COALESCE(v_po_item.received_quantity, 0);

        IF v_qty_to_receive > v_remaining THEN
            RAISE EXCEPTION
                'Cannot receive % for item %. Remaining is %',
                v_qty_to_receive,
                v_po_item_id,
                v_remaining;
        END IF;

        -- Product was pre-locked above. Re-read its current valuation because
        -- another line in this same batch may already have updated it.
        SELECT *
        INTO v_product
        FROM public.products
        WHERE id = v_po_item.product_id
          AND org_id = p_org_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Product not found or access denied';
        END IF;

        IF v_product.stock_quantity > 0
           AND COALESCE(v_product.average_cost, 0) = 0
           AND COALESCE(v_product.total_inventory_value, 0) = 0 THEN
            RAISE EXCEPTION
                'OPENING_INVENTORY_REQUIRED: Cannot receive valuation for legacy product % without opening inventory balance',
                v_product.name;
        END IF;

        v_unit_cost :=
            ROUND(v_po_item.unit_price::NUMERIC, 4);

        v_total_cost :=
            ROUND(v_qty_to_receive * v_unit_cost, 4);

        v_new_total_qty :=
            v_product.stock_quantity
            + v_qty_to_receive;

        v_new_total_value :=
            COALESCE(v_product.total_inventory_value, 0)
            + v_total_cost;

        IF v_new_total_qty > 0 THEN
            v_new_avg_cost :=
                ROUND(
                    v_new_total_value / v_new_total_qty,
                    4
                );
        ELSE
            v_new_avg_cost := v_unit_cost;
        END IF;

        UPDATE public.purchase_order_items
        SET received_quantity =
                COALESCE(received_quantity, 0)
                + v_qty_to_receive
        WHERE id = v_po_item_id
          AND po_id = p_po_id
          AND org_id = p_org_id;

        INSERT INTO public.inventory_balances (
            org_id,
            product_id,
            location_id,
            on_hand_quantity,
            allocated_quantity
        )
        VALUES (
            p_org_id,
            v_po_item.product_id,
            p_location_id,
            v_qty_to_receive,
            0
        )
        ON CONFLICT (product_id, location_id)
        DO UPDATE SET
            on_hand_quantity =
                public.inventory_balances.on_hand_quantity
                + EXCLUDED.on_hand_quantity,
            updated_at = NOW();

        PERFORM set_config(
            'app.bypass_cost_readonly',
            'true',
            true
        );

        UPDATE public.products
        SET stock_quantity = v_new_total_qty,
            total_inventory_value = v_new_total_value,
            average_cost = v_new_avg_cost,
            updated_at = NOW()
        WHERE id = v_po_item.product_id
          AND org_id = p_org_id;

        PERFORM set_config(
            'app.bypass_cost_readonly',
            'false',
            true
        );

        v_tx_key :=
            v_tx_key_prefix
            || v_po_item_id::TEXT;

        INSERT INTO public.inventory_transactions (
            org_id,
            product_id,
            location_id,
            transaction_type,
            quantity,
            reference_no,
            created_by,
            idempotency_key,
            unit_cost,
            total_cost
        )
        VALUES (
            p_org_id,
            v_po_item.product_id,
            p_location_id,
            'receive',
            v_qty_to_receive,
            v_po.po_number,
            p_user_id,
            v_tx_key,
            v_unit_cost,
            v_total_cost
        );
    END LOOP;

    -- 8) Recalculate PO status only after at least one strictly-positive,
    -- successfully committed receipt line.
    FOR v_po_item IN
        SELECT quantity, received_quantity
        FROM public.purchase_order_items
        WHERE po_id = p_po_id
          AND org_id = p_org_id
    LOOP
        IF COALESCE(v_po_item.received_quantity, 0)
           < v_po_item.quantity THEN
            v_all_fully_received := FALSE;
            EXIT;
        END IF;
    END LOOP;

    IF v_all_fully_received THEN
        UPDATE public.purchase_orders
        SET status = 'received'
        WHERE id = p_po_id
          AND org_id = p_org_id;
    ELSE
        UPDATE public.purchase_orders
        SET status = 'partially_received'
        WHERE id = p_po_id
          AND org_id = p_org_id;
    END IF;
END;
$function$;

-- Supabase/PostgreSQL production defaults can grant function EXECUTE directly
-- to anon as well as PUBLIC. Remove both explicitly.
REVOKE ALL
ON FUNCTION public.rpc_receive_po_items(
    UUID,
    UUID,
    UUID,
    UUID,
    JSONB,
    TEXT
)
FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.rpc_receive_po_items(
    UUID,
    UUID,
    UUID,
    UUID,
    JSONB,
    TEXT
)
TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_receive_po_items(
    UUID,
    UUID,
    UUID,
    UUID,
    JSONB,
    TEXT
)
IS 'MOD-001 I-6 current-schema PO receipt RPC with batch-safe idempotency, authoritative PO-item product identity, organization-safe location validation, moving-average valuation, and hardened execution ACL.';
