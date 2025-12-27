-- Migration: 007_master_data_materials.sql
-- Description: Raw material master data
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== MATERIAL CATEGORIES ====================

CREATE TABLE IF NOT EXISTS material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_mat_cat_company ON material_categories(company_id);

COMMENT ON TABLE material_categories IS 'Material categories (Fabric, Thread, Button, Zipper, etc)';

-- ==================== MATERIALS ====================

CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES material_categories(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  unit_of_measure uom DEFAULT 'METER',
  standard_cost DECIMAL(15,2) DEFAULT 0,
  reorder_level DECIMAL(15,2) DEFAULT 0,
  status product_status DEFAULT 'active',
  supplier_code VARCHAR(100),
  lead_time_days INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code),
  CONSTRAINT check_material_cost CHECK (standard_cost >= 0),
  CONSTRAINT check_reorder CHECK (reorder_level >= 0),
  CONSTRAINT check_lead_time CHECK (lead_time_days >= 0)
);

CREATE INDEX idx_materials_company ON materials(company_id);
CREATE INDEX idx_materials_code ON materials(company_id, code);
CREATE INDEX idx_materials_category ON materials(category_id);
CREATE INDEX idx_materials_status ON materials(status) WHERE status = 'active';

CREATE TRIGGER trigger_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE materials IS 'Raw material master data';
COMMENT ON COLUMN materials.reorder_level IS 'Minimum stock level before reorder alert';
COMMENT ON COLUMN materials.lead_time_days IS 'Expected delivery time from vendor';

-- ==================== RLS POLICIES ====================

ALTER TABLE material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY mat_cat_tenant_isolation ON material_categories
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY materials_tenant_isolation ON materials
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY mat_cat_service_role ON material_categories FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY materials_service_role ON materials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRIGGERS ====================

CREATE TRIGGER trigger_audit_materials
  AFTER INSERT OR UPDATE OR DELETE ON materials
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
