-- Migration: 008_master_data_vendors_customers.sql
-- Description: Vendor and customer master data
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE payment_terms AS ENUM ('COD', 'NET_7', 'NET_14', 'NET_30', 'NET_60', 'CUSTOM');
CREATE TYPE partner_status AS ENUM ('active', 'inactive', 'blocked');

-- ==================== VENDORS ====================

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  tax_id VARCHAR(50),
  payment_terms payment_terms DEFAULT 'COD',
  custom_payment_days INTEGER,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  status partner_status DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code),
  CONSTRAINT check_vendor_credit CHECK (credit_limit >= 0),
  CONSTRAINT check_custom_days CHECK (
    (payment_terms = 'CUSTOM' AND custom_payment_days IS NOT NULL) OR
    (payment_terms != 'CUSTOM')
  )
);

CREATE INDEX idx_vendors_company ON vendors(company_id);
CREATE INDEX idx_vendors_code ON vendors(company_id, code);
CREATE INDEX idx_vendors_status ON vendors(status) WHERE status = 'active';
CREATE INDEX idx_vendors_name ON vendors(company_id, name);

CREATE TRIGGER trigger_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE vendors IS 'Vendor/supplier master data';
COMMENT ON COLUMN vendors.payment_terms IS 'Payment terms (COD, Net 7/14/30/60 days)';
COMMENT ON COLUMN vendors.credit_limit IS 'Maximum outstanding payable allowed';

-- ==================== CUSTOMERS ====================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  tax_id VARCHAR(50),
  payment_terms payment_terms DEFAULT 'COD',
  custom_payment_days INTEGER,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  credit_hold BOOLEAN DEFAULT false,
  status partner_status DEFAULT 'active',
  customer_type VARCHAR(50),
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code),
  CONSTRAINT check_customer_credit CHECK (credit_limit >= 0),
  CONSTRAINT check_discount CHECK (discount_percentage BETWEEN 0 AND 100),
  CONSTRAINT check_custom_days_customer CHECK (
    (payment_terms = 'CUSTOM' AND custom_payment_days IS NOT NULL) OR
    (payment_terms != 'CUSTOM')
  )
);

CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_code ON customers(company_id, code);
CREATE INDEX idx_customers_status ON customers(status) WHERE status = 'active';
CREATE INDEX idx_customers_name ON customers(company_id, name);
CREATE INDEX idx_customers_type ON customers(customer_type);

CREATE TRIGGER trigger_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE customers IS 'Customer master data (retail, distributor, marketplace)';
COMMENT ON COLUMN customers.customer_type IS 'Customer type (Retail, Distributor, Marketplace)';
COMMENT ON COLUMN customers.discount_percentage IS 'Default discount percentage for this customer';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum AR balance allowed for credit sales';
COMMENT ON COLUMN customers.credit_hold IS 'If true, blocks new sales orders and deliveries';


-- ==================== CUSTOMER PRICE LISTS ====================

CREATE TABLE IF NOT EXISTS customer_price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT check_price CHECK (unit_price >= 0),
  CONSTRAINT check_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_price_list_company ON customer_price_lists(company_id);
CREATE INDEX idx_price_list_customer ON customer_price_lists(customer_id);
CREATE INDEX idx_price_list_variant ON customer_price_lists(product_variant_id);
CREATE INDEX idx_price_list_dates ON customer_price_lists(effective_from, effective_to);

COMMENT ON TABLE customer_price_lists IS 'Customer-specific pricing (negotiated prices)';

-- ==================== WAREHOUSES & BINS ====================

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  manager_name VARCHAR(100),
  phone VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, code)
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id);
CREATE INDEX idx_warehouses_active ON warehouses(is_active) WHERE is_active = true;

COMMENT ON TABLE warehouses IS 'Warehouse/storage locations';

CREATE TABLE IF NOT EXISTS bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  aisle VARCHAR(20),
  rack VARCHAR(20),
  level VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(warehouse_id, code)
);

CREATE INDEX idx_bins_warehouse ON bins(warehouse_id);
CREATE INDEX idx_bins_active ON bins(is_active) WHERE is_active = true;

COMMENT ON TABLE bins IS 'Bin locations within warehouses (for inventory tracking)';
COMMENT ON COLUMN bins.aisle IS 'Aisle identifier (e.g., A, B, C)';
COMMENT ON COLUMN bins.rack IS 'Rack identifier (e.g., 1, 2, 3)';
COMMENT ON COLUMN bins.level IS 'Level identifier (e.g., 1, 2, 3)';

-- ==================== RLS POLICIES ====================

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendors_tenant_isolation ON vendors
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY customers_tenant_isolation ON customers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY price_lists_tenant_isolation ON customer_price_lists
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY warehouses_tenant_isolation ON warehouses
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY bins_tenant_isolation ON bins
  FOR ALL USING (warehouse_id IN (
    SELECT id FROM warehouses WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Service role bypass
CREATE POLICY vendors_service_role ON vendors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY customers_service_role ON customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY price_lists_service_role ON customer_price_lists FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY warehouses_service_role ON warehouses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY bins_service_role ON bins FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRIGGERS ====================

CREATE TRIGGER trigger_audit_vendors
  AFTER INSERT OR UPDATE OR DELETE ON vendors
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
