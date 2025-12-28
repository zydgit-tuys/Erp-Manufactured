-- Migration: 006_master_data_products.sql
-- Description: Product master data with size/color variants
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');
CREATE TYPE uom AS ENUM ('PCS', 'SET', 'PACK', 'METER', 'KG', 'LITER');

-- ==================== SIZE MASTER ====================

CREATE TABLE IF NOT EXISTS sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_sizes_company ON sizes(company_id);
CREATE INDEX idx_sizes_active ON sizes(is_active) WHERE is_active = true;

COMMENT ON TABLE sizes IS 'Size master (S, M, L, XL, XXL, etc)';

-- ==================== COLOR MASTER ====================

CREATE TABLE IF NOT EXISTS colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(50) NOT NULL,
  hex_code VARCHAR(7),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code),
  CONSTRAINT check_hex_format CHECK (hex_code ~* '^#[0-9A-F]{6}$' OR hex_code IS NULL)
);

CREATE INDEX idx_colors_company ON colors(company_id);
CREATE INDEX idx_colors_active ON colors(is_active) WHERE is_active = true;

COMMENT ON TABLE colors IS 'Color master (Red, Blue, Black, etc)';

-- ==================== PRODUCTS (STYLE) ====================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit_of_measure uom DEFAULT 'PCS',
  standard_cost DECIMAL(15,2) DEFAULT 0,
  selling_price DECIMAL(15,2) DEFAULT 0,
  status product_status DEFAULT 'active',
  image_url TEXT,
  barcode VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code),
  CONSTRAINT check_costs CHECK (standard_cost >= 0 AND selling_price >= 0)
);

CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_code ON products(company_id, code);
CREATE INDEX idx_products_category ON products(company_id, category);
CREATE INDEX idx_products_status ON products(status) WHERE status = 'active';

CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE products IS 'Product master (style level, e.g., "Kaos Polos")';
COMMENT ON COLUMN products.code IS 'Product style code (e.g., TS-001)';

-- ==================== PRODUCT VARIANTS (SKU) ====================

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  size_id UUID REFERENCES sizes(id),
  color_id UUID REFERENCES colors(id),
  sku VARCHAR(100) NOT NULL,
  barcode VARCHAR(100),
  unit_cost DECIMAL(15,2) DEFAULT 0,
  unit_price DECIMAL(15,2) DEFAULT 0,
  status product_status DEFAULT 'active',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, sku),
  UNIQUE(product_id, size_id, color_id),
  CONSTRAINT check_variant_costs CHECK (unit_cost >= 0 AND unit_price >= 0)
);

CREATE INDEX idx_variants_company ON product_variants(company_id);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(company_id, sku);
CREATE INDEX idx_variants_size ON product_variants(size_id);
CREATE INDEX idx_variants_color ON product_variants(color_id);
CREATE INDEX idx_variants_status ON product_variants(status) WHERE status = 'active';

CREATE TRIGGER trigger_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate SKU from product code + size + color
CREATE OR REPLACE FUNCTION generate_sku()
RETURNS TRIGGER AS $$
DECLARE
  v_product_code VARCHAR(50);
  v_size_code VARCHAR(20);
  v_color_code VARCHAR(20);
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    -- Get product code
    SELECT code INTO v_product_code
    FROM products
    WHERE id = NEW.product_id;
    
    -- Get size code
    SELECT code INTO v_size_code
    FROM sizes
    WHERE id = NEW.size_id;
    
    -- Get color code
    SELECT code INTO v_color_code
    FROM colors
    WHERE id = NEW.color_id;
    
    -- Generate SKU: PRODUCT-SIZE-COLOR
    NEW.sku := v_product_code || '-' || COALESCE(v_size_code, 'OS') || '-' || COALESCE(v_color_code, 'NA');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_sku
  BEFORE INSERT ON product_variants
  FOR EACH ROW
  EXECUTE FUNCTION generate_sku();

COMMENT ON TABLE product_variants IS 'Product variants (SKU level, e.g., "Kaos Polos - M - Red")';
COMMENT ON COLUMN product_variants.sku IS 'Stock Keeping Unit (unique identifier for size+color combination)';

-- ==================== RLS POLICIES ====================

ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY sizes_tenant_isolation ON sizes
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY colors_tenant_isolation ON colors
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY products_tenant_isolation ON products
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY variants_tenant_isolation ON product_variants
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- Service role bypass
CREATE POLICY sizes_service_role ON sizes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY colors_service_role ON colors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY products_service_role ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY variants_service_role ON product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRIGGERS ====================

CREATE TRIGGER trigger_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_variants
  AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
