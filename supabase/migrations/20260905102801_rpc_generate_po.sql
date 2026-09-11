CREATE OR REPLACE FUNCTION generate_po_from_pr(
  p_pr_id UUID,
  p_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_pr RECORD;
  v_quote RECORD;
  v_po_id UUID;
  v_po_number TEXT;
  v_item RECORD;
  v_total_qty INT;
  v_unit_price NUMERIC;
BEGIN
  -- 1. Get PR and lock it for update
  SELECT * INTO v_pr
  FROM purchase_requests
  WHERE id = p_pr_id
  FOR UPDATE;
  
  IF v_pr IS NULL THEN
    RAISE EXCEPTION 'PR not found';
  END IF;
  
  IF v_pr.status != 'approved'::pr_status THEN
    RAISE EXCEPTION 'Only approved PRs can be generated into POs';
  END IF;
  
  IF v_pr.po_id IS NOT NULL THEN
    RAISE EXCEPTION 'PR นี้ถูกสร้างเป็น PO แล้ว (PO Reference)';
  END IF;
  
  -- 2. Get Quotation
  SELECT * INTO v_quote
  FROM pr_quotations
  WHERE id = v_pr.selected_quotation_id;
  
  IF v_quote IS NULL THEN
    RAISE EXCEPTION 'PR has no selected quotation to generate PO from';
  END IF;
  
  -- 3. Check PR Items
  SELECT COALESCE(sum(quantity), 0) INTO v_total_qty
  FROM purchase_request_items
  WHERE pr_id = p_pr_id;
  
  IF v_total_qty = 0 THEN
    RAISE EXCEPTION 'PR has no items to generate PO';
  END IF;
  
  -- 4. Create PO Header
  v_po_number := 'PO-' || v_pr.pr_number || '-' || right(extract(epoch from now())::text, 4);
  
  INSERT INTO purchase_orders (
    org_id,
    supplier_id,
    po_number,
    status,
    total_amount,
    expected_date,
    notes,
    requested_by,
    pr_id
  ) VALUES (
    v_pr.org_id,
    v_quote.supplier_id,
    v_po_number,
    'draft'::po_status,
    v_quote.price,
    v_pr.required_date,
    'Generated from PR: ' || v_pr.pr_number || COALESCE('. Quotation: ' || v_quote.quotation_number, ''),
    p_user_id,
    p_pr_id
  ) RETURNING id INTO v_po_id;
  
  -- 5. Create PO Items
  FOR v_item IN (SELECT * FROM purchase_request_items WHERE pr_id = p_pr_id) LOOP
    v_unit_price := v_quote.price / v_total_qty; -- simple average based on total items qty
    
    INSERT INTO purchase_order_items (
      org_id,
      po_id,
      product_id,
      quantity,
      unit_price,
      project_id
    ) VALUES (
      v_pr.org_id,
      v_po_id,
      v_item.product_id,
      v_item.quantity,
      v_unit_price,
      v_pr.project_id
    );
  END LOOP;
  
  -- 6. Update PR status
  UPDATE purchase_requests
  SET status = 'po_created'::pr_status,
      po_id = v_po_id,
      po_created_at = now(),
      po_created_by = p_user_id
  WHERE id = p_pr_id;
  
  RETURN v_po_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
