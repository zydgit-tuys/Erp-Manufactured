-- Migration: 019_manufacturing_work_orders.sql
-- Description: Work orders, time tracking, and material backflushing
-- Dependencies: 018_manufacturing_production_orders.sql, 010_inventory_wip.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE wo_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- ==================== WORK ORDERS ====================

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  wo_number VARCHAR(50) UNIQUE NOT NULL,
  production_order_id UUID REFERENCES production_orders(id) NOT NULL,
  
  stage wip_stage NOT NULL,
  
  -- Quantities
  qty_started DECIMAL(15,4) NOT NULL CHECK (qty_started > 0),
  qty_completed DECIMAL(15,4) DEFAULT 0 CHECK (qty_completed >= 0),
  qty_rejected DECIMAL(15,4) DEFAULT 0 CHECK (qty_rejected >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_started - qty_completed - qty_rejected) STORED,
  
  -- Schedule
  start_datetime TIMESTAMPTZ,
  end_datetime TIMESTAMPTZ,
  
  -- Operator
  operator_id UUID REFERENCES auth.users(id),
  
  status wo_status DEFAULT 'pending',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_wo_company ON work_orders(company_id);
CREATE INDEX idx_wo_production_order ON work_orders(production_order_id);
CREATE INDEX idx_wo_stage ON work_orders(stage);
CREATE INDEX idx_wo_status ON work_orders(status);
CREATE INDEX idx_wo_operator ON work_orders(operator_id);

COMMENT ON TABLE work_orders IS 'Work orders for shop floor execution';

-- ==================== TIME TRACKING ====================

CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE NOT NULL,
  
  operator_id UUID REFERENCES auth.users(id) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  
  -- Duration in minutes
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER / 60
      ELSE 0
    END
  ) STORED,
  
  -- Labor costing
  labor_rate DECIMAL(15,2), -- Rate per hour
  labor_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE 
      WHEN end_time IS NOT NULL AND labor_rate IS NOT NULL THEN
        (EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) * labor_rate
      ELSE 0
    END
  ) STORED,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entry_wo ON work_order_time_entries(work_order_id);
CREATE INDEX idx_time_entry_operator ON work_order_time_entries(operator_id);
CREATE INDEX idx_time_entry_start ON work_order_time_entries(start_time);

COMMENT ON TABLE work_order_time_entries IS 'Time tracking for labor costing';

-- ==================== MATERIAL BACKFLUSHING ====================

-- Function to backflush materials when work order completes
CREATE OR REPLACE FUNCTION backflush_materials(
  p_work_order_id UUID,
  p_qty_completed DECIMAL(15,4),
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_wo RECORD;
  v_po RECORD;
  v_material RECORD;
  v_warehouse_id UUID;
  v_bin_id UUID;
  v_period_id UUID;
BEGIN
  -- Get work order
  SELECT * INTO v_wo
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Get production order
  SELECT * INTO v_po
  FROM production_orders
  WHERE id = v_wo.production_order_id;
  
  v_warehouse_id := v_po.warehouse_id;
  v_period_id := v_po.period_id;
  
  -- Get default bin for warehouse
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;
  
  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse';
  END IF;
  
  -- Issue materials for this stage
  FOR v_material IN
    SELECT 
      pr.material_id,
      pr.qty_required / v_po.qty_planned * p_qty_completed as qty_to_issue,
      m.standard_cost as unit_cost
    FROM production_reservations pr
    JOIN materials m ON m.id = pr.material_id
    WHERE pr.production_order_id = v_wo.production_order_id
      AND pr.stage = v_wo.stage
  LOOP
    -- Issue material to production
    INSERT INTO raw_material_ledger (
      company_id,
      material_id,
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
    ) VALUES (
      v_po.company_id,
      v_material.material_id,
      v_warehouse_id,
      v_bin_id,
      v_period_id,
      CURRENT_DATE,
      'ISSUE',
      'PRODUCTION',
      v_wo.production_order_id,
      v_po.po_number,
      0,
      v_material.qty_to_issue,
      v_material.unit_cost,
      p_user_id,
      true
    );
    
    -- Update reservation
    UPDATE production_reservations
    SET qty_issued = qty_issued + v_material.qty_to_issue
    WHERE production_order_id = v_wo.production_order_id
      AND material_id = v_material.material_id
      AND stage = v_wo.stage;
  END LOOP;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION backflush_materials IS 'Auto-issue materials based on BOM when work order completes';

-- ==================== COMPLETE WORK ORDER ====================

CREATE OR REPLACE FUNCTION complete_work_order(
  p_work_order_id UUID,
  p_qty_completed DECIMAL(15,4),
  p_qty_rejected DECIMAL(15,4),
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_wo RECORD;
  v_po RECORD;
  v_total_labor_cost DECIMAL(15,2);
  v_material_cost DECIMAL(15,2);
BEGIN
  -- Get work order
  SELECT * INTO v_wo
  FROM work_orders
  WHERE id = p_work_order_id;
  
  -- Get production order
  SELECT * INTO v_po
  FROM production_orders
  WHERE id = v_wo.production_order_id;
  
  -- Backflush materials
  PERFORM backflush_materials(p_work_order_id, p_qty_completed, p_user_id);
  
  -- Calculate material cost from backflushed materials
  SELECT SUM(qty_out * unit_cost) INTO v_material_cost
  FROM raw_material_ledger
  WHERE reference_id = v_wo.production_order_id
    AND reference_type = 'PRODUCTION'
    AND created_at >= v_wo.start_datetime;
  
  -- Get labor cost from time entries
  SELECT COALESCE(SUM(labor_cost), 0) INTO v_total_labor_cost
  FROM work_order_time_entries
  WHERE work_order_id = p_work_order_id;
  
  -- Record WIP movement
  IF v_wo.stage = 'CUT' THEN
    -- First stage: IN to CUT
    INSERT INTO wip_ledger (
      company_id,
      production_order_id,
      product_id,
      warehouse_id,
      period_id,
      transaction_date,
      stage,
      transaction_type,
      reference_type,
      reference_id,
      reference_number,
      qty_in,
      qty_out,
      cost_material,
      cost_labor,
      cost_overhead,
      unit_cost,
      created_by,
      is_posted
    ) VALUES (
      v_po.company_id,
      v_po.id,
      v_po.product_id,
      v_po.warehouse_id,
      v_po.period_id,
      CURRENT_DATE,
      'CUT',
      'RECEIPT',
      'PRODUCTION',
      p_work_order_id,
      v_wo.wo_number,
      p_qty_completed,
      0,
      COALESCE(v_material_cost, 0),
      COALESCE(v_total_labor_cost, 0),
      0, -- Overhead calculated separately
      (COALESCE(v_material_cost, 0) + COALESCE(v_total_labor_cost, 0)) / NULLIF(p_qty_completed, 0),
      p_user_id,
      true
    );
  ELSE
    -- Middle/Final stages: OUT from previous, IN to current
    -- This will be handled by the production service
  END IF;
  
  -- Update work order
  UPDATE work_orders
  SET 
    qty_completed = p_qty_completed,
    qty_rejected = p_qty_rejected,
    status = 'completed',
    end_datetime = NOW()
  WHERE id = p_work_order_id;
  
  -- Update production order
  UPDATE production_orders
  SET 
    qty_completed = qty_completed + p_qty_completed,
    qty_rejected = qty_rejected + p_qty_rejected,
    status = CASE
      WHEN qty_completed + p_qty_completed >= qty_planned THEN 'completed'
      WHEN qty_completed + p_qty_completed > 0 THEN 'in_progress'
      ELSE status
    END
  WHERE id = v_wo.production_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION complete_work_order IS 'Complete work order: backflush materials, record WIP, update costs';

-- ==================== RLS POLICIES ====================

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY wo_tenant_isolation ON work_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY time_entry_tenant ON work_order_time_entries
  FOR ALL USING (work_order_id IN (
    SELECT id FROM work_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY wo_service_role ON work_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY time_entry_service_role ON work_order_time_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_work_orders
  AFTER INSERT OR UPDATE OR DELETE ON work_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Work Order Summary with Labor Hours
CREATE VIEW work_order_summary_vw AS
SELECT 
  wo.id,
  wo.company_id,
  wo.wo_number,
  po.po_number as production_order,
  p.code as product_code,
  p.name as product_name,
  wo.stage,
  wo.qty_started,
  wo.qty_completed,
  wo.qty_rejected,
  wo.qty_outstanding,
  wo.status,
  u.email as operator_email,
  COALESCE(SUM(te.duration_minutes), 0) / 60.0 as total_hours,
  COALESCE(SUM(te.labor_cost), 0) as total_labor_cost
FROM work_orders wo
JOIN production_orders po ON po.id = wo.production_order_id
JOIN products p ON p.id = po.product_id
LEFT JOIN auth.users u ON u.id = wo.operator_id
LEFT JOIN work_order_time_entries te ON te.work_order_id = wo.id
GROUP BY wo.id, po.po_number, p.code, p.name, u.email;

COMMENT ON VIEW work_order_summary_vw IS 'Work order summary with labor tracking';

-- Production Cost Detail
CREATE VIEW production_cost_detail_vw AS
SELECT 
  po.id as production_order_id,
  po.po_number,
  p.code as product_code,
  po.qty_planned,
  po.qty_completed,
  
  -- Material cost by stage
  SUM(CASE WHEN w.stage = 'CUT' THEN w.cost_material ELSE 0 END) as material_cost_cut,
  SUM(CASE WHEN w.stage = 'SEW' THEN w.cost_material ELSE 0 END) as material_cost_sew,
  SUM(CASE WHEN w.stage = 'FINISH' THEN w.cost_material ELSE 0 END) as material_cost_finish,
  
  -- Labor cost by stage  
  SUM(CASE WHEN w.stage = 'CUT' THEN w.cost_labor ELSE 0 END) as labor_cost_cut,
  SUM(CASE WHEN w.stage = 'SEW' THEN w.cost_labor ELSE 0 END) as labor_cost_sew,
  SUM(CASE WHEN w.stage = 'FINISH' THEN w.cost_labor ELSE 0 END) as labor_cost_finish,
  
  -- Totals
  SUM(w.cost_material) as total_material_cost,
  SUM(w.cost_labor) as total_labor_cost,
  SUM(w.cost_overhead) as total_overhead_cost,
  SUM(w.cost_material + w.cost_labor + w.cost_overhead) as total_actual_cost,
  
  po.standard_cost,
  SUM(w.cost_material + w.cost_labor + w.cost_overhead) - po.standard_cost as cost_variance,
  
  -- Cost per unit
  CASE 
    WHEN po.qty_completed > 0 THEN 
      SUM(w.cost_material + w.cost_labor + w.cost_overhead) / po.qty_completed
    ELSE 0
  END as cost_per_unit
  
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN wip_ledger w ON w.production_order_id = po.id AND w.is_posted = true
GROUP BY po.id, p.code;

COMMENT ON VIEW production_cost_detail_vw IS 'Detailed production cost analysis by stage';
