-- Migration: 001_foundation_companies.sql
-- Description: Core companies table with tenant isolation
-- Dependencies: None
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== COMPANIES TABLE ====================

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  tax_id VARCHAR(50),
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  logo_url TEXT,
  base_currency VARCHAR(3) DEFAULT 'IDR',
  fiscal_year_start_month INTEGER DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  
  CONSTRAINT check_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT check_code_format CHECK (code ~ '^[A-Z0-9-]+$')
);

-- Indexes for performance
CREATE INDEX idx_companies_code ON companies(code);
CREATE INDEX idx_companies_active ON companies(is_active) WHERE is_active = true;
CREATE INDEX idx_companies_created_at ON companies(created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE companies IS 'Root tenant table - each company is a separate tenant with isolated data';
COMMENT ON COLUMN companies.code IS 'Unique company identifier (uppercase alphanumeric)';
COMMENT ON COLUMN companies.fiscal_year_start_month IS 'Month when fiscal year starts (1=January, 12=December)';

-- ==================== USER-COMPANY MAPPING ====================

CREATE TABLE IF NOT EXISTS user_company_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, company_id)
);

CREATE INDEX idx_user_company_user ON user_company_mapping(user_id);
CREATE INDEX idx_user_company_company ON user_company_mapping(company_id);

COMMENT ON TABLE user_company_mapping IS 'Maps users to companies for multi-tenant access';
COMMENT ON COLUMN user_company_mapping.role IS 'User role in this company (admin, manager, user, etc)';

-- ==================== RLS POLICIES ====================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_company_mapping ENABLE ROW LEVEL SECURITY;

-- Users can only see companies they belong to
CREATE POLICY company_isolation ON companies
  FOR ALL
  USING (
    id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Users can only see their own mappings
CREATE POLICY user_mapping_own ON user_company_mapping
  FOR ALL
  USING (user_id = auth.uid());

-- Service role bypass (for migrations and admin operations)
CREATE POLICY company_service_role ON companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY mapping_service_role ON user_company_mapping
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
