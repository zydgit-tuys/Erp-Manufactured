-- Migration: 017_manufacturing_bom.sql
-- Description: Bill of Materials (BOM) - multi-level product recipes
-- Dependencies: 006_master_data_products.sql, 007_master_data_materials.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== BOM HEADERS ====================

CREATE TABLE IF NOT EXISTS bom_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  
  version VARCHAR(20) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Base production quantity
  base_qty DECIMAL(15,4) DEFAULT 1 CHECK (base_qty > 0),
  
  -- Expected yield
  yield_percentage DECIMAL(5,2) DEFAULT 100 CHECK (yield_percentage > 0 AND yield_percentage <= 100),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, version)
);

CREATE INDEX idx_bom_company ON bom_headers(company_id);
CREATE INDEX idx_bom_product ON bom_headers(product_id);
CREATE INDEX idx_bom_active ON bom_headers(is_active) WHERE is_active = true;

CREATE TRIGGER trigger_bom_updated_at
  BEFORE UPDATE ON bom_headers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE bom_headers IS 'Bill of Materials header (product recipe)';

-- ==================== BOM LINES ====================

CREATE TABLE IF NOT EXISTS bom_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id UUID REFERENCES bom_headers(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  -- Component (either material OR sub-assembly product)
  material_id UUID REFERENCES materials(id),
  component_product_id UUID REFERENCES products(id),
  
  -- Quantity per base_qty
  qty_per DECIMAL(15,4) NOT NULL CHECK (qty_per > 0),
  uom uom,
  
  -- Scrap allowance
  scrap_percentage DECIMAL(5,2) DEFAULT 0 CHECK (scrap_percentage >= 0 AND scrap_percentage < 100),
  
  -- Stage where this component is consumed
  stage wip_stage,
  
  notes TEXT,
  
  CONSTRAINT check_bom_component CHECK (
    (material_id IS NOT NULL AND component_product_id IS NULL) OR
    (material_id IS NULL AND component_product_id IS NOT NULL)
  ),
  UNIQUE(bom_id, line_number)
);

CREATE INDEX idx_bom_lines_bom ON bom_lines(bom_id);
CREATE INDEX idx_bom_lines_material ON bom_lines(material_id);
CREATE INDEX idx_bom_lines_component ON bom_lines(component_product_id);
CREATE INDEX idx_bom_lines_stage ON bom_lines(stage);

COMMENT ON TABLE bom_lines IS 'BOM components (materials or sub-assemblies)';

-- ==================== BOM EXPLOSION (RECURSIVE) ====================

-- Explode BOM to calculate all required materials
CREATE OR REPLACE FUNCTION explode_bom(
  p_product_id UUID,
  p_qty DECIMAL(15,4),
  p_max_level INTEGER DEFAULT 10
)
RETURNS TABLE (
  level_num INTEGER,
  material_id UUID,
  material_code VARCHAR,
  material_name VARCHAR,
  component_product_id UUID,
  product_code VARCHAR,
  product_name VARCHAR,
  qty_per DECIMAL(15,4),
  total_qty DECIMAL(15,4),
  scrap_percentage DECIMAL(5,2),
  stage wip_stage,
  uom VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE bom_explosion AS (
    -- Base level: Get active BOM for product
    SELECT 
      1 as level_num,
      bl.material_id,
      m.code as material_code,
      m.name as material_name,
      bl.component_product_id,
      cp.code as product_code,
      cp.name as product_name,
      bl.qty_per,
      bl.qty_per * p_qty * (1 + bl.scrap_percentage / 100) as total_qty,
      bl.scrap_percentage,
      bl.stage,
      bl.uom::VARCHAR
    FROM bom_lines bl
    JOIN bom_headers bh ON bh.id = bl.bom_id
    LEFT JOIN materials m ON m.id = bl.material_id
    LEFT JOIN products cp ON cp.id = bl.component_product_id
    WHERE bh.product_id = p_product_id
      AND bh.is_active = true
      AND CURRENT_DATE BETWEEN bh.effective_from AND COALESCE(bh.effective_to, '9999-12-31')
    
    UNION ALL
    
    -- Recursive: Explode sub-assemblies
    SELECT 
      be.level_num + 1,
      bl.material_id,
      m.code,
      m.name,
      bl.component_product_id,
      cp.code,
      cp.name,
      bl.qty_per,
      bl.qty_per * be.total_qty * (1 + bl.scrap_percentage / 100),
      bl.scrap_percentage,
      bl.stage,
      bl.uom::VARCHAR
    FROM bom_explosion be
    JOIN bom_headers bh ON bh.product_id = be.component_product_id
    JOIN bom_lines bl ON bl.bom_id = bh.id
    LEFT JOIN materials m ON m.id = bl.material_id
    LEFT JOIN products cp ON cp.id = bl.component_product_id
    WHERE bh.is_active = true
      AND CURRENT_DATE BETWEEN bh.effective_from AND COALESCE(bh.effective_to, '9999-12-31')
      AND be.level_num < p_max_level
      AND be.component_product_id IS NOT NULL
  )
  SELECT * FROM bom_explosion
  ORDER BY level_num, material_code, product_code;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION explode_bom IS 'Recursively explode BOM to calculate all material requirements';

-- ==================== VALIDATE BOM (NO CIRCULAR REFERENCES) ====================

CREATE OR REPLACE FUNCTION validate_bom_no_circular()
RETURNS TRIGGER AS $$
DECLARE
  v_circular BOOLEAN;
BEGIN
  -- Check if adding this line would create a circular reference
  IF NEW.component_product_id IS NOT NULL THEN
    -- Try to explode the BOM
    BEGIN
      PERFORM * FROM explode_bom(NEW.component_product_id, 1);
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Circular BOM reference detected. Cannot create this BOM line.';
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_bom
  BEFORE INSERT OR UPDATE ON bom_lines
  FOR EACH ROW
  WHEN (NEW.component_product_id IS NOT NULL)
  EXECUTE FUNCTION validate_bom_no_circular();

-- ==================== RLS POLICIES ====================

ALTER TABLE bom_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY bom_tenant_isolation ON bom_headers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY bom_lines_tenant ON bom_lines
  FOR ALL USING (bom_id IN (
    SELECT id FROM bom_headers WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY bom_service_role ON bom_headers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY bom_lines_service_role ON bom_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_bom
  AFTER INSERT OR UPDATE OR DELETE ON bom_headers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- BOM Summary
CREATE VIEW bom_summary_vw AS
SELECT 
  bh.id,
  bh.company_id,
  p.code as product_code,
  p.name as product_name,
  bh.version,
  bh.base_qty,
  bh.yield_percentage,
  bh.is_active,
  COUNT(bl.id) as component_count,
  COUNT(CASE WHEN bl.material_id IS NOT NULL THEN 1 END) as material_count,
  COUNT(CASE WHEN bl.component_product_id IS NOT NULL THEN 1 END) as subassembly_count
FROM bom_headers bh
JOIN products p ON p.id = bh.product_id
LEFT JOIN bom_lines bl ON bl.bom_id = bh.id
GROUP BY bh.id, p.code, p.name;

COMMENT ON VIEW bom_summary_vw IS 'BOM summary with component counts';
