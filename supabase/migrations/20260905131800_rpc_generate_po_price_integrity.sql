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
  v_unit_price NUMERIC(15,2);
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
  
  -- 2. Get Quotation (PRICE INTEGRITY CHECK: Use ONLY selected quotation)
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
  
  -- 4. Create PO Header (Ensuring Supplier, Price matches exactly)
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
    v_quote.price, -- Total Price from selected quotation
    v_pr.required_date,
    'Generated from PR: ' || v_pr.pr_number || COALESCE('. Quotation: ' || v_quote.quotation_number, ''),
    p_user_id,
    p_pr_id
  ) RETURNING id INTO v_po_id;
  
  -- 5. Create PO Items (PRICE INTEGRITY CHECK: Calculate exact Unit Price)
  FOR v_item IN (SELECT * FROM purchase_request_items WHERE pr_id = p_pr_id) LOOP
    
    -- ถ้า Quotation มี quantity ระบุมาให้ใช้เป็นฐานคิดราคาต่อหน่วย, ถ้าไม่มีให้รวมจำนวนจาก PR items
    IF v_quote.quantity IS NOT NULL AND v_quote.quantity > 0 THEN
      v_unit_price := ROUND((v_quote.price / v_quote.quantity)::numeric, 2);
    ELSE
      v_unit_price := ROUND((v_quote.price / v_total_qty)::numeric, 2);
    END IF;
    
    INSERT INTO purchase_order_items (
      org_id,
      po_id,
      product_id,
      quantity,     -- Use exactly the approved quantity from PR
      unit_price,   -- Use exactly the unit price derived from Selected Quotation
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
