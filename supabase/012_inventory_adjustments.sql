-- Migration: 012_inventory_adjustments.sql
-- Description: Stock opname, inventory adjustments, and internal transfers
-- Dependencies: 009-011 (Inventory ledgers)
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE adjustment_reason AS ENUM (
  'DAMAGED',
  'EXPIRED',
  'LOST',
  'FOUND',
  'COUNTING_ERROR',
  'QUALITY_ISSUE',
  'SHRINKAGE',
  'OTHER'
);

CREATE TYPE opname_status AS ENUM ('draft', 'counting', 'completed', 'posted');
CREATE TYPE adjustment_status AS ENUM ('draft', 'approved', 'posted', 'cancelled');
CREATE TYPE transfer_status AS ENUM ('draft', 'in_transit', 'completed', 'cancelled');

-- ==================== STOCK OPNAME (PHYSICAL COUNT) ====================

CREATE TABLE IF NOT EXISTS stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  opname_number VARCHAR(50) UNIQUE NOT NULL,
  opname_date DATE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  status opname_status DEFAULT 'draft',
  
  -- Lifecycle tracking
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_opname_company ON stock_opname(company_id);
CREATE INDEX idx_opname_warehouse ON stock_opname(warehouse_id);
CREATE INDEX idx_opname_status ON stock_opname(status);
CREATE INDEX idx_opname_date ON stock_opname(opname_date DESC);

COMMENT ON TABLE stock_opname IS 'Physical inventory count header';

CREATE TABLE IF NOT EXISTS stock_opname_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID REFERENCES stock_opname(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference (either material OR product variant)
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  -- System balance (from MV)
  system_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
  system_unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  system_value DECIMAL(15,2) GENERATED ALWAYS AS (system_qty * system_unit_cost) STORED,
  
  -- Physical count
  physical_qty DECIMAL(15,4) DEFAULT 0,
  physical_value DECIMAL(15,2) GENERATED ALWAYS AS (physical_qty * system_unit_cost) STORED,
  
  -- Variance (auto-calculated)
  variance_qty DECIMAL(15,4) GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
  variance_value DECIMAL(15,2) GENERATED ALWAYS AS (
    (physical_qty - system_qty) * system_unit_cost
  ) STORED,
  
  -- Audit
  reason_code adjustment_reason,
  notes TEXT,
  counted_by UUID REFERENCES auth.users(id),
  counted_at TIMESTAMPTZ,
  
  CONSTRAINT check_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_opname_lines_opname ON stock_opname_lines(opname_id);
CREATE INDEX idx_opname_lines_material ON stock_opname_lines(material_id);
CREATE INDEX idx_opname_lines_variant ON stock_opname_lines(product_variant_id);
CREATE INDEX idx_opname_lines_variance ON stock_opname_lines(variance_qty) WHERE variance_qty != 0;

COMMENT ON TABLE stock_opname_lines IS 'Physical count details with variance calculation';

-- ==================== INVENTORY ADJUSTMENTS ====================

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  adjustment_number VARCHAR(50) UNIQUE NOT NULL,
  adjustment_date DATE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  adjustment_type VARCHAR(10) NOT NULL CHECK (adjustment_type IN ('IN', 'OUT')),
  reason adjustment_reason NOT NULL,
  
  -- Reference to source (e.g., stock opname)
  reference_type VARCHAR(50),
  reference_id UUID,
  
  status adjustment_status DEFAULT 'draft',
  
  -- Approval (for large adjustments)
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_adj_company ON inventory_adjustments(company_id);
CREATE INDEX idx_adj_warehouse ON inventory_adjustments(warehouse_id);
CREATE INDEX idx_adj_status ON inventory_adjustments(status);
CREATE INDEX idx_adj_date ON inventory_adjustments(adjustment_date DESC);
CREATE INDEX idx_adj_reference ON inventory_adjustments(reference_type, reference_id);

COMMENT ON TABLE inventory_adjustments IS 'Inventory adjustment header (IN/OUT)';

CREATE TABLE IF NOT EXISTS inventory_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID REFERENCES inventory_adjustments(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_value DECIMAL(15,2) GENERATED ALWAYS AS (qty * unit_cost) STORED,
  
  reason_code adjustment_reason,
  notes TEXT,
  
  CONSTRAINT check_adj_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_adj_lines_adjustment ON inventory_adjustment_lines(adjustment_id);
CREATE INDEX idx_adj_lines_material ON inventory_adjustment_lines(material_id);
CREATE INDEX idx_adj_lines_variant ON inventory_adjustment_lines(product_variant_id);

COMMENT ON TABLE inventory_adjustment_lines IS 'Adjustment line items';

-- ==================== INTERNAL TRANSFERS ====================

CREATE TABLE IF NOT EXISTS internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- From location
  from_warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  from_bin_id UUID REFERENCES bins(id) NOT NULL,
  
  -- To location
  to_warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  to_bin_id UUID REFERENCES bins(id) NOT NULL,
  
  status transfer_status DEFAULT 'draft',
  
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT check_different_locations CHECK (
    from_warehouse_id != to_warehouse_id OR from_bin_id != to_bin_id
  )
);

CREATE INDEX idx_transfer_company ON internal_transfers(company_id);
CREATE INDEX idx_transfer_from_wh ON internal_transfers(from_warehouse_id);
CREATE INDEX idx_transfer_to_wh ON internal_transfers(to_warehouse_id);
CREATE INDEX idx_transfer_status ON internal_transfers(status);
CREATE INDEX idx_transfer_date ON internal_transfers(transfer_date DESC);

COMMENT ON TABLE internal_transfers IS 'Internal transfers between bins/warehouses';

CREATE TABLE IF NOT EXISTS internal_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES internal_transfers(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  
  notes TEXT,
  
  CONSTRAINT check_transfer_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_transfer_lines_transfer ON internal_transfer_lines(transfer_id);
CREATE INDEX idx_transfer_lines_material ON internal_transfer_lines(material_id);
CREATE INDEX idx_transfer_lines_variant ON internal_transfer_lines(product_variant_id);

-- ==================== TRIGGERS ====================

-- Auto-check if adjustment requires approval (large variance)
CREATE OR REPLACE FUNCTION check_adjustment_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_total_value DECIMAL(15,2);
BEGIN
  -- Calculate total adjustment value
  SELECT SUM(total_value) INTO v_total_value
  FROM inventory_adjustment_lines
  WHERE adjustment_id = NEW.id;
  
  -- Require approval if total > 1M IDR
  IF v_total_value > 1000000 THEN
    NEW.requires_approval := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_adjustment_approval
  BEFORE UPDATE OF status ON inventory_adjustments
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION check_adjustment_approval();

-- Prevent posting without approval if required
CREATE OR REPLACE FUNCTION validate_adjustment_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requires_approval AND NEW.approved_by IS NULL THEN
    RAISE EXCEPTION 'Adjustment requires approval before posting';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_adjustment_posting
  BEFORE UPDATE OF status ON inventory_adjustments
  FOR EACH ROW
  WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION validate_adjustment_posting();

-- ==================== RLS POLICIES ====================

ALTER TABLE stock_opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfer_lines ENABLE ROW LEVEL SECURITY;

-- Tenant isolation (all tables)
CREATE POLICY opname_tenant_isolation ON stock_opname
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY opname_lines_tenant ON stock_opname_lines
  FOR ALL USING (opname_id IN (
    SELECT id FROM stock_opname WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY adj_tenant_isolation ON inventory_adjustments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY adj_lines_tenant ON inventory_adjustment_lines
  FOR ALL USING (adjustment_id IN (
    SELECT id FROM inventory_adjustments WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY transfer_tenant_isolation ON internal_transfers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY transfer_lines_tenant ON internal_transfer_lines
  FOR ALL USING (transfer_id IN (
    SELECT id FROM internal_transfers WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Service role bypass
CREATE POLICY opname_service_role ON stock_opname FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY opname_lines_service_role ON stock_opname_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY adj_service_role ON inventory_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY adj_lines_service_role ON inventory_adjustment_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY transfer_service_role ON internal_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY transfer_lines_service_role ON internal_transfer_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_opname
  AFTER INSERT OR UPDATE OR DELETE ON stock_opname
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON inventory_adjustments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON internal_transfers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
