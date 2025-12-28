-- Migration: 010_inventory_wip.sql
-- Description: Work-in-Progress ledger for 3-stage manufacturing (CUT, SEW, FINISH)
-- Dependencies: 001_foundation_companies.sql, 006_master_data_products.sql, 009_inventory_raw_material.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE wip_stage AS ENUM ('CUT', 'SEW', 'FINISH');

-- ==================== WIP LEDGER ====================

CREATE TABLE IF NOT EXISTS wip_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Production reference
  production_order_id UUID, -- Will be FK to production_orders in M3
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  stage wip_stage NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100) NOT NULL,
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing
  cost_material DECIMAL(15,2) DEFAULT 0, -- Material cost
  cost_labor DECIMAL(15,2) DEFAULT 0, -- Labor cost added
  cost_overhead DECIMAL(15,2) DEFAULT 0, -- Overhead cost added
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
  CONSTRAINT check_wip_qty CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0)
  )
);

-- Indexes
CREATE INDEX idx_wip_ledger_company ON wip_ledger(company_id);
CREATE INDEX idx_wip_ledger_production_order ON wip_ledger(production_order_id);
CREATE INDEX idx_wip_ledger_product ON wip_ledger(product_id);
CREATE INDEX idx_wip_ledger_warehouse ON wip_ledger(warehouse_id);
CREATE INDEX idx_wip_ledger_stage ON wip_ledger(stage);
CREATE INDEX idx_wip_ledger_date ON wip_ledger(transaction_date DESC);
CREATE INDEX idx_wip_ledger_period ON wip_ledger(period_id);
CREATE INDEX idx_wip_ledger_posted ON wip_ledger(is_posted) WHERE is_posted = true;

-- Composite for balance queries
CREATE INDEX idx_wip_ledger_balance ON wip_ledger(
  company_id, production_order_id, product_id, warehouse_id, stage
) WHERE is_posted = true;

COMMENT ON TABLE wip_ledger IS 'Work-in-Progress ledger tracking manufacturing stages';
COMMENT ON COLUMN wip_ledger.stage IS 'Manufacturing stage: CUT, SEW, or FINISH';
COMMENT ON COLUMN wip_ledger.cost_material IS 'Material cost component';
COMMENT ON COLUMN wip_ledger.cost_labor IS 'Labor cost added at this stage';
COMMENT ON COLUMN wip_ledger.cost_overhead IS 'Overhead cost added at this stage';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW wip_balance_mv AS
SELECT 
  company_id,
  production_order_id,
  product_id,
  warehouse_id,
  stage,
  SUM(qty_in) as total_qty_in,
  SUM(qty_out) as total_qty_out,
  SUM(qty_in) - SUM(qty_out) as current_qty,
  SUM(cost_material) as total_cost_material,
  SUM(cost_labor) as total_cost_labor,
  SUM(cost_overhead) as total_cost_overhead,
  SUM(total_cost) as total_value,
  -- Average cost per unit in WIP
  CASE 
    WHEN SUM(qty_in) > 0 THEN SUM(total_cost) / SUM(qty_in)
    ELSE 0
  END as avg_unit_cost,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date,
  MAX(created_at) as last_movement_at
FROM wip_ledger
WHERE is_posted = true
GROUP BY company_id, production_order_id, product_id, warehouse_id, stage;

CREATE INDEX idx_wip_balance_company ON wip_balance_mv(company_id);
CREATE INDEX idx_wip_balance_po ON wip_balance_mv(production_order_id);
CREATE INDEX idx_wip_balance_product ON wip_balance_mv(product_id);
CREATE INDEX idx_wip_balance_stage ON wip_balance_mv(stage);
CREATE INDEX idx_wip_balance_current_qty ON wip_balance_mv(current_qty) WHERE current_qty > 0;

-- Unique index for direct balance lookup
CREATE UNIQUE INDEX idx_wip_balance_unique ON wip_balance_mv(
  company_id, COALESCE(production_order_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  product_id, warehouse_id, stage
);

COMMENT ON MATERIALIZED VIEW wip_balance_mv IS 'Real-time WIP balance per stage per production order';

-- ==================== TRIGGERS ====================

-- Period lock enforcement
CREATE TRIGGER trigger_period_lock_wip
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MV
CREATE OR REPLACE FUNCTION refresh_wip_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY wip_balance_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_wip_balance
  AFTER INSERT ON wip_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_wip_balance();

-- Validate stage progression (CUT → SEW → FINISH)
CREATE OR REPLACE FUNCTION validate_wip_stage_progression()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_stage wip_stage;
BEGIN
  -- Only validate for production moves
  IF NEW.reference_type = 'PRODUCTION' AND NEW.qty_in > 0 THEN
    -- Get previous stage from reference
    IF NEW.stage = 'SEW' THEN
      v_prev_stage := 'CUT';
    ELSIF NEW.stage = 'FINISH' THEN
      v_prev_stage := 'SEW';
    END IF;
    
    -- Future enhancement: Validate previous stage had stock
    -- For now, just log
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_wip_stage
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION validate_wip_stage_progression();

-- ==================== RLS POLICIES ====================

ALTER TABLE wip_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY wip_ledger_tenant_isolation ON wip_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability
CREATE POLICY wip_ledger_no_update ON wip_ledger
  FOR UPDATE USING (false);

CREATE POLICY wip_ledger_no_delete ON wip_ledger
  FOR DELETE USING (false);

-- Service role
CREATE POLICY wip_ledger_service_role ON wip_ledger
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_wip_ledger
  AFTER INSERT ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get WIP balance for a production order at a specific stage
CREATE OR REPLACE FUNCTION get_wip_balance(
  p_company_id UUID,
  p_production_order_id UUID,
  p_stage wip_stage
)
RETURNS TABLE (
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  total_cost_material DECIMAL(15,2),
  total_cost_labor DECIMAL(15,2),
  total_cost_overhead DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    b.total_cost_material,
    b.total_cost_labor,
    b.total_cost_overhead
  FROM wip_balance_mv b
  WHERE b.company_id = p_company_id
    AND COALESCE(b.production_order_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(p_production_order_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.stage = p_stage;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_wip_balance IS 'Get current WIP balance at a specific stage';

-- Detect hanging WIP (WIP that hasn't moved in X days)
CREATE OR REPLACE FUNCTION get_hanging_wip(
  p_company_id UUID,
  p_days_threshold INTEGER DEFAULT 30
)
RETURNS TABLE (
  production_order_id UUID,
  product_id UUID,
  stage wip_stage,
  current_qty DECIMAL(15,4),
  days_hanging INTEGER,
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.production_order_id,
    b.product_id,
    b.stage,
    b.current_qty,
    EXTRACT(DAY FROM NOW() - b.last_movement_at)::INTEGER as days_hanging,
    b.last_movement_at
  FROM wip_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
    AND b.last_movement_at < NOW() - INTERVAL '1 day' * p_days_threshold
  ORDER BY b.last_movement_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_hanging_wip IS 'Detect WIP that has not moved for specified days (alerts for stalled production)';
