BEGIN;

-- MOD-008
-- Direct Stock Actor Authorization Hardening
-- + MOD-007 PO Receive INVOKER Membership Repair.
--
-- Generated from authoritative live pg_get_functiondef() output.
-- Private schema privileges are unchanged.
-- Human membership checks use public.memberships under its existing
-- authenticated self-membership RLS policy.

-- ================================================================
-- rpc_receive_po_items
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_receive_po_items(p_po_id uuid, p_location_id uuid, p_org_id uuid, p_user_id uuid, p_items jsonb, p_idempotency_key text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
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

  -- MOD-007 BEGIN RECEIVE AUTHORIZATION GUARD
  --
  -- Human application calls remain SECURITY INVOKER and must bind the
  -- recorded receive actor to the authenticated Supabase identity.
  --
  -- service_role remains an explicit trusted-backend compatibility path.
  IF current_user = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION
        'PO_RECEIVE_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION
        'PO_RECEIVE_ACTOR_MISMATCH'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.memberships m
        WHERE m.org_id = p_org_id
          AND m.user_id = auth.uid()
      ) THEN
      RAISE EXCEPTION
        'PO_RECEIVE_ORG_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;

  ELSIF current_user = 'service_role' THEN
    -- Trusted backend compatibility path.
    -- Existing p_user_id validation and all receive business logic below
    -- remain unchanged.

    NULL;

  ELSE
    RAISE EXCEPTION
      'PO_RECEIVE_CALLER_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;
  -- MOD-007 END RECEIVE AUTHORIZATION GUARD


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

ALTER FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_receive_po_items(
  uuid,
  uuid,
  uuid,
  uuid,
  jsonb,
  text
)
TO authenticated, service_role;

-- ================================================================
-- rpc_adjust_stock
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_adjust_stock(p_org_id uuid, p_product_id uuid, p_location_id uuid, p_quantity integer, p_unit_cost numeric DEFAULT NULL::numeric, p_reference_no text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
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
    -- MOD-008 BEGIN DIRECT STOCK AUTHORIZATION GUARD
    IF current_user = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_AUTH_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_MISMATCH'
                USING ERRCODE = '42501';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.org_id = p_org_id
              AND m.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ORG_FORBIDDEN'
                USING ERRCODE = '42501';
        END IF;

    ELSIF current_user = 'service_role' THEN
        NULL;

    ELSE
        RAISE EXCEPTION 'DIRECT_STOCK_CALLER_FORBIDDEN'
            USING ERRCODE = '42501';
    END IF;
    -- MOD-008 END DIRECT STOCK AUTHORIZATION GUARD
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
            -- Consume the exact remaining company-wide book value on final
            -- depletion so transaction valuation reconciles without a
            -- rounding residue (same convention as rpc_issue_stock).
            v_tx_total_cost :=
                COALESCE(v_product.total_inventory_value, 0);
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

ALTER FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_adjust_stock(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
TO authenticated, service_role;

-- ================================================================
-- rpc_issue_stock
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_issue_stock(p_org_id uuid, p_mode text, p_quantity integer, p_idempotency_key text, p_user_id uuid, p_product_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_reference_no text DEFAULT NULL::text, p_sales_order_item_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- MOD-008 BEGIN DIRECT STOCK AUTHORIZATION GUARD
    IF current_user = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_AUTH_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_MISMATCH'
                USING ERRCODE = '42501';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.org_id = p_org_id
              AND m.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ORG_FORBIDDEN'
                USING ERRCODE = '42501';
        END IF;

    ELSIF current_user = 'service_role' THEN
        NULL;

    ELSE
        RAISE EXCEPTION 'DIRECT_STOCK_CALLER_FORBIDDEN'
            USING ERRCODE = '42501';
    END IF;
    -- MOD-008 END DIRECT STOCK AUTHORIZATION GUARD
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
$function$;

ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_issue_stock(
  uuid,
  text,
  integer,
  text,
  uuid,
  uuid,
  uuid,
  text,
  uuid
)
TO authenticated, service_role;

-- ================================================================
-- rpc_receive_stock_direct
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_receive_stock_direct(p_org_id uuid, p_location_id uuid, p_product_id uuid, p_quantity integer, p_unit_cost numeric, p_reference_no text, p_batch_qr_code text, p_idempotency_key text, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_product RECORD;
    v_new_total_qty INTEGER;
    v_new_total_value NUMERIC(19,4);
    v_new_avg_cost NUMERIC(19,4);
    v_tx_total_cost NUMERIC(19,4);
BEGIN
    -- MOD-008 BEGIN DIRECT STOCK AUTHORIZATION GUARD
    IF current_user = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_AUTH_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_MISMATCH'
                USING ERRCODE = '42501';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.org_id = p_org_id
              AND m.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ORG_FORBIDDEN'
                USING ERRCODE = '42501';
        END IF;

    ELSIF current_user = 'service_role' THEN
        NULL;

    ELSE
        RAISE EXCEPTION 'DIRECT_STOCK_CALLER_FORBIDDEN'
            USING ERRCODE = '42501';
    END IF;
    -- MOD-008 END DIRECT STOCK AUTHORIZATION GUARD
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
$function$;

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_receive_stock_direct(
  uuid,
  uuid,
  uuid,
  integer,
  numeric,
  text,
  text,
  text,
  uuid
)
TO authenticated, service_role;

-- ================================================================
-- rpc_transfer_stock
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_transfer_stock(p_org_id uuid, p_product_id uuid, p_from_location_id uuid, p_to_location_id uuid, p_quantity integer, p_reference_no text, p_idempotency_key text, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_product RECORD;
    v_source_balance RECORD;
    v_available_qty INTEGER;
    v_total_on_hand INTEGER;
    v_unit_cost NUMERIC;
    v_first_loc UUID;
    v_second_loc UUID;
BEGIN
    -- MOD-008 BEGIN DIRECT STOCK AUTHORIZATION GUARD
    IF current_user = 'authenticated' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_AUTH_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS NULL THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_REQUIRED'
                USING ERRCODE = '42501';
        END IF;

        IF p_user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ACTOR_MISMATCH'
                USING ERRCODE = '42501';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.memberships m
            WHERE m.org_id = p_org_id
              AND m.user_id = auth.uid()
        ) THEN
            RAISE EXCEPTION 'DIRECT_STOCK_ORG_FORBIDDEN'
                USING ERRCODE = '42501';
        END IF;

    ELSIF current_user = 'service_role' THEN
        NULL;

    ELSE
        RAISE EXCEPTION 'DIRECT_STOCK_CALLER_FORBIDDEN'
            USING ERRCODE = '42501';
    END IF;
    -- MOD-008 END DIRECT STOCK AUTHORIZATION GUARD
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
$function$;

ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  SECURITY INVOKER;

ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  OWNER TO postgres;

ALTER FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
  SET search_path = public, pg_temp;

REVOKE ALL
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
FROM anon;

GRANT EXECUTE
ON FUNCTION public.rpc_transfer_stock(
  uuid,
  uuid,
  uuid,
  uuid,
  integer,
  text,
  text,
  uuid
)
TO authenticated, service_role;

COMMIT;
