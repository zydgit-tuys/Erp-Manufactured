-- Migration: 037_manufacturing_operations.sql
-- Description: Master data for Manufacturing Operations and Work Centers (M3)
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== WORK CENTERS ====================
-- Defines physical locations/machines where work is performed

CREATE TABLE IF NOT EXISTS work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Capacity Planning
  capacity_per_day DECIMAL(15,2) DEFAULT 8, -- Hours per day
  efficiency_rate DECIMAL(5,2) DEFAULT 100, -- Percentage
  
  -- Costing
  cost_per_hour DECIMAL(15,2) DEFAULT 0 CHECK (cost_per_hour >= 0),
  overhead_rate DECIMAL(15,2) DEFAULT 0 CHECK (overhead_rate >= 0),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_work_centers_company ON work_centers(company_id);
CREATE INDEX idx_work_centers_code ON work_centers(company_id, code);

CREATE TRIGGER trigger_wc_updated_at
  BEFORE UPDATE ON work_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE work_centers IS 'Manufacturing Work Centers (Machine, Station, Line)';

-- ==================== PRODUCTION OPERATIONS ====================
-- Defines standard steps in the manufacturing process (Standard Routing)

CREATE TABLE IF NOT EXISTS production_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Default routing config
  default_work_center_id UUID REFERENCES work_centers(id),
  standard_time_minutes DECIMAL(15,2) DEFAULT 0 CHECK (standard_time_minutes >= 0),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_operations_company ON production_operations(company_id);
CREATE INDEX idx_operations_code ON production_operations(company_id, code);
CREATE INDEX idx_operations_wc ON production_operations(default_work_center_id);

CREATE TRIGGER trigger_ops_updated_at
  BEFORE UPDATE ON production_operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE production_operations IS 'Standard Production Operations (Cutting, Sewing, etc.)';

-- ==================== RLS POLICIES ====================

ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_operations ENABLE ROW LEVEL SECURITY;

-- Work Centers Policies
CREATE POLICY wc_isolation ON work_centers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY wc_service_role ON work_centers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Operations Policies
CREATE POLICY ops_isolation ON production_operations
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY ops_service_role ON production_operations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_work_centers
  AFTER INSERT OR UPDATE OR DELETE ON work_centers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_production_operations
  AFTER INSERT OR UPDATE OR DELETE ON production_operations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
