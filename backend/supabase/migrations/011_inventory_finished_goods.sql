-- Migration: 011_inventory_finished_goods.sql
-- Description: Finished Goods ledger with SKU-level tracking
-- Dependencies: 001_foundation_companies.sql, 006_master_data_products.sql, 010_inventory_wip.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== FINISHED GOODS LEDGER ====================

CREATE TABLE IF NOT EXISTS finished_goods_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Product reference (SKU level)
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100) NOT NULL,
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing (FIFO or Weighted Average)
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE 
      WHEN qty_in > 0 THEN qty_in * unit_cost
      WHEN qty_out > 0 THEN qty_out * unit_cost
      ELSE 0
    END
  ) STORED,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_posted BOOLEAN DEFAULT true,
  
  -- Business rules
  CONSTRAINT check_fg_qty CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0)
  )
);

-- Indexes
CREATE INDEX idx_fg_ledger_company ON finished_goods_ledger(company_id);
CREATE INDEX idx_fg_ledger_variant ON finished_goods_ledger(product_variant_id);
CREATE INDEX idx_fg_ledger_warehouse ON finished_goods_ledger(warehouse_id);
CREATE INDEX idx_fg_ledger_bin ON finished_goods_ledger(bin_id);
CREATE INDEX idx_fg_ledger_date ON finished_goods_ledger(transaction_date DESC);
CREATE INDEX idx_fg_ledger_period ON finished_goods_ledger(period_id);
CREATE INDEX idx_fg_ledger_reference ON finished_goods_ledger(reference_type, reference_id);
CREATE INDEX idx_fg_ledger_posted ON finished_goods_ledger(is_posted) WHERE is_posted = true;

-- Composite for balance queries
CREATE INDEX idx_fg_ledger_balance ON finished_goods_ledger(
  company_id, product_variant_id, warehouse_id, bin_id
) WHERE is_posted = true;

COMMENT ON TABLE finished_goods_ledger IS 'Append-only ledger for finished goods (SKU-level)';
COMMENT ON COLUMN finished_goods_ledger.product_variant_id IS 'SKU (size + color combination)';
COMMENT ON COLUMN finished_goods_ledger.unit_cost IS 'Cost per unit from production or purchase';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW finished_goods_balance_mv AS
SELECT 
  company_id,
  product_variant_id,
  warehouse_id,
  bin_id,
  SUM(qty_in) as total_qty_in,
  SUM(qty_out) as total_qty_out,
  SUM(qty_in) - SUM(qty_out) as current_qty,
  -- Weighted average cost
  CASE 
    WHEN SUM(qty_in) > 0 THEN SUM(qty_in * unit_cost) / SUM(qty_in)
    ELSE 0
  END as avg_unit_cost,
  SUM(total_cost) as total_value,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date,
  MAX(created_at) as last_movement_at
FROM finished_goods_ledger
WHERE is_posted = true
GROUP BY company_id, product_variant_id, warehouse_id, bin_id;

-- Indexes for MV
CREATE UNIQUE INDEX idx_fg_balance_unique ON finished_goods_balance_mv(
  company_id, product_variant_id, warehouse_id, bin_id
);

CREATE INDEX idx_fg_balance_company ON finished_goods_balance_mv(company_id);
CREATE INDEX idx_fg_balance_variant ON finished_goods_balance_mv(product_variant_id);
CREATE INDEX idx_fg_balance_warehouse ON finished_goods_balance_mv(warehouse_id);
CREATE INDEX idx_fg_balance_current_qty ON finished_goods_balance_mv(current_qty) WHERE current_qty > 0;

-- Summary view (company-wide, all warehouses)
CREATE MATERIALIZED VIEW finished_goods_summary_mv AS
SELECT 
  company_id,
  product_variant_id,
  SUM(current_qty) as total_current_qty,
  AVG(avg_unit_cost) as overall_avg_cost,
  SUM(total_value) as total_value,
  COUNT(DISTINCT warehouse_id) as warehouse_count,
  MAX(last_movement_at) as last_movement_at
FROM finished_goods_balance_mv
WHERE current_qty > 0
GROUP BY company_id, product_variant_id;

CREATE UNIQUE INDEX idx_fg_summary_unique ON finished_goods_summary_mv(company_id, product_variant_id);

COMMENT ON MATERIALIZED VIEW finished_goods_balance_mv IS 'Real-time FG balance per SKU per location';
COMMENT ON MATERIALIZED VIEW finished_goods_summary_mv IS 'Company-wide FG summary (all warehouses aggregated)';

-- ==================== TRIGGERS ====================

-- Prevent negative stock
CREATE OR REPLACE FUNCTION check_negative_stock_fg()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty DECIMAL(15,4);
BEGIN
  IF NEW.qty_out > 0 THEN
    SELECT COALESCE(current_qty, 0) INTO v_current_qty
    FROM finished_goods_balance_mv
    WHERE company_id = NEW.company_id
      AND product_variant_id = NEW.product_variant_id
      AND warehouse_id = NEW.warehouse_id
      AND bin_id = NEW.bin_id;
    
    IF v_current_qty < NEW.qty_out THEN
      RAISE EXCEPTION 'Insufficient finished goods stock. Available: %, Requested: %', 
        v_current_qty, NEW.qty_out
        USING HINT = 'Check SKU balance before issuing';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_negative_stock_fg
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_negative_stock_fg();

-- Period lock enforcement
CREATE TRIGGER trigger_period_lock_fg
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MVs
CREATE OR REPLACE FUNCTION refresh_fg_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY finished_goods_balance_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY finished_goods_summary_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_fg_balance
  AFTER INSERT ON finished_goods_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_fg_balance();

-- ==================== RLS POLICIES ====================

ALTER TABLE finished_goods_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY fg_ledger_tenant_isolation ON finished_goods_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability
CREATE POLICY fg_ledger_no_update ON finished_goods_ledger
  FOR UPDATE USING (false);

CREATE POLICY fg_ledger_no_delete ON finished_goods_ledger
  FOR DELETE USING (false);

-- Service role
CREATE POLICY fg_ledger_service_role ON finished_goods_ledger
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_fg_ledger
  AFTER INSERT ON finished_goods_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get FG balance for a SKU at a location
CREATE OR REPLACE FUNCTION get_fg_balance(
  p_company_id UUID,
  p_variant_id UUID,
  p_warehouse_id UUID,
  p_bin_id UUID
)
RETURNS TABLE (
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    b.last_movement_at
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.product_variant_id = p_variant_id
    AND b.warehouse_id = p_warehouse_id
    AND b.bin_id = p_bin_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get FG balance across all warehouses (for multi-channel sales)
CREATE OR REPLACE FUNCTION get_fg_total_available(
  p_company_id UUID,
  p_variant_id UUID
)
RETURNS DECIMAL(15,4) AS $$
DECLARE
  v_total_qty DECIMAL(15,4);
BEGIN
  SELECT COALESCE(total_current_qty, 0) INTO v_total_qty
  FROM finished_goods_summary_mv
  WHERE company_id = p_company_id
    AND product_variant_id = p_variant_id;
  
  RETURN v_total_qty;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fg_total_available IS 'Get total available FG across all warehouses (prevents overselling in multi-channel)';

-- Get slow-moving inventory (hasn't moved in X days)
CREATE OR REPLACE FUNCTION get_slow_moving_fg(
  p_company_id UUID,
  p_days_threshold INTEGER DEFAULT 90
)
RETURNS TABLE (
  product_variant_id UUID,
  warehouse_id UUID,
  bin_id UUID,
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  days_stagnant INTEGER,
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.product_variant_id,
    b.warehouse_id,
    b.bin_id,
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    EXTRACT(DAY FROM NOW() - b.last_movement_at)::INTEGER as days_stagnant,
    b.last_movement_at
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
    AND b.last_movement_at < NOW() - INTERVAL '1 day' * p_days_threshold
  ORDER BY b.last_movement_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_slow_moving_fg IS 'Identify slow-moving or dead stock (for promotions or write-offs)';

-- Get inventory aging buckets
CREATE OR REPLACE FUNCTION get_fg_aging(
  p_company_id UUID
)
RETURNS TABLE (
  aging_bucket VARCHAR(20),
  total_qty DECIMAL(15,4),
  total_value DECIMAL(15,2),
  sku_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 30 THEN '0-30 days'
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 60 THEN '31-60 days'
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 90 THEN '61-90 days'
      ELSE '90+ days'
    END as aging_bucket,
    SUM(b.current_qty) as total_qty,
    SUM(b.total_value) as total_value,
    COUNT(*) as sku_count
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
  GROUP BY aging_bucket
  ORDER BY 
    CASE aging_bucket
      WHEN '0-30 days' THEN 1
      WHEN '31-60 days' THEN 2
      WHEN '61-90 days' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fg_aging IS 'Inventory aging analysis for cash flow and discount planning';
