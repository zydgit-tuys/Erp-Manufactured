-- Migration: 009_inventory_raw_material.sql
-- Description: Raw material ledger with balance tracking
-- Dependencies: 001_foundation_companies.sql, 007_master_data_materials.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE transaction_type AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER');
CREATE TYPE reference_type AS ENUM (
  'PURCHASE', 
  'PRODUCTION', 
  'ADJUSTMENT', 
  'TRANSFER',
  'SALES_RETURN',
  'OPENING_BALANCE'
);

-- ==================== RAW MATERIAL LEDGER ====================

CREATE TABLE IF NOT EXISTS raw_material_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100),
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing
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
  CONSTRAINT check_qty_direction CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0) OR
    (qty_in = 0 AND qty_out = 0) -- Allow zero for corrections
  ),
  CONSTRAINT check_reference CHECK (
    reference_number IS NOT NULL AND reference_number != ''
  )
);

-- Indexes for performance
CREATE INDEX idx_raw_ledger_company ON raw_material_ledger(company_id);
CREATE INDEX idx_raw_ledger_material ON raw_material_ledger(material_id);
CREATE INDEX idx_raw_ledger_warehouse ON raw_material_ledger(warehouse_id);
CREATE INDEX idx_raw_ledger_bin ON raw_material_ledger(bin_id);
CREATE INDEX idx_raw_ledger_date ON raw_material_ledger(transaction_date DESC);
CREATE INDEX idx_raw_ledger_period ON raw_material_ledger(period_id);
CREATE INDEX idx_raw_ledger_reference ON raw_material_ledger(reference_type, reference_id);
CREATE INDEX idx_raw_ledger_posted ON raw_material_ledger(is_posted) WHERE is_posted = true;

-- Composite index for balance queries
CREATE INDEX idx_raw_ledger_balance ON raw_material_ledger(
  company_id, material_id, warehouse_id, bin_id
) WHERE is_posted = true;

COMMENT ON TABLE raw_material_ledger IS 'Append-only ledger for raw material movements';
COMMENT ON COLUMN raw_material_ledger.qty_in IS 'Quantity received (receipts, adjustments up)';
COMMENT ON COLUMN raw_material_ledger.qty_out IS 'Quantity issued (production, adjustments down)';
COMMENT ON COLUMN raw_material_ledger.unit_cost IS 'Cost per unit at time of transaction (immutable)';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW raw_material_balance_mv AS
SELECT 
  company_id,
  material_id,
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
FROM raw_material_ledger
WHERE is_posted = true
GROUP BY company_id, material_id, warehouse_id, bin_id;

CREATE UNIQUE INDEX idx_raw_balance_unique ON raw_material_balance_mv(
  company_id, material_id, warehouse_id, bin_id
);

CREATE INDEX idx_raw_balance_company ON raw_material_balance_mv(company_id);
CREATE INDEX idx_raw_balance_material ON raw_material_balance_mv(material_id);
CREATE INDEX idx_raw_balance_current_qty ON raw_material_balance_mv(current_qty) WHERE current_qty > 0;

COMMENT ON MATERIALIZED VIEW raw_material_balance_mv IS 'Real-time balance snapshot of raw materials';

-- ==================== TRIGGERS ====================

-- Prevent negative stock
CREATE OR REPLACE FUNCTION check_negative_stock_raw()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty DECIMAL(15,4);
BEGIN
  -- Only check for issues (qty_out)
  IF NEW.qty_out > 0 THEN
    -- Get current balance
    SELECT COALESCE(current_qty, 0) INTO v_current_qty
    FROM raw_material_balance_mv
    WHERE company_id = NEW.company_id
      AND material_id = NEW.material_id
      AND warehouse_id = NEW.warehouse_id
      AND bin_id = NEW.bin_id;
    
    -- Check if issue would cause negative stock
    IF v_current_qty < NEW.qty_out THEN
      RAISE EXCEPTION 'Insufficient stock for material. Available: %, Requested: %', 
        v_current_qty, NEW.qty_out
        USING HINT = 'Check material balance before issuing';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_negative_stock_raw
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_negative_stock_raw();

-- Period lock enforcement
CREATE OR REPLACE FUNCTION check_period_lock_raw()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status VARCHAR(20);
BEGIN
  SELECT status INTO v_period_status
  FROM accounting_periods
  WHERE id = NEW.period_id;
  
  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'Cannot post to closed accounting period'
      USING HINT = 'Reopen the period or post to current open period';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_period_lock_raw
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MV after insert
CREATE OR REPLACE FUNCTION refresh_raw_material_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY raw_material_balance_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_raw_balance
  AFTER INSERT ON raw_material_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_raw_material_balance();

-- ==================== RLS POLICIES ====================

ALTER TABLE raw_material_ledger ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY raw_ledger_tenant_isolation ON raw_material_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability (no UPDATE/DELETE)
CREATE POLICY raw_ledger_no_update ON raw_material_ledger
  FOR UPDATE
  USING (false);

CREATE POLICY raw_ledger_no_delete ON raw_material_ledger
  FOR DELETE
  USING (false);

-- Service role bypass
CREATE POLICY raw_ledger_service_role ON raw_material_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_raw_ledger
  AFTER INSERT ON raw_material_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get current balance for a material at a location
CREATE OR REPLACE FUNCTION get_raw_material_balance(
  p_company_id UUID,
  p_material_id UUID,
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
  FROM raw_material_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.material_id = p_material_id
    AND b.warehouse_id = p_warehouse_id
    AND b.bin_id = p_bin_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_raw_material_balance IS 'Get current balance for a specific material at a location';
