-- Migration: 018_manufacturing_production_orders.sql
-- Description: Production orders with material reservations and MRP
-- Dependencies: 017_manufacturing_bom.sql, 009_inventory_raw_material.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE production_status AS ENUM (
  'planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'
);

-- ==================== PRODUCTION ORDERS ====================

CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  
  product_id UUID REFERENCES products(id) NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Quantities
  qty_planned DECIMAL(15,4) NOT NULL CHECK (qty_planned > 0),
  qty_completed DECIMAL(15,4) DEFAULT 0 CHECK (qty_completed >= 0),
  qty_rejected DECIMAL(15,4) DEFAULT 0 CHECK (qty_rejected >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_planned - qty_completed - qty_rejected) STORED,
  
  -- Schedule
  start_date DATE,
  due_date DATE,
  completion_date DATE,
  
  status production_status DEFAULT 'planned',
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Costing
  standard_cost DECIMAL(15,2) DEFAULT 0,
  actual_cost DECIMAL(15,2) DEFAULT 0,
  cost_variance DECIMAL(15,2) GENERATED ALWAYS AS (actual_cost - standard_cost) STORED,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_prod_order_company ON production_orders(company_id);
CREATE INDEX idx_prod_order_product ON production_orders(product_id);
CREATE INDEX idx_prod_order_status ON production_orders(status);
CREATE INDEX idx_prod_order_date ON production_orders(po_date DESC);
CREATE INDEX idx_prod_order_due_date ON production_orders(due_date);
CREATE INDEX idx_prod_order_priority ON production_orders(priority);

CREATE TRIGGER trigger_prod_order_updated_at
  BEFORE UPDATE ON production_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE production_orders IS 'Production orders (manufacturing work orders)';

-- ==================== MATERIAL RESERVATIONS ====================

CREATE TABLE IF NOT EXISTS production_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) NOT NULL,
  stage wip_stage,
  
  qty_required DECIMAL(15,4) NOT NULL CHECK (qty_required > 0),
  qty_issued DECIMAL(15,4) DEFAULT 0 CHECK (qty_issued >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_required - qty_issued) STORED,
  
  unit_cost DECIMAL(15,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservation_po ON production_reservations(production_order_id);
CREATE INDEX idx_reservation_material ON production_reservations(material_id);
CREATE INDEX idx_reservation_outstanding ON production_reservations(qty_outstanding) WHERE qty_outstanding > 0;

COMMENT ON TABLE production_reservations IS 'Material reservations for production orders';

-- ==================== FUNCTIONS ====================

-- Create reservations from BOM explosion
CREATE OR REPLACE FUNCTION create_production_reservations(
  p_production_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_po RECORD;
  v_material RECORD;
BEGIN
  -- Get production order
  SELECT * INTO v_po
  FROM production_orders
  WHERE id = p_production_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;
  
  -- Delete existing reservations
  DELETE FROM production_reservations
  WHERE production_order_id = p_production_order_id;
  
  -- Create reservations from BOM explosion
  INSERT INTO production_reservations (
    production_order_id,
    material_id,
    stage,
    qty_required,
    unit_cost
  )
  SELECT 
    p_production_order_id,
    e.material_id,
    e.stage,
    e.total_qty,
    m.standard_cost
  FROM explode_bom(v_po.product_id, v_po.qty_planned) e
  JOIN materials m ON m.id = e.material_id
  WHERE e.material_id IS NOT NULL;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_production_reservations IS 'Create material reservations from BOM explosion';

-- Calculate MRP (Material Requirements Planning)
CREATE OR REPLACE FUNCTION calculate_mrp(
  p_production_order_id UUID
)
RETURNS TABLE (
  material_id UUID,
  material_code VARCHAR,
  material_name VARCHAR,
  gross_requirement DECIMAL(15,4),
  on_hand DECIMAL(15,4),
  reserved_other DECIMAL(15,4),
  available DECIMAL(15,4),
  net_requirement DECIMAL(15,4),
  action VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.material_id,
    m.code as material_code,
    m.name as material_name,
    pr.qty_required as gross_requirement,
    COALESCE(rmb.current_qty, 0) as on_hand,
    COALESCE((
      SELECT SUM(qty_outstanding)
      FROM production_reservations
      WHERE material_id = pr.material_id
        AND production_order_id != p_production_order_id
    ), 0) as reserved_other,
    COALESCE(rmb.current_qty, 0) - COALESCE((
      SELECT SUM(qty_outstanding)
      FROM production_reservations
      WHERE material_id = pr.material_id
        AND production_order_id != p_production_order_id
    ), 0) as available,
    GREATEST(
      pr.qty_required - (
        COALESCE(rmb.current_qty, 0) - COALESCE((
          SELECT SUM(qty_outstanding)
          FROM production_reservations
          WHERE material_id = pr.material_id
            AND production_order_id != p_production_order_id
        ), 0)
      ),
      0
    ) as net_requirement,
    CASE
      WHEN COALESCE(rmb.current_qty, 0) - COALESCE((
        SELECT SUM(qty_outstanding)
        FROM production_reservations
        WHERE material_id = pr.material_id
          AND production_order_id != p_production_order_id
      ), 0) >= pr.qty_required THEN 'OK'
      WHEN COALESCE(rmb.current_qty, 0) > 0 THEN 'PARTIAL'
      ELSE 'PURCHASE'
    END as action
  FROM production_reservations pr
  JOIN materials m ON m.id = pr.material_id
  LEFT JOIN (
    SELECT 
      material_id,
      company_id,
      SUM(current_qty) as current_qty
    FROM raw_material_balance_mv
    GROUP BY material_id, company_id
  ) rmb ON rmb.material_id = pr.material_id
  WHERE pr.production_order_id = p_production_order_id
  ORDER BY action DESC, material_code;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_mrp IS 'Calculate material requirements and availability';

-- Release production order (check material availability)
CREATE OR REPLACE FUNCTION release_production_order(
  p_production_order_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_shortage_count INTEGER;
BEGIN
  -- Check for material shortages
  SELECT COUNT(*) INTO v_shortage_count
  FROM calculate_mrp(p_production_order_id)
  WHERE action = 'PURCHASE';
  
  IF v_shortage_count > 0 THEN
    RAISE EXCEPTION 'Cannot release production order: % materials in shortage', v_shortage_count;
  END IF;
  
  -- Release order
  UPDATE production_orders
  SET 
    status = 'released',
    released_at = NOW(),
    released_by = p_user_id
  WHERE id = p_production_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION release_production_order IS 'Release production order after checking material availability';

-- ==================== RLS POLICIES ====================

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY prod_order_tenant_isolation ON production_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY reservation_tenant ON production_reservations
  FOR ALL USING (production_order_id IN (
    SELECT id FROM production_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY prod_order_service_role ON production_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY reservation_service_role ON production_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_prod_orders
  AFTER INSERT OR UPDATE OR DELETE ON production_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Production Order Summary
CREATE VIEW production_order_summary_vw AS
SELECT 
  po.id,
  po.company_id,
  po.po_number,
  po.po_date,
  p.code as product_code,
  p.name as product_name,
  po.qty_planned,
  po.qty_completed,
  po.qty_rejected,
  po.qty_outstanding,
  po.status,
  po.priority,
  po.due_date,
  po.standard_cost,
  po.actual_cost,
  po.cost_variance,
  COUNT(pr.id) as material_count,
  SUM(CASE WHEN pr.qty_outstanding > 0 THEN 1 ELSE 0 END) as materials_pending
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN production_reservations pr ON pr.production_order_id = po.id
GROUP BY po.id, p.code, p.name;

COMMENT ON VIEW production_order_summary_vw IS 'Production order summary with material status';
