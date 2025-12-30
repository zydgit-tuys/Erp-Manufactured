-- Migration: 056_manufacturing_routing.sql
-- Description: Create Work Centers and Operations tables (Missing from Phase 6.5)
-- Dependencies: 055_auto_populate_created_by.sql

-- ==================== WORK CENTERS ====================

CREATE TABLE IF NOT EXISTS work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capacity_per_day DECIMAL(10,2) DEFAULT 8.0, -- Hours per day
  cost_per_hour DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_work_centers_company ON work_centers(company_id);
CREATE INDEX idx_work_centers_active ON work_centers(is_active) WHERE is_active = true;

-- Triggers
CREATE TRIGGER trigger_work_centers_updated_at
  BEFORE UPDATE ON work_centers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_audit_work_centers
  AFTER INSERT OR UPDATE OR DELETE ON work_centers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Apply NEW created_by automation
CREATE TRIGGER trigger_set_created_by 
  BEFORE INSERT ON work_centers 
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- RLS
ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_centers_tenant_isolation ON work_centers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- ==================== OPERATIONS ====================

CREATE TABLE IF NOT EXISTS operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  work_center_id UUID REFERENCES work_centers(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  standard_time_minutes DECIMAL(10,2) DEFAULT 0,
  sequence INTEGER DEFAULT 0, -- Default sequence if used in a template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, name) -- Simple unique constraint for now
);

CREATE INDEX idx_operations_company ON operations(company_id);
CREATE INDEX idx_operations_work_center ON operations(work_center_id);

-- Triggers
CREATE TRIGGER trigger_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_audit_operations
  AFTER INSERT OR UPDATE OR DELETE ON operations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Apply NEW created_by automation
CREATE TRIGGER trigger_set_created_by 
  BEFORE INSERT ON operations 
  FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- RLS
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY operations_tenant_isolation ON operations
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- Comments
COMMENT ON TABLE work_centers IS 'Factory floor locations or machines (e.g., Cutting Station, Sewing Machine 01)';
COMMENT ON TABLE operations IS 'Standard manufacturing processes (e.g., Stitching, Gluing)';
