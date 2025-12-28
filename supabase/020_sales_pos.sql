-- Migration: 020_sales_pos.sql
-- Description: Point of Sale (counter/cash sales)
-- Dependencies: 011_inventory_finished_goods.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== SALES POS ====================

CREATE TABLE IF NOT EXISTS sales_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  pos_number VARCHAR(50) UNIQUE NOT NULL,
  sale_date DATE NOT NULL,
  customer_id UUID REFERENCES customers(id), -- Optional for walk-in
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal - discount_amount + tax_amount) STORED,
  
  payment_method payment_method NOT NULL,
  payment_reference VARCHAR(100),
  amount_tendered DECIMAL(15,2),
  change_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN amount_tendered IS NOT NULL 
    THEN amount_tendered - (subtotal - discount_amount + tax_amount)
    ELSE 0 END
  ) STORED,
  
  status VARCHAR(20) DEFAULT 'completed', -- POS is typically instant
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_pos_company ON sales_pos(company_id);
CREATE INDEX idx_pos_customer ON sales_pos(customer_id);
CREATE INDEX idx_pos_warehouse ON sales_pos(warehouse_id);
CREATE INDEX idx_pos_date ON sales_pos(sale_date DESC);
CREATE INDEX idx_pos_status ON sales_pos(status);

COMMENT ON TABLE sales_pos IS 'Point of Sale transactions (counter/cash sales)';

-- ==================== SALES POS LINES ====================

CREATE TABLE IF NOT EXISTS sales_pos_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id UUID REFERENCES sales_pos(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    qty * unit_price * (1 - discount_percentage / 100)
  ) STORED,
  
  notes TEXT,
  
  UNIQUE(pos_id, line_number)
);

CREATE INDEX idx_pos_lines_pos ON sales_pos_lines(pos_id);
CREATE INDEX idx_pos_lines_variant ON sales_pos_lines(product_variant_id);

COMMENT ON TABLE sales_pos_lines IS 'POS transaction line items';

-- ==================== TRIGGERS ====================

-- Auto-update POS subtotal
CREATE OR REPLACE FUNCTION update_pos_total()
RETURNS TRIGGER AS $$
DECLARE
  v_pos_id UUID;
BEGIN
  v_pos_id := COALESCE(NEW.pos_id, OLD.pos_id);
  
  UPDATE sales_pos
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM sales_pos_lines
    WHERE pos_id = v_pos_id
  )
  WHERE id = v_pos_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_total_insert
  AFTER INSERT ON sales_pos_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_total();

CREATE TRIGGER trigger_update_pos_total_update
  AFTER UPDATE ON sales_pos_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_pos_total();

CREATE TRIGGER trigger_update_pos_total_delete
  AFTER DELETE ON sales_pos_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_total();

-- ==================== POSTING FUNCTION ====================

-- Post POS sale (issue inventory, create journal entry)
CREATE OR REPLACE FUNCTION post_pos_sale(
  p_pos_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_pos RECORD;
  v_line RECORD;
  v_bin_id UUID;
BEGIN
  -- Get POS header
  SELECT * INTO v_pos
  FROM sales_pos
  WHERE id = p_pos_id;
  
  IF v_pos.status = 'posted' THEN
    RAISE EXCEPTION 'POS sale already posted';
  END IF;
  
  -- Get default bin
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_pos.warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;
  
  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse';
  END IF;
  
  -- Issue each line from finished goods
  FOR v_line IN 
    SELECT * FROM sales_pos_lines WHERE pos_id = p_pos_id
  LOOP
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
    SELECT 
      v_pos.company_id,
      v_line.product_variant_id,
      v_pos.warehouse_id,
      v_bin_id,
      v_pos.period_id,
      v_pos.sale_date,
      'ISSUE',
      'SALES_POS',
      v_pos.id,
      v_pos.pos_number,
      0,
      v_line.qty,
      fgb.avg_unit_cost,
      p_user_id,
      true
    FROM finished_goods_balance_mv fgb
    WHERE fgb.product_variant_id = v_line.product_variant_id
      AND fgb.warehouse_id = v_pos.warehouse_id
      AND fgb.bin_id = v_bin_id
      AND fgb.company_id = v_pos.company_id
    LIMIT 1;
  END LOOP;
  
  -- Update status
  UPDATE sales_pos
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_pos_id;
  
  -- TODO: Create journal entry (Dr. Cash, Cr. Sales Revenue, Dr. COGS, Cr. Inventory)
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_pos_sale IS 'Post POS sale: issue inventory and create journal entry';

-- ==================== RLS POLICIES ====================

ALTER TABLE sales_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pos_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_tenant_isolation ON sales_pos
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY pos_lines_tenant ON sales_pos_lines
  FOR ALL USING (pos_id IN (
    SELECT id FROM sales_pos WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY pos_service_role ON sales_pos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY pos_lines_service_role ON sales_pos_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_pos
  AFTER INSERT OR UPDATE OR DELETE ON sales_pos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Daily POS Sales Summary
CREATE VIEW daily_pos_sales_vw AS
SELECT 
  sp.company_id,
  sp.sale_date,
  sp.warehouse_id,
  w.name as warehouse_name,
  COUNT(sp.id) as transaction_count,
  SUM(sp.total_amount) as total_sales,
  SUM(sp.subtotal) as gross_sales,
  SUM(sp.discount_amount) as total_discounts,
  SUM(sp.tax_amount) as total_tax,
  COUNT(CASE WHEN sp.payment_method = 'CASH' THEN 1 END) as cash_transactions,
  COUNT(CASE WHEN sp.payment_method != 'CASH' THEN 1 END) as non_cash_transactions
FROM sales_pos sp
JOIN warehouses w ON w.id = sp.warehouse_id
WHERE sp.status = 'posted'
GROUP BY sp.company_id, sp.sale_date, sp.warehouse_id, w.name;

COMMENT ON VIEW daily_pos_sales_vw IS 'Daily POS sales summary by warehouse';
