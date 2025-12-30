-- Migration: 062_sales_automation.sql
-- Description: Sales Automation: Last Sold Price, Quick Fulfillment RPC
-- Author: Ziyada ERP Team
-- Date: 2025-12-30

-- ==================== PRICE INTELLIGENCE ====================

CREATE OR REPLACE FUNCTION get_last_sold_price(
  p_customer_id UUID,
  p_variant_id UUID
)
RETURNS TABLE (
  unit_price DECIMAL(15,2),
  so_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sol.unit_price,
    so.so_date
  FROM sales_order_lines sol
  JOIN sales_orders so ON so.id = sol.so_id
  WHERE so.customer_id = p_customer_id
    AND sol.product_variant_id = p_variant_id
    AND so.status IN ('approved', 'in_delivery', 'completed')
  ORDER BY so.so_date DESC, so.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_last_sold_price IS 'Fetches last price sold to this customer for specific item';

-- ==================== QUICK FULFILLMENT ====================
-- Creates and Confirms Delivery Note + Creates and Posts Invoice for ALL pending items

CREATE OR REPLACE FUNCTION quick_fulfill_so(
  p_so_id UUID,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_so RECORD;
  v_do_id UUID;
  v_invoice_id UUID;
  v_do_number VARCHAR;
  v_invoice_number VARCHAR;
  v_period_id UUID;
  v_line RECORD;
  v_pending_qty DECIMAL;
BEGIN
  -- 1. Get SO
  SELECT * INTO v_so FROM sales_orders WHERE id = p_so_id;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'Sales Order not found'; END IF;
  IF v_so.status NOT IN ('approved', 'in_delivery') THEN
    RAISE EXCEPTION 'Sales Order must be Approved or Partially Delivered';
  END IF;

  -- 2. Get Open Period
  SELECT id INTO v_period_id FROM accounting_periods 
  WHERE company_id = v_so.company_id AND status = 'open' 
  AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
  LIMIT 1;

  IF v_period_id IS NULL THEN RAISE EXCEPTION 'No open accounting period for today'; END IF;

  -- 3. Create Delivery Note (Draft)
  v_do_number := 'DO-' || to_char(now(), 'YYYYMMDD-HH24MISS'); -- Simple gen
  
  INSERT INTO delivery_notes (
    company_id, do_number, do_date, so_id, customer_id, 
    warehouse_id, period_id, status, created_by
  ) VALUES (
    v_so.company_id, v_do_number, CURRENT_DATE, p_so_id, v_so.customer_id,
    v_so.warehouse_id, v_period_id, 'draft', p_user_id
  ) RETURNING id INTO v_do_id;

  -- 4. Create DO Lines (for all pending qty)
  FOR v_line IN SELECT * FROM sales_order_lines WHERE so_id = p_so_id LOOP
    v_pending_qty := v_line.qty_ordered - v_line.qty_delivered;
    
    IF v_pending_qty > 0 THEN
      INSERT INTO delivery_note_lines (
        do_id, line_number, so_line_id, product_variant_id, qty_delivered
      ) VALUES (
        v_do_id, v_line.line_number, v_line.id, v_line.product_variant_id, v_pending_qty
      );
    END IF;
  END LOOP;

  -- If no lines created (everything already delivered), abort
  IF NOT EXISTS (SELECT 1 FROM delivery_note_lines WHERE do_id = v_do_id) THEN
    RAISE EXCEPTION 'Nothing pending to deliver for this SO';
  END IF;

  -- 5. Confirm Delivery (Issues Inventory)
  PERFORM confirm_delivery(v_do_id, p_user_id);

  -- 6. Create Sales Invoice
  v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD-HH24MISS');

  INSERT INTO sales_invoices (
    company_id, invoice_number, invoice_date, due_date,
    so_id, do_id, customer_id, period_id, status, created_by,
    payment_terms
  ) VALUES (
    v_so.company_id, v_invoice_number, CURRENT_DATE, CURRENT_DATE + 30, -- Default net 30, simplified
    p_so_id, v_do_id, v_so.customer_id, v_period_id, 'draft', p_user_id,
    'Net 30' -- Should fetch from customer default
  ) RETURNING id INTO v_invoice_id;

  -- 7. Create Invoice Lines
  INSERT INTO sales_invoice_lines (
    invoice_id, line_number, so_line_id, do_line_id, product_variant_id,
    qty_invoiced, unit_price, discount_percentage
  )
  SELECT 
    v_invoice_id, dnl.line_number, dnl.so_line_id, dnl.id, dnl.product_variant_id,
    dnl.qty_delivered, sol.unit_price, sol.discount_percentage
  FROM delivery_note_lines dnl
  JOIN sales_order_lines sol ON sol.id = dnl.so_line_id
  WHERE dnl.do_id = v_do_id;

  -- 8. Post Invoice
  PERFORM post_sales_invoice(v_invoice_id, p_user_id);

  RETURN jsonb_build_object(
    'do_id', v_do_id,
    'do_number', v_do_number,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION quick_fulfill_so TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_sold_price TO authenticated;
