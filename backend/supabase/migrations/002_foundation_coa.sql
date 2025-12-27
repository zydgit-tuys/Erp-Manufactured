-- Migration: 002_foundation_coa.sql
-- Description: Chart of Accounts with konveksi industry template
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE account_type AS ENUM (
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE'
);

CREATE TYPE account_category AS ENUM (
  -- Assets
  'CURRENT_ASSET',
  'FIXED_ASSET',
  'INVENTORY',
  -- Liabilities
  'CURRENT_LIABILITY',
  'LONG_TERM_LIABILITY',
  -- Equity
  'CAPITAL',
  'RETAINED_EARNINGS',
  -- Revenue
  'SALES_REVENUE',
  'OTHER_INCOME',
  -- Expense
  'COGS',
  'OPERATING_EXPENSE',
  'OTHER_EXPENSE'
);

-- ==================== CHART OF ACCOUNTS ====================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  account_type account_type NOT NULL,
  account_category account_category NOT NULL,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  is_header BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  normal_balance VARCHAR(10) NOT NULL CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, account_code),
  
  -- Business rules
  CONSTRAINT check_header_no_parent CHECK (
    (is_header = true AND parent_account_id IS NULL) OR
    (is_header = false)
  ),
  CONSTRAINT check_normal_balance_type CHECK (
    (account_type IN ('ASSET', 'EXPENSE') AND normal_balance = 'DEBIT') OR
    (account_type IN ('LIABILITY', 'EQUITY', 'REVENUE') AND normal_balance = 'CREDIT')
  )
);

-- Indexes
CREATE INDEX idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX idx_coa_code ON chart_of_accounts(company_id, account_code);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_category ON chart_of_accounts(account_category);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX idx_coa_active ON chart_of_accounts(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER trigger_coa_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prevent deletion of system accounts
CREATE OR REPLACE FUNCTION prevent_system_account_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'Cannot delete system account: %', OLD.account_name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prevent_system_account_deletion
  BEFORE DELETE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_account_deletion();

-- Comments
COMMENT ON TABLE chart_of_accounts IS 'Multi-level chart of accounts with parent-child hierarchy';
COMMENT ON COLUMN chart_of_accounts.is_header IS 'Header accounts cannot have transactions, only child accounts';
COMMENT ON COLUMN chart_of_accounts.is_system IS 'System accounts cannot be deleted (e.g., Retained Earnings)';
COMMENT ON COLUMN chart_of_accounts.normal_balance IS 'Normal balance side: DEBIT for assets/expenses, CREDIT for liabilities/equity/revenue';

-- ==================== RLS POLICIES ====================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY coa_tenant_isolation ON chart_of_accounts
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY coa_service_role ON chart_of_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
