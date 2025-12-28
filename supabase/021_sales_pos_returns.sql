-- Migration: 021_sales_pos_returns.sql
-- Description: POS Returns and Refunds
-- Dependencies: 020_sales_pos.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== SALES POS RETURNS ====================

CREATE TABLE IF NOT EXISTS sales_pos_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  return_number VARCHAR(50) UNIQUE NOT NULL,
  return_date DATE NOT NULL,
  
  original_pos_id UUID REFERENCES sales_pos(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  
  refund_method payment_method NOT NULL,
  refund_reference VARCHAR(100),
  refund_amount DECIMAL(15,2),
  
  return_reason VARCHAR(50), -- DEFECTIVE, WRONG_SIZE, WRONG_COLOR, CUSTOMER_REQUEST, etc.
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, completed, posted
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_pos_returns_company ON sales_pos_returns(company_id);
CREATE INDEX idx_pos_returns_original ON sales_pos_returns(original_pos_id);
CREATE INDEX idx_pos_returns_warehouse ON sales_pos_returns(warehouse_id);
CREATE INDEX idx_pos_returns_date ON sales_pos_returns(return_date DESC);
CREATE INDEX idx_pos_returns_status ON sales_pos_returns(status);

COMMENT ON TABLE sales_pos_returns IS 'POS Returns and Refunds';

-- ==================== SALES POS RETURN LINES ====================

CREATE TABLE IF NOT EXISTS sales_pos_return_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES sales_pos_returns(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  original_line_id UUID REFERENCES sales_pos_lines(id),
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty_returned DECIMAL(15,4) NOT NULL CHECK (qty_returned > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_returned * unit_price) STORED,
  
  return_reason VARCHAR(50),
  condition VARCHAR(20), -- RESELLABLE, DAMAGED, DEFECTIVE
  notes TEXT,
  
  UNIQUE(return_id, line_number)
);

CREATE INDEX idx_pos_return_lines_return ON sales_pos_return_lines(return_id);
CREATE INDEX idx_pos_return_lines_variant ON sales_pos_return_lines(product_variant_id);
CREATE INDEX idx_pos_return_lines_original ON sales_pos_return_lines(original_line_id);

COMMENT ON TABLE sales_pos_return_lines IS 'POS return line items';

-- ==================== TRIGGERS ====================

-- Auto-update return subtotal
CREATE OR REPLACE FUNCTION update_pos_return_total()
RETURNS TRIGGER AS $$
DECLARE
  v_return_id UUID;
BEGIN
  v_return_id := COALESCE(NEW.return_id, OLD.return_id);
  
  UPDATE sales_pos_returns
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM sales_pos_return_lines
    WHERE return_id = v_return_id
  )
  WHERE id = v_return_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_return_total_insert
  AFTER INSERT ON sales_pos_return_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_return_total();

CREATE TRIGGER trigger_update_pos_return_total_update
  AFTER UPDATE ON sales_pos_return_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_pos_return_total();

CREATE TRIGGER trigger_update_pos_return_total_delete
  AFTER DELETE ON sales_pos_return_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_return_total();

-- ==================== POSTING FUNCTION ====================

-- Post POS return (receive inventory back, create reversal journal entry)
CREATE OR REPLACE FUNCTION post_pos_return(
  p_return_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_return RECORD;
  v_line RECORD;
  v_bin_id UUID;
  v_original_cost DECIMAL(15,2);
BEGIN
  -- Get return header
  SELECT * INTO v_return
  FROM sales_pos_returns
  WHERE id = p_return_id;
  
  IF v_return.status = 'posted' THEN
    RAISE EXCEPTION 'Return already posted';
  END IF;
  
  IF v_return.status != 'approved' THEN
    RAISE EXCEPTION 'Return must be approved before posting';
  END IF;
  
  -- Get default bin
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_return.warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;
  
  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse';
  END IF;
  
  -- Process each return line
  FOR v_line IN 
    SELECT * FROM sales_pos_return_lines WHERE return_id = p_return_id
  LOOP
    -- Get original cost from finished goods balance
    SELECT COALESCE(avg_unit_cost, 0) INTO v_original_cost
    FROM finished_goods_balance_mv
    WHERE product_variant_id = v_line.product_variant_id
      AND warehouse_id = v_return.warehouse_id
      AND bin_id = v_bin_id
      AND company_id = v_return.company_id;
    
    -- Receive goods back into inventory (if resellable)
    IF v_line.condition = 'RESELLABLE' THEN
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
        v_return.company_id,
        v_line.product_variant_id,
        v_return.warehouse_id,
        v_bin_id,
        v_return.period_id,
        v_return.return_date,
        'RECEIPT',
        'SALES_RETURN',
        v_return.id,
        v_return.return_number,
        v_line.qty_returned,
        0,
        v_original_cost,
        p_user_id,
        true
      );
    ELSE
      -- If damaged/defective, record as loss
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
        is_posted,
        notes
      )
      VALUES (
        v_return.company_id,
        v_line.product_variant_id,
        v_return.warehouse_id,
        v_bin_id,
        v_return.period_id,
        v_return.return_date,
        'ADJUSTMENT',
        'SALES_RETURN_LOSS',
        v_return.id,
        v_return.return_number,
        0,
        0, -- Not adding back to inventory
        v_original_cost,
        p_user_id,
        true,
        'Damaged/Defective return - not added back to inventory'
      );
    END IF;
  END LOOP;
  
  -- Update return status
  UPDATE sales_pos_returns
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_return_id;
  
  -- TODO: Create journal entry reversals:
  -- Dr. Sales Return (contra-revenue)  / Cr. Cash/Bank (refund)
  -- Dr. Inventory (if resellable)      / Cr. COGS (reverse COGS)
  -- Dr. Loss (if damaged)              / Cr. [nothing, written off]
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_pos_return IS 'Post POS return: receive inventory back (if resellable) and create reversal journal entries';

-- ==================== VALIDATION FUNCTION ====================

-- Validate return quantities don't exceed original sale
CREATE OR REPLACE FUNCTION validate_return_qty()
RETURNS TRIGGER AS $$
DECLARE
  v_original_qty DECIMAL(15,4);
  v_already_returned DECIMAL(15,4);
  v_total_returned DECIMAL(15,4);
BEGIN
  -- Get original sale quantity
  SELECT qty INTO v_original_qty
  FROM sales_pos_lines
  WHERE id = NEW.original_line_id;
  
  IF v_original_qty IS NULL AND NEW.original_line_id IS NOT NULL THEN
    RAISE EXCEPTION 'Original sale line not found';
  END IF;
  
  -- Get already returned quantity for this line
  SELECT COALESCE(SUM(qty_returned), 0) INTO v_already_returned
  FROM sales_pos_return_lines
  WHERE original_line_id = NEW.original_line_id
    AND id != NEW.id; -- Exclude current row for updates
  
  v_total_returned := v_already_returned + NEW.qty_returned;
  
  -- Validate not exceeding original quantity
  IF v_original_qty IS NOT NULL AND v_total_returned > v_original_qty THEN
    RAISE EXCEPTION 'Return quantity (%) exceeds original sale quantity (%)', 
      v_total_returned, v_original_qty;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_return_qty
  BEFORE INSERT OR UPDATE ON sales_pos_return_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_return_qty();

-- ==================== RLS POLICIES ====================

ALTER TABLE sales_pos_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pos_return_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_returns_tenant_isolation ON sales_pos_returns
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY pos_return_lines_tenant ON sales_pos_return_lines
  FOR ALL USING (return_id IN (
    SELECT id FROM sales_pos_returns WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY pos_returns_service_role ON sales_pos_returns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY pos_return_lines_service_role ON sales_pos_return_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_pos_returns
  AFTER INSERT OR UPDATE OR DELETE ON sales_pos_returns
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Return Summary by Reason
CREATE VIEW pos_return_summary_vw AS
SELECT 
  r.company_id,
  r.return_date,
  r.warehouse_id,
  w.name as warehouse_name,
  r.return_reason,
  COUNT(r.id) as return_count,
  SUM(r.total_amount) as total_refunded,
  COUNT(CASE WHEN rl.condition = 'RESELLABLE' THEN 1 END) as resellable_items,
  COUNT(CASE WHEN rl.condition IN ('DAMAGED', 'DEFECTIVE') THEN 1 END) as damaged_items
FROM sales_pos_returns r
JOIN warehouses w ON w.id = r.warehouse_id
LEFT JOIN sales_pos_return_lines rl ON rl.return_id = r.id
WHERE r.status = 'posted'
GROUP BY r.company_id, r.return_date, r.warehouse_id, w.name, r.return_reason;

COMMENT ON VIEW pos_return_summary_vw IS 'POS return summary by reason and condition';

-- Return Rate Analysis
CREATE VIEW pos_return_rate_vw AS
WITH sales_data AS (
  SELECT 
    sp.company_id,
    sp.sale_date::DATE as txn_date,
    SUM(sp.total_amount) as total_sales,
    COUNT(sp.id) as sale_count
  FROM sales_pos sp
  WHERE sp.status = 'posted'
  GROUP BY sp.company_id, sp.sale_date::DATE
),
return_data AS (
  SELECT 
    r.company_id,
    r.return_date as txn_date,
    SUM(r.total_amount) as total_returns,
    COUNT(r.id) as return_count
  FROM sales_pos_returns r
  WHERE r.status = 'posted'
  GROUP BY r.company_id, r.return_date
)
SELECT 
  COALESCE(s.company_id, r.company_id) as company_id,
  COALESCE(s.txn_date, r.txn_date) as txn_date,
  COALESCE(s.total_sales, 0) as total_sales,
  COALESCE(r.total_returns, 0) as total_returns,
  COALESCE(s.sale_count, 0) as sale_count,
  COALESCE(r.return_count, 0) as return_count,
  CASE 
    WHEN COALESCE(s.total_sales, 0) > 0 
    THEN ROUND((COALESCE(r.total_returns, 0) / s.total_sales * 100), 2)
    ELSE 0 
  END as return_rate_pct
FROM sales_data s
FULL OUTER JOIN return_data r ON s.company_id = r.company_id AND s.txn_date = r.txn_date;

COMMENT ON VIEW pos_return_rate_vw IS 'POS return rate analysis by date';
