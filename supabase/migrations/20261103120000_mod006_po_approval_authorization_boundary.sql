-- MOD-006
-- PO approval authorization and approved-value integrity boundary.
--
-- Database authority:
--   * draft -> pending_approval:
--       - authenticated actor required
--       - authoritative total recomputed from PO items
--       - requested_by server-stamped
--   * pending_approval -> ordered:
--       - authenticated actor required
--       - self approval denied
--       - owner/admin OR user-specific approval limit required
--       - authoritative total recomputed
--       - approved_by / approved_at server-stamped
--       - approval audit written
--   * approval provenance cannot be forged outside those transitions
--   * commercial header/item data is frozen after draft
--
-- Receive compatibility:
--   * rpc_receive_po_items is intentionally NOT modified
--   * received_quantity is intentionally NOT frozen by MOD-006
--   * ordered/partially_received -> partially_received/received remains unchanged
--
-- Role-based approval_limits are intentionally out of scope because
-- the existing PR approval policy uses user-specific approval limits.

BEGIN;

CREATE OR REPLACE FUNCTION private.guard_purchase_order_approval_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid;
  v_total numeric;
  v_owner_admin boolean;
  v_has_limit boolean;
  v_actor_email text;
BEGIN
  -- PO identity and tenant ownership are never mutable.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION
      'PURCHASE_PO_IDENTITY_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;

  ------------------------------------------------------------------
  -- REQUEST APPROVAL: draft -> pending_approval
  ------------------------------------------------------------------
  IF OLD.status::text = 'draft'
     AND NEW.status::text = 'pending_approval' THEN

    v_actor := auth.uid();

    IF v_actor IS NULL THEN
      RAISE EXCEPTION
        'PURCHASE_APPROVAL_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    -- A caller may edit a draft before requesting approval, but must not
    -- smuggle commercial-header edits into the same status transition.
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.po_number IS DISTINCT FROM OLD.po_number
       OR NEW.expected_date IS DISTINCT FROM OLD.expected_date
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.pr_id IS DISTINCT FROM OLD.pr_id THEN
      RAISE EXCEPTION
        'PURCHASE_PO_REQUEST_TRANSITION_MUST_BE_STATUS_ONLY'
        USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
      SUM(
        poi.quantity::numeric
        * poi.unit_price::numeric
      ),
      0
    )
    INTO v_total
    FROM public.purchase_order_items poi
    WHERE poi.po_id = OLD.id
      AND poi.org_id = OLD.org_id;

    NEW.total_amount := v_total;
    NEW.requested_by := v_actor;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;

    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- APPROVE: pending_approval -> ordered
  ------------------------------------------------------------------
  IF OLD.status::text = 'pending_approval'
     AND NEW.status::text = 'ordered' THEN

    v_actor := auth.uid();

    IF v_actor IS NULL THEN
      RAISE EXCEPTION
        'PURCHASE_APPROVAL_AUTH_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.requested_by IS NULL THEN
      RAISE EXCEPTION
        'PURCHASE_APPROVAL_REQUESTER_REQUIRED'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.requested_by = v_actor THEN
      RAISE EXCEPTION
        'PURCHASE_SELF_APPROVAL_FORBIDDEN'
        USING ERRCODE = '42501';
    END IF;

    -- Approval is a status-only request from the application boundary.
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.po_number IS DISTINCT FROM OLD.po_number
       OR NEW.expected_date IS DISTINCT FROM OLD.expected_date
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.pr_id IS DISTINCT FROM OLD.pr_id THEN
      RAISE EXCEPTION
        'PURCHASE_PO_APPROVAL_TRANSITION_MUST_BE_STATUS_ONLY'
        USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(
      SUM(
        poi.quantity::numeric
        * poi.unit_price::numeric
      ),
      0
    )
    INTO v_total
    FROM public.purchase_order_items poi
    WHERE poi.po_id = OLD.id
      AND poi.org_id = OLD.org_id;

    SELECT EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = OLD.org_id
        AND m.user_id = v_actor
        AND m.role::text IN ('owner', 'admin')
    )
    INTO v_owner_admin;

    IF NOT COALESCE(v_owner_admin, false) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.approval_limits al
        WHERE al.org_id = OLD.org_id
          AND al.user_id = v_actor
          AND al.max_amount >= v_total
      )
      INTO v_has_limit;

      IF NOT COALESCE(v_has_limit, false) THEN
        RAISE EXCEPTION
          'PURCHASE_APPROVAL_LIMIT_EXCEEDED_OR_UNAUTHORIZED'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    NEW.total_amount := v_total;
    NEW.requested_by := OLD.requested_by;
    NEW.approved_by := v_actor;
    NEW.approved_at := statement_timestamp();

    v_actor_email := COALESCE(
      auth.jwt() ->> 'email',
      ''
    );

    INSERT INTO public.audit_log (
      org_id,
      actor_id,
      actor_email,
      entity,
      entity_id,
      action,
      summary,
      meta
    )
    VALUES (
      OLD.org_id,
      v_actor,
      v_actor_email,
      'purchase_orders',
      OLD.id,
      'APPROVE_PO',
      'Approved PO ' || OLD.po_number,
      jsonb_build_object(
        'po_id', OLD.id,
        'total_amount', v_total
      )
    );

    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- PRE-APPROVAL BYPASS PREVENTION
  --
  -- The valid pending_approval -> ordered transition returned above.
  ------------------------------------------------------------------
  IF OLD.status::text IN ('draft', 'pending_approval')
     AND NEW.status::text IN (
       'ordered',
       'partially_received',
       'received'
     ) THEN
    RAISE EXCEPTION
      'PURCHASE_PO_APPROVAL_TRANSITION_REQUIRED'
      USING ERRCODE = '42501';
  END IF;

  ------------------------------------------------------------------
  -- Once approved/receiving, do not reopen the PO as editable draft
  -- or pending approval.
  ------------------------------------------------------------------
  IF OLD.status::text IN (
       'ordered',
       'partially_received',
       'received'
     )
     AND NEW.status::text IN (
       'draft',
       'pending_approval'
     ) THEN
    RAISE EXCEPTION
      'PURCHASE_PO_APPROVAL_REVERSAL_FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  ------------------------------------------------------------------
  -- APPROVAL PROVENANCE IS SERVER AUTHORITATIVE.
  ------------------------------------------------------------------
  IF NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION
      'PURCHASE_REQUEST_PROVENANCE_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION
      'PURCHASE_APPROVAL_PROVENANCE_IMMUTABLE'
      USING ERRCODE = '42501';
  END IF;

  ------------------------------------------------------------------
  -- APPROVED COMMERCIAL VALUE IS FROZEN AFTER DRAFT.
  --
  -- Receive status transitions themselves are intentionally not
  -- authorized here; that is separate from MOD-006.
  ------------------------------------------------------------------
  IF OLD.status::text <> 'draft' THEN
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      RAISE EXCEPTION
        'PURCHASE_PO_TOTAL_LOCKED'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
       OR NEW.po_number IS DISTINCT FROM OLD.po_number
       OR NEW.expected_date IS DISTINCT FROM OLD.expected_date
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.pr_id IS DISTINCT FROM OLD.pr_id THEN
      RAISE EXCEPTION
        'PURCHASE_PO_COMMERCIAL_HEADER_LOCKED'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mod006_po_approval_boundary
ON public.purchase_orders;

CREATE TRIGGER trg_mod006_po_approval_boundary
BEFORE UPDATE
ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION private.guard_purchase_order_approval_boundary();

REVOKE ALL
ON FUNCTION private.guard_purchase_order_approval_boundary()
FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION private.guard_purchase_order_item_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_old_status public.po_status;
  v_new_status public.po_status;
BEGIN
  ------------------------------------------------------------------
  -- INSERT: commercial items may only be added while parent is draft.
  ------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    SELECT po.status
    INTO v_new_status
    FROM public.purchase_orders po
    WHERE po.id = NEW.po_id
      AND po.org_id = NEW.org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'PURCHASE_PO_NOT_FOUND_OR_SCOPE_MISMATCH'
        USING ERRCODE = '42501';
    END IF;

    IF v_new_status::text <> 'draft' THEN
      RAISE EXCEPTION
        'PURCHASE_PO_ITEMS_LOCKED_AFTER_DRAFT'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  ------------------------------------------------------------------
  -- DELETE: commercial items may only be removed while parent is draft.
  ------------------------------------------------------------------
  IF TG_OP = 'DELETE' THEN
    SELECT po.status
    INTO v_old_status
    FROM public.purchase_orders po
    WHERE po.id = OLD.po_id
      AND po.org_id = OLD.org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'PURCHASE_PO_NOT_FOUND_OR_SCOPE_MISMATCH'
        USING ERRCODE = '42501';
    END IF;

    IF v_old_status::text <> 'draft' THEN
      RAISE EXCEPTION
        'PURCHASE_PO_ITEMS_LOCKED_AFTER_DRAFT'
        USING ERRCODE = '42501';
    END IF;

    RETURN OLD;
  END IF;

  ------------------------------------------------------------------
  -- UPDATE: lock parent row to serialize commercial-item edits against
  -- draft -> pending_approval.
  ------------------------------------------------------------------
  SELECT po.status
  INTO v_old_status
  FROM public.purchase_orders po
  WHERE po.id = OLD.po_id
    AND po.org_id = OLD.org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PURCHASE_PO_NOT_FOUND_OR_SCOPE_MISMATCH'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.po_id IS DISTINCT FROM OLD.po_id
     OR NEW.org_id IS DISTINCT FROM OLD.org_id THEN

    SELECT po.status
    INTO v_new_status
    FROM public.purchase_orders po
    WHERE po.id = NEW.po_id
      AND po.org_id = NEW.org_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'PURCHASE_PO_TARGET_NOT_FOUND_OR_SCOPE_MISMATCH'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    v_new_status := v_old_status;
  END IF;

  ------------------------------------------------------------------
  -- Freeze only commercial identity/value fields after draft.
  --
  -- received_quantity is deliberately NOT part of this comparison.
  -- That preserves the existing MOD-001 receive implementation exactly.
  ------------------------------------------------------------------
  IF v_old_status::text <> 'draft'
     OR v_new_status::text <> 'draft' THEN

    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.po_id IS DISTINCT FROM OLD.po_id
       OR NEW.org_id IS DISTINCT FROM OLD.org_id
       OR NEW.product_id IS DISTINCT FROM OLD.product_id
       OR NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.quantity IS DISTINCT FROM OLD.quantity
       OR NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN

      RAISE EXCEPTION
        'PURCHASE_PO_ITEM_COMMERCIAL_FIELDS_LOCKED'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mod006_po_item_boundary
ON public.purchase_order_items;

CREATE TRIGGER trg_mod006_po_item_boundary
BEFORE INSERT OR UPDATE OR DELETE
ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION private.guard_purchase_order_item_boundary();

REVOKE ALL
ON FUNCTION private.guard_purchase_order_item_boundary()
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
