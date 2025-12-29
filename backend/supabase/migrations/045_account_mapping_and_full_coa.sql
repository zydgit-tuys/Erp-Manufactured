-- Migration: 045_account_mapping_and_full_coa.sql
-- Description: System account mappings and dynamic linking
-- Dependencies: 002_foundation_coa.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

-- ==================== SYSTEM ACCOUNT MAPPINGS ====================

CREATE TABLE IF NOT EXISTS system_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  mapping_code VARCHAR(50) NOT NULL, -- e.g., 'DEFAULT_CASH', 'ACCOUNTS_RECEIVABLE'
  account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, mapping_code)
);

-- Indexes
CREATE INDEX idx_mappings_company ON system_account_mappings(company_id);
CREATE INDEX idx_mappings_code ON system_account_mappings(mapping_code);

-- Comments
COMMENT ON TABLE system_account_mappings IS 'Links abstract system functions (e.g. Sales) to specific COA accounts';
COMMENT ON COLUMN system_account_mappings.mapping_code IS 'System code used in code to look up the account';

-- ==================== RLS POLICIES ====================

ALTER TABLE system_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY mapping_isolation ON system_account_mappings
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY mapping_service_role ON system_account_mappings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== SEED MAPPINGS FUNCTION ====================

CREATE OR REPLACE FUNCTION seed_account_mappings(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Helper to insert if mapping doesn't exist AND account exists
  -- Cash
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'DEFAULT_CASH', id, 'Default Cash Account for POS/Payments'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1010'
  ON CONFLICT DO NOTHING;

  -- Bank (Primary)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'DEFAULT_BANK', id, 'Default Bank Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1020'
  ON CONFLICT DO NOTHING;

  -- Accounts Receivable
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'ACCOUNTS_RECEIVABLE', id, 'Default AR Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1100'
  ON CONFLICT DO NOTHING;

  -- Inventory Codes
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'INVENTORY_RAW', id, 'Raw Material Inventory'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1210'
  ON CONFLICT DO NOTHING;
  
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'INVENTORY_WIP', id, 'Work in Progress Inventory'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1220'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'INVENTORY_FG', id, 'Finished Goods Inventory'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1250'
  ON CONFLICT DO NOTHING;

  -- Accounts Payable
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'ACCOUNTS_PAYABLE', id, 'Default AP Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2010'
  ON CONFLICT DO NOTHING;

  -- Tax
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'TAX_PAYABLE', id, 'VAT/Tax Payable'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2030'
  ON CONFLICT DO NOTHING;

  -- Sales
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_POS', id, 'Sales Revenue for Retail/POS'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_WHOLESALE', id, 'Sales Revenue for Distributor/B2B'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4020'
  ON CONFLICT DO NOTHING;

  -- COGS
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'COGS_DEFAULT', id, 'Cost of Goods Sold'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '5010'
  ON CONFLICT DO NOTHING;
  
  -- Expenses
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'EXPENSE_LABOR', id, 'Direct Labor Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'EXPENSE_OVERHEAD', id, 'Factory Overhead Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6020'
  ON CONFLICT DO NOTHING;
  
  -- Clearing (Marketplace)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'CLEARING_SHOPEE', id, 'Shopee Wallet Clearing'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2110'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
