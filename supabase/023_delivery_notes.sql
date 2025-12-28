-- Migration: 023_delivery_notes.sql
-- Description: Delivery Notes for shipment tracking
-- Dependencies: 022_sales_orders.sql, 011_inventory_finished_goods.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== DELIVERY NOTES ====================

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  do_number VARCHAR(50) UNIQUE NOT NULL,
  do_date DATE NOT NULL,
  
  so_id UUID REFERENCES sales_orders(id),  -- Optional: can create without SO
  customer_id UUID REFERENCES customers(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Delivery details
  delivery_address TEXT,
  delivered_by VARCHAR(100),  -- Driver/courier name
  vehicle_number VARCHAR(50),
  
  -- Receipt confirmation
  received_by VARCHAR(100),  -- Customer contact who received
  received_at TIMESTAMPTZ,
  
  -- Status: draft → sent → received
  status VARCHAR(20) DEFAULT 'draft',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_do_status CHECK (status IN ('draft', 'sent', 'received', 'cancelled'))
);

CREATE INDEX idx_do_company ON delivery_notes(company_id);
CREATE INDEX idx_do_so ON delivery_notes(so_id);
CREATE INDEX idx_do_customer ON delivery_notes(customer_id);
CREATE INDEX idx_do_warehouse ON delivery_notes(warehouse_id);
CREATE INDEX idx_do_date ON delivery_notes(do_date DESC);
CREATE INDEX idx_do_status ON delivery_notes(status);

COMMENT ON TABLE delivery_notes IS 'Delivery notes for shipment tracking';

-- ==================== DELIVERY NOTE LINES ====================

CREATE TABLE IF NOT EXISTS delivery_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  do_id UUID REFERENCES delivery_notes(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  so_line_id UUID REFERENCES sales_order_lines(id),  -- Link to SO line
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty_delivered DECIMAL(15,4) NOT NULL CHECK (qty_delivered > 0),
  
  notes TEXT,
  
  UNIQUE(do_id, line_number)
);

CREATE INDEX idx_do_lines_do ON delivery_note_lines(do_id);
CREATE INDEX idx_do_lines_so_line ON delivery_note_lines(so_line_id);
CREATE INDEX idx_do_lines_variant ON delivery_note_lines(product_variant_id);

COMMENT ON TABLE delivery_note_lines IS 'Delivery note line items';

-- ==================== CONFIRM DELIVERY (Issue Inventory + COGS) ====================

-- Confirm delivery and issue inventory
CREATE OR REPLACE FUNCTION confirm_delivery(
  p_do_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_do RECORD;
  v_line RECORD;
  v_bin_id UUID;
  v_unit_cost DECIMAL(15,2);
  v_total_cogs DECIMAL(15,2) := 0;
BEGIN
  -- Get DO header
  SELECT * INTO v_do
  FROM delivery_notes
  WHERE id = p_do_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;
  
  IF v_do.status != 'draft' THEN
    RAISE EXCEPTION 'Delivery note must be in draft status';
  END IF;
  
  -- Get default bin
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_do.warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;
  
  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse';
  END IF;
  
  -- Process each delivery line
  FOR v_line IN 
    SELECT * FROM delivery_note_lines WHERE do_id = p_do_id
  LOOP
    -- Get current unit cost from inventory
    SELECT COALESCE(avg_unit_cost, 0) INTO v_unit_cost
    FROM finished_goods_balance_mv
    WHERE product_variant_id = v_line.product_variant_id
      AND warehouse_id = v_do.warehouse_id
      AND bin_id = v_bin_id
      AND company_id = v_do.company_id;
    
    IF v_unit_cost = 0 THEN
      RAISE EXCEPTION 'No inventory found for product variant: %', v_line.product_variant_id;
    END IF;
    
    -- Check stock availability
    DECLARE
      v_available_qty DECIMAL(15,4);
    BEGIN
      SELECT COALESCE(balance_qty, 0) INTO v_available_qty
      FROM finished_goods_balance_mv
      WHERE product_variant_id = v_line.product_variant_id
        AND warehouse_id = v_do.warehouse_id
        AND bin_id = v_bin_id
        AND company_id = v_do.company_id;
      
      IF v_available_qty < v_line.qty_delivered THEN
        RAISE EXCEPTION 'Insufficient stock for product. Available: %, Requested: %',
          v_available_qty, v_line.qty_delivered;
      END IF;
    END;
    
    -- Issue from finished goods inventory
    INSERT INTO finished_goods_ledger (
      company_id,
      product_variant_id,
      warehouse_id,
      bin_id,
      period_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_number,
      qty_in,
      qty_out,
      unit_cost,
      created_by,
      is_posted
    )
    VALUES (
      v_do.company_id,
      v_line.product_variant_id,
      v_do.warehouse_id,
      v_bin_id,
      v_do.period_id,
      v_do.do_date,
      'ISSUE',
      'DELIVERY_NOTE',
      v_do.id,
      v_do.do_number,
      0,
      v_line.qty_delivered,
      v_unit_cost,
      p_user_id,
      true
    );
    
    -- Accumulate COGS
    v_total_cogs := v_total_cogs + (v_line.qty_delivered * v_unit_cost);
    
    -- Update SO line qty_delivered if linked
    IF v_line.so_line_id IS NOT NULL THEN
      UPDATE sales_order_lines
      SET qty_delivered = qty_delivered + v_line.qty_delivered
      WHERE id = v_line.so_line_id;
    END IF;
  END LOOP;
  
  -- Update DO status
  UPDATE delivery_notes
  SET 
    status = 'sent',
    confirmed_at = NOW(),
    confirmed_by = p_user_id
  WHERE id = p_do_id;
  
  -- Update SO status if all delivered
  IF v_do.so_id IS NOT NULL THEN
    DECLARE
      v_all_delivered BOOLEAN;
    BEGIN
      SELECT bool_and(qty_delivered >= qty_ordered)
      INTO v_all_delivered
      FROM sales_order_lines
      WHERE so_id = v_do.so_id;
      
      IF v_all_delivered THEN
        UPDATE sales_orders
        SET status = 'completed'
        WHERE id = v_do.so_id;
      ELSIF EXISTS (SELECT 1 FROM sales_order_lines WHERE so_id = v_do.so_id AND qty_delivered > 0) THEN
        UPDATE sales_orders
        SET status = 'in_delivery'
        WHERE id = v_do.so_id;
      END IF;
    END;
  END IF;
  
  -- TODO: Create journal entry for COGS
  -- Dr. Cost of Goods Sold      v_total_cogs
  --   Cr. Finished Goods Inv     v_total_cogs
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION confirm_delivery IS 'Confirm delivery: issue inventory, post COGS, update SO';

-- ==================== VIEWS ====================

-- Delivery Note Summary
CREATE VIEW delivery_note_summary_vw AS
SELECT 
  dn.id,
  dn.company_id,
  dn.do_number,
  dn.do_date,
  dn.so_id,
  so.so_number,
  dn.customer_id,
  c.name as customer_name,
  dn.warehouse_id,
  w.name as warehouse_name,
  dn.status,
  dn.delivered_by,
  dn.received_by,
  dn.received_at,
  COUNT(dnl.id) as line_count,
  SUM(dnl.qty_delivered) as total_qty_delivered
FROM delivery_notes dn
JOIN customers c ON c.id = dn.customer_id
JOIN warehouses w ON w.id = dn.warehouse_id
LEFT JOIN sales_orders so ON so.id = dn.so_id
LEFT JOIN delivery_note_lines dnl ON dnl.do_id = dn.id
GROUP BY dn.id, dn.company_id, dn.do_number, dn.do_date,
         dn.so_id, so.so_number, dn.customer_id, c.name,
         dn.warehouse_id, w.name, dn.status, dn.delivered_by,
         dn.received_by, dn.received_at;

COMMENT ON VIEW delivery_note_summary_vw IS 'Delivery note summary with totals';

-- Pending Deliveries (from approved SOs)
CREATE VIEW pending_deliveries_vw AS
SELECT 
  so.id as so_id,
  so.so_number,
  so.so_date,
  so.customer_id,
  c.name as customer_name,
  sol.id as so_line_id,
  sol.product_variant_id,
  pv.sku,
  p.name as product_name,
  sol.qty_ordered,
  sol.qty_delivered,
  sol.qty_ordered - sol.qty_delivered as qty_pending,
  so.delivery_date,
  so.delivery_address
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
JOIN sales_order_lines sol ON sol.so_id = so.id
JOIN product_variants pv ON pv.id = sol.product_variant_id
JOIN products p ON p.id = pv.product_id
WHERE so.status IN ('approved', 'sent', 'in_delivery')
  AND sol.qty_ordered > sol.qty_delivered
ORDER BY so.delivery_date, so.so_number;

COMMENT ON VIEW pending_deliveries_vw IS 'Pending deliveries from sales orders';

-- ==================== RLS POLICIES ====================

ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY do_tenant_isolation ON delivery_notes
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY do_lines_tenant ON delivery_note_lines
  FOR ALL USING (do_id IN (
    SELECT id FROM delivery_notes WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY do_service_role ON delivery_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY do_lines_service_role ON delivery_note_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_do
  AFTER INSERT OR UPDATE OR DELETE ON delivery_notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
