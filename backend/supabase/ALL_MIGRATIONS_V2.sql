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


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 003_foundation_periods.sql
-- Description: Accounting period control with period locking
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE period_status AS ENUM ('open', 'closed');

-- ==================== ACCOUNTING PERIODS ====================

CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  period_code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fiscal_year INTEGER NOT NULL,
  status period_status DEFAULT 'open',
  
  -- Audit fields
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, period_code),
  
  -- Business rules
  CONSTRAINT check_dates CHECK (end_date > start_date),
  CONSTRAINT check_period_code_format CHECK (period_code ~ '^\d{4}-\d{2}$'),
  CONSTRAINT check_fiscal_year CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
  CONSTRAINT check_closed_audit CHECK (
    (status = 'closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL) OR
    (status = 'open')
  )
);

-- Indexes
CREATE INDEX idx_periods_company ON accounting_periods(company_id);
CREATE INDEX idx_periods_code ON accounting_periods(company_id, period_code);
CREATE INDEX idx_periods_status ON accounting_periods(status);
CREATE INDEX idx_periods_dates ON accounting_periods(start_date, end_date);
CREATE INDEX idx_periods_fiscal_year ON accounting_periods(company_id, fiscal_year);

-- ==================== FUNCTIONS ====================

-- Prevent overlapping periods
CREATE OR REPLACE FUNCTION check_period_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE company_id = NEW.company_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      (NEW.start_date BETWEEN start_date AND end_date) OR
      (NEW.end_date BETWEEN start_date AND end_date) OR
      (start_date BETWEEN NEW.start_date AND NEW.end_date)
    )
  ) THEN
    RAISE EXCEPTION 'Period dates overlap with existing period for this company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_period_overlap
  BEFORE INSERT OR UPDATE ON accounting_periods
  FOR EACH ROW
  EXECUTE FUNCTION check_period_overlap();

-- Auto-generate period code from dates
CREATE OR REPLACE FUNCTION generate_period_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.period_code IS NULL OR NEW.period_code = '' THEN
    NEW.period_code := to_char(NEW.start_date, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_period_code
  BEFORE INSERT ON accounting_periods
  FOR EACH ROW
  EXECUTE FUNCTION generate_period_code();

-- Audit period closure/reopening
CREATE OR REPLACE FUNCTION audit_period_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status = 'open' THEN
    NEW.closed_at := NOW();
    NEW.closed_by := auth.uid();
  ELSIF NEW.status = 'open' AND OLD.status = 'closed' THEN
    NEW.reopened_at := NOW();
    NEW.reopened_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_period_status
  BEFORE UPDATE ON accounting_periods
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION audit_period_status_change();

-- Comments
COMMENT ON TABLE accounting_periods IS 'Accounting period control for financial closing and transaction dating';
COMMENT ON COLUMN accounting_periods.period_code IS 'Period identifier in YYYY-MM format';
COMMENT ON COLUMN accounting_periods.status IS 'Period status: open (allows transactions) or closed (locked)';
COMMENT ON CONSTRAINT check_period_code_format ON accounting_periods IS 'Period code must be in YYYY-MM format';

-- ==================== RLS POLICIES ====================

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY periods_tenant_isolation ON accounting_periods
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY periods_service_role ON accounting_periods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== HELPER FUNCTIONS ====================

-- Get current open period for a company
CREATE OR REPLACE FUNCTION get_current_open_period(p_company_id UUID)
RETURNS UUID AS $$
DECLARE
  v_period_id UUID;
BEGIN
  SELECT id INTO v_period_id
  FROM accounting_periods
  WHERE company_id = p_company_id
    AND status = 'open'
    AND CURRENT_DATE BETWEEN start_date AND end_date
  LIMIT 1;
  
  RETURN v_period_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_current_open_period IS 'Returns the open period that contains today''s date for a company';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 004_foundation_audit.sql
-- Description: Comprehensive audit trail system
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ==================== AUDIT LOG TABLE ====================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operation audit_operation NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Ensure at least one value is present
  CONSTRAINT check_values CHECK (
    (operation = 'DELETE' AND old_values IS NOT NULL) OR
    (operation = 'INSERT' AND new_values IS NOT NULL) OR
    (operation = 'UPDATE' AND old_values IS NOT NULL AND new_values IS NOT NULL)
  )
);

-- Indexes for fast querying
CREATE INDEX idx_audit_company ON audit_log(company_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_operation ON audit_log(operation);
CREATE INDEX idx_audit_user ON audit_log(changed_by);
CREATE INDEX idx_audit_timestamp ON audit_log(changed_at DESC);
CREATE INDEX idx_audit_company_table_record ON audit_log(company_id, table_name, record_id);

-- Composite index for common queries
CREATE INDEX idx_audit_table_record_timestamp ON audit_log(table_name, record_id, changed_at DESC);

-- Comments
COMMENT ON TABLE audit_log IS 'Immutable audit trail for all data changes across the system';
COMMENT ON COLUMN audit_log.changed_fields IS 'Array of field names that changed (for UPDATE operations)';
COMMENT ON COLUMN audit_log.old_values IS 'Complete record before change (for UPDATE and DELETE)';
COMMENT ON COLUMN audit_log.new_values IS 'Complete record after change (for INSERT and UPDATE)';

-- ==================== AUDIT TRIGGER FUNCTION ====================

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_changed_fields TEXT[];
  v_company_id UUID;
BEGIN
  -- Get company_id from the record
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
  ELSE
    v_company_id := NEW.company_id;
  END IF;

  -- Handle different operations
  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    
    INSERT INTO audit_log (
      company_id, table_name, record_id, operation,
      old_values, changed_by, changed_at
    ) VALUES (
      v_company_id, TG_TABLE_NAME, OLD.id, 'DELETE',
      v_old_values, auth.uid(), NOW()
    );
    
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Calculate changed fields
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(v_new_values)
    WHERE v_old_values->key IS DISTINCT FROM v_new_values->key;
    
    -- Only log if there are actual changes
    IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO audit_log (
        company_id, table_name, record_id, operation,
        old_values, new_values, changed_fields, changed_by, changed_at
      ) VALUES (
        v_company_id, TG_TABLE_NAME, NEW.id, 'UPDATE',
        v_old_values, v_new_values, v_changed_fields, auth.uid(), NOW()
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'INSERT' THEN
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO audit_log (
      company_id, table_name, record_id, operation,
      new_values, changed_by, changed_at
    ) VALUES (
      v_company_id, TG_TABLE_NAME, NEW.id, 'INSERT',
      v_new_values, auth.uid(), NOW()
    );
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger IS 'Generic trigger function to capture INSERT/UPDATE/DELETE operations';

-- ==================== APPLY AUDIT TO FOUNDATION TABLES ====================

-- Audit companies table
CREATE TRIGGER trigger_audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Audit COA
CREATE TRIGGER trigger_audit_coa
  AFTER INSERT OR UPDATE OR DELETE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Audit periods
CREATE TRIGGER trigger_audit_periods
  AFTER INSERT OR UPDATE OR DELETE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== RLS POLICIES ====================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read audit logs for their company
CREATE POLICY audit_read_own_company ON audit_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only trigger can insert (not users directly)
CREATE POLICY audit_insert_trigger ON audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit log is immutable (no updates or deletes by users)
CREATE POLICY audit_no_update ON audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY audit_no_delete ON audit_log
  FOR DELETE
  USING (false);

-- Service role can do anything (for maintenance)
CREATE POLICY audit_service_role ON audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== HELPER FUNCTIONS ====================

-- Get audit history for a specific record
CREATE OR REPLACE FUNCTION get_audit_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  operation audit_operation,
  changed_at TIMESTAMPTZ,
  changed_by UUID,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.operation,
    a.changed_at,
    a.changed_by,
    a.changed_fields,
    a.old_values,
    a.new_values
  FROM audit_log a
  WHERE a.table_name = p_table_name
    AND a.record_id = p_record_id
  ORDER BY a.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_audit_history IS 'Returns audit history for a specific record';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 005_seed_coa_template.sql
-- Description: Seed Chart of Accounts template for konveksi industry
-- Dependencies: 002_foundation_coa.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27
-- Note: This is a template - actual seed happens per company creation

-- ==================== COA TEMPLATE FUNCTION ====================

CREATE OR REPLACE FUNCTION seed_coa_template(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Insert konveksi COA template
  INSERT INTO chart_of_accounts (
    company_id, account_code, account_name, account_type, 
    account_category, normal_balance, is_header, is_system, level
  ) VALUES
  
  -- ==================== ASSETS (1000-1999) ====================
  (p_company_id, '1000', 'ASSETS', 'ASSET', 'CURRENT_ASSET', 'DEBIT', true, true, 1),
  
  -- Current Assets
  (p_company_id, '1010', 'Cash in Hand', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, true, 2),
  (p_company_id, '1020', 'Bank Account - BCA', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, true, 2),
  (p_company_id, '1030', 'Bank Account - BNI', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, false, 2),
  (p_company_id, '1040', 'Bank Account - OVO', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, false, 2),
  (p_company_id, '1050', 'Bank Account - GoPay', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, false, 2),
  
  -- Accounts Receivable
  (p_company_id, '1100', 'Accounts Receivable', 'ASSET', 'CURRENT_ASSET', 'DEBIT', false, true, 2),
  (p_company_id, '1110', 'Allowance for Doubtful Accounts', 'ASSET', 'CURRENT_ASSET', 'CREDIT', false, false, 2),
  
  -- Inventory
  (p_company_id, '1200', 'INVENTORY', 'ASSET', 'INVENTORY', 'DEBIT', true, true, 2),
  (p_company_id, '1210', 'Raw Material Inventory', 'ASSET', 'INVENTORY', 'DEBIT', false, true, 3),
  (p_company_id, '1220', 'WIP Inventory - CUT', 'ASSET', 'INVENTORY', 'DEBIT', false, true, 3),
  (p_company_id, '1230', 'WIP Inventory - SEW', 'ASSET', 'INVENTORY', 'DEBIT', false, true, 3),
  (p_company_id, '1240', 'WIP Inventory - FINISH', 'ASSET', 'INVENTORY', 'DEBIT', false, true, 3),
  (p_company_id, '1250', 'Finished Goods Inventory', 'ASSET', 'INVENTORY', 'DEBIT', false, true, 3),
  
  -- Fixed Assets
  (p_company_id, '1500', 'FIXED ASSETS', 'ASSET', 'FIXED_ASSET', 'DEBIT', true, true, 2),
  (p_company_id, '1510', 'Sewing Machines', 'ASSET', 'FIXED_ASSET', 'DEBIT', false, false, 3),
  (p_company_id, '1520', 'Cutting Equipment', 'ASSET', 'FIXED_ASSET', 'DEBIT', false, false, 3),
  (p_company_id, '1530', 'Furniture & Fixtures', 'ASSET', 'FIXED_ASSET', 'DEBIT', false, false, 3),
  (p_company_id, '1590', 'Accumulated Depreciation', 'ASSET', 'FIXED_ASSET', 'CREDIT', false, true, 3),
  
  -- ==================== LIABILITIES (2000-2999) ====================
  (p_company_id, '2000', 'LIABILITIES', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', true, true, 1),
  
  -- Current Liabilities
  (p_company_id, '2010', 'Accounts Payable', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, true, 2),
  (p_company_id, '2020', 'Accrued Labor', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, true, 2),
  (p_company_id, '2030', 'Tax Payable - VAT', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 2),
  (p_company_id, '2040', 'Tax Payable - Income', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 2),
  (p_company_id, '2050', 'Employee Benefits Payable', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 2),
  
  -- Marketplace Clearing
  (p_company_id, '2100', 'Marketplace Clearing', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, true, 2),
  (p_company_id, '2110', 'Shopee Clearing', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 3),
  (p_company_id, '2120', 'TikTok Clearing', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 3),
  (p_company_id, '2130', 'Tokopedia Clearing', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 3),
  (p_company_id, '2140', 'Lazada Clearing', 'LIABILITY', 'CURRENT_LIABILITY', 'CREDIT', false, false, 3),
  
  -- ==================== EQUITY (3000-3999) ====================
  (p_company_id, '3000', 'EQUITY', 'EQUITY', 'CAPITAL', 'CREDIT', true, true, 1),
  (p_company_id, '3010', 'Owner Capital', 'EQUITY', 'CAPITAL', 'CREDIT', false, true, 2),
  (p_company_id, '3020', 'Retained Earnings', 'EQUITY', 'RETAINED_EARNINGS', 'CREDIT', false, true, 2),
  (p_company_id, '3030', 'Current Year Earnings', 'EQUITY', 'RETAINED_EARNINGS', 'CREDIT', false, true, 2),
  
  -- ==================== REVENUE (4000-4999) ====================
  (p_company_id, '4000', 'REVENUE', 'REVENUE', 'SALES_REVENUE', 'CREDIT', true, true, 1),
  (p_company_id, '4010', 'Sales Revenue - POS', 'REVENUE', 'SALES_REVENUE', 'CREDIT', false, true, 2),
  (p_company_id, '4020', 'Sales Revenue - Distributor', 'REVENUE', 'SALES_REVENUE', 'CREDIT', false, true, 2),
  (p_company_id, '4030', 'Sales Revenue - Marketplace', 'REVENUE', 'SALES_REVENUE', 'CREDIT', false, true, 2),
  (p_company_id, '4100', 'Sales Returns', 'REVENUE', 'SALES_REVENUE', 'DEBIT', false, true, 2),
  (p_company_id, '4200', 'Sales Discounts', 'REVENUE', 'SALES_REVENUE', 'DEBIT', false, false, 2),
  
  -- ==================== COST OF GOODS SOLD (5000-5999) ====================
  (p_company_id, '5000', 'COST OF GOODS SOLD', 'EXPENSE', 'COGS', 'DEBIT', true, true, 1),
  (p_company_id, '5010', 'COGS - POS', 'EXPENSE', 'COGS', 'DEBIT', false, true, 2),
  (p_company_id, '5020', 'COGS - Distributor', 'EXPENSE', 'COGS', 'DEBIT', false, true, 2),
  (p_company_id, '5030', 'COGS - Marketplace', 'EXPENSE', 'COGS', 'DEBIT', false, true, 2),
  
  -- ==================== OPERATING EXPENSES (6000-6999) ====================
  (p_company_id, '6000', 'OPERATING EXPENSES', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', true, true, 1),
  
  -- Production Expenses
  (p_company_id, '6010', 'Labor Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, true, 2),
  (p_company_id, '6020', 'Overhead Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, true, 2),
  (p_company_id, '6030', 'Electricity & Utilities', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  
  -- Sales & Marketing
  (p_company_id, '6100', 'Marketplace Fee Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, true, 2),
  (p_company_id, '6110', 'Shipping Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  (p_company_id, '6120', 'Marketing Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  (p_company_id, '6130', 'Packaging Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  
  -- Administrative
  (p_company_id, '6200', 'Salaries & Wages', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  (p_company_id, '6210', 'Rent Expense', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  (p_company_id, '6220', 'Office Supplies', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  (p_company_id, '6230', 'Bank Charges', 'EXPENSE', 'OPERATING_EXPENSE', 'DEBIT', false, false, 2),
  
  -- Other
  (p_company_id, '6900', 'Loss/Scrap', 'EXPENSE', 'OTHER_EXPENSE', 'DEBIT', false, true, 2),
  (p_company_id, '6910', 'Inventory Variance', 'EXPENSE', 'OTHER_EXPENSE', 'DEBIT', false, true, 2),
  (p_company_id, '6920', 'Depreciation Expense', 'EXPENSE', 'OTHER_EXPENSE', 'DEBIT', false, true, 2);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION seed_coa_template IS 'Seeds the Chart of Accounts template for konveksi industry to a specific company';

-- ==================== EXAMPLE USAGE ====================
-- To seed COA for a company:
-- SELECT seed_coa_template('company-uuid-here');


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 009_inventory_raw_material.sql
-- Description: Raw material ledger with balance tracking
-- Dependencies: 001_foundation_companies.sql, 007_master_data_materials.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE transaction_type AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT', 'TRANSFER');
CREATE TYPE reference_type AS ENUM (
  'PURCHASE', 
  'PRODUCTION', 
  'ADJUSTMENT', 
  'TRANSFER',
  'SALES_RETURN',
  'OPENING_BALANCE'
);

-- ==================== RAW MATERIAL LEDGER ====================

CREATE TABLE IF NOT EXISTS raw_material_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100),
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE 
      WHEN qty_in > 0 THEN qty_in * unit_cost
      WHEN qty_out > 0 THEN qty_out * unit_cost
      ELSE 0
    END
  ) STORED,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_posted BOOLEAN DEFAULT true,
  
  -- Business rules
  CONSTRAINT check_qty_direction CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0) OR
    (qty_in = 0 AND qty_out = 0) -- Allow zero for corrections
  ),
  CONSTRAINT check_reference CHECK (
    reference_number IS NOT NULL AND reference_number != ''
  )
);

-- Indexes for performance
CREATE INDEX idx_raw_ledger_company ON raw_material_ledger(company_id);
CREATE INDEX idx_raw_ledger_material ON raw_material_ledger(material_id);
CREATE INDEX idx_raw_ledger_warehouse ON raw_material_ledger(warehouse_id);
CREATE INDEX idx_raw_ledger_bin ON raw_material_ledger(bin_id);
CREATE INDEX idx_raw_ledger_date ON raw_material_ledger(transaction_date DESC);
CREATE INDEX idx_raw_ledger_period ON raw_material_ledger(period_id);
CREATE INDEX idx_raw_ledger_reference ON raw_material_ledger(reference_type, reference_id);
CREATE INDEX idx_raw_ledger_posted ON raw_material_ledger(is_posted) WHERE is_posted = true;

-- Composite index for balance queries
CREATE INDEX idx_raw_ledger_balance ON raw_material_ledger(
  company_id, material_id, warehouse_id, bin_id
) WHERE is_posted = true;

COMMENT ON TABLE raw_material_ledger IS 'Append-only ledger for raw material movements';
COMMENT ON COLUMN raw_material_ledger.qty_in IS 'Quantity received (receipts, adjustments up)';
COMMENT ON COLUMN raw_material_ledger.qty_out IS 'Quantity issued (production, adjustments down)';
COMMENT ON COLUMN raw_material_ledger.unit_cost IS 'Cost per unit at time of transaction (immutable)';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW raw_material_balance_mv AS
SELECT 
  company_id,
  material_id,
  warehouse_id,
  bin_id,
  SUM(qty_in) as total_qty_in,
  SUM(qty_out) as total_qty_out,
  SUM(qty_in) - SUM(qty_out) as current_qty,
  -- Weighted average cost
  CASE 
    WHEN SUM(qty_in) > 0 THEN SUM(qty_in * unit_cost) / SUM(qty_in)
    ELSE 0
  END as avg_unit_cost,
  SUM(total_cost) as total_value,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date,
  MAX(created_at) as last_movement_at
FROM raw_material_ledger
WHERE is_posted = true
GROUP BY company_id, material_id, warehouse_id, bin_id;

CREATE UNIQUE INDEX idx_raw_balance_unique ON raw_material_balance_mv(
  company_id, material_id, warehouse_id, bin_id
);

CREATE INDEX idx_raw_balance_company ON raw_material_balance_mv(company_id);
CREATE INDEX idx_raw_balance_material ON raw_material_balance_mv(material_id);
CREATE INDEX idx_raw_balance_current_qty ON raw_material_balance_mv(current_qty) WHERE current_qty > 0;

COMMENT ON MATERIALIZED VIEW raw_material_balance_mv IS 'Real-time balance snapshot of raw materials';

-- ==================== TRIGGERS ====================

-- Prevent negative stock
CREATE OR REPLACE FUNCTION check_negative_stock_raw()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty DECIMAL(15,4);
BEGIN
  -- Only check for issues (qty_out)
  IF NEW.qty_out > 0 THEN
    -- Get current balance
    SELECT COALESCE(current_qty, 0) INTO v_current_qty
    FROM raw_material_balance_mv
    WHERE company_id = NEW.company_id
      AND material_id = NEW.material_id
      AND warehouse_id = NEW.warehouse_id
      AND bin_id = NEW.bin_id;
    
    -- Check if issue would cause negative stock
    IF v_current_qty < NEW.qty_out THEN
      RAISE EXCEPTION 'Insufficient stock for material. Available: %, Requested: %', 
        v_current_qty, NEW.qty_out
        USING HINT = 'Check material balance before issuing';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_negative_stock_raw
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_negative_stock_raw();

-- Period lock enforcement
CREATE OR REPLACE FUNCTION check_period_lock_raw()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status VARCHAR(20);
BEGIN
  SELECT status INTO v_period_status
  FROM accounting_periods
  WHERE id = NEW.period_id;
  
  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'Cannot post to closed accounting period'
      USING HINT = 'Reopen the period or post to current open period';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_period_lock_raw
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MV after insert
CREATE OR REPLACE FUNCTION refresh_raw_material_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY raw_material_balance_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_raw_balance
  AFTER INSERT ON raw_material_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_raw_material_balance();

-- ==================== RLS POLICIES ====================

ALTER TABLE raw_material_ledger ENABLE ROW LEVEL SECURITY;

-- Tenant isolation
CREATE POLICY raw_ledger_tenant_isolation ON raw_material_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability (no UPDATE/DELETE)
CREATE POLICY raw_ledger_no_update ON raw_material_ledger
  FOR UPDATE
  USING (false);

CREATE POLICY raw_ledger_no_delete ON raw_material_ledger
  FOR DELETE
  USING (false);

-- Service role bypass
CREATE POLICY raw_ledger_service_role ON raw_material_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_raw_ledger
  AFTER INSERT ON raw_material_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get current balance for a material at a location
CREATE OR REPLACE FUNCTION get_raw_material_balance(
  p_company_id UUID,
  p_material_id UUID,
  p_warehouse_id UUID,
  p_bin_id UUID
)
RETURNS TABLE (
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    b.last_movement_at
  FROM raw_material_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.material_id = p_material_id
    AND b.warehouse_id = p_warehouse_id
    AND b.bin_id = p_bin_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_raw_material_balance IS 'Get current balance for a specific material at a location';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 010_inventory_wip.sql
-- Description: Work-in-Progress ledger for 3-stage manufacturing (CUT, SEW, FINISH)
-- Dependencies: 001_foundation_companies.sql, 006_master_data_products.sql, 009_inventory_raw_material.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE wip_stage AS ENUM ('CUT', 'SEW', 'FINISH');

-- ==================== WIP LEDGER ====================

CREATE TABLE IF NOT EXISTS wip_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Production reference
  production_order_id UUID, -- Will be FK to production_orders in M3
  product_id UUID REFERENCES products(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  stage wip_stage NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100) NOT NULL,
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing
  cost_material DECIMAL(15,2) DEFAULT 0, -- Material cost
  cost_labor DECIMAL(15,2) DEFAULT 0, -- Labor cost added
  cost_overhead DECIMAL(15,2) DEFAULT 0, -- Overhead cost added
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE 
      WHEN qty_in > 0 THEN qty_in * unit_cost
      WHEN qty_out > 0 THEN qty_out * unit_cost
      ELSE 0
    END
  ) STORED,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_posted BOOLEAN DEFAULT true,
  
  -- Business rules
  CONSTRAINT check_wip_qty CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0)
  )
);

-- Indexes
CREATE INDEX idx_wip_ledger_company ON wip_ledger(company_id);
CREATE INDEX idx_wip_ledger_production_order ON wip_ledger(production_order_id);
CREATE INDEX idx_wip_ledger_product ON wip_ledger(product_id);
CREATE INDEX idx_wip_ledger_warehouse ON wip_ledger(warehouse_id);
CREATE INDEX idx_wip_ledger_stage ON wip_ledger(stage);
CREATE INDEX idx_wip_ledger_date ON wip_ledger(transaction_date DESC);
CREATE INDEX idx_wip_ledger_period ON wip_ledger(period_id);
CREATE INDEX idx_wip_ledger_posted ON wip_ledger(is_posted) WHERE is_posted = true;

-- Composite for balance queries
CREATE INDEX idx_wip_ledger_balance ON wip_ledger(
  company_id, production_order_id, product_id, warehouse_id, stage
) WHERE is_posted = true;

COMMENT ON TABLE wip_ledger IS 'Work-in-Progress ledger tracking manufacturing stages';
COMMENT ON COLUMN wip_ledger.stage IS 'Manufacturing stage: CUT, SEW, or FINISH';
COMMENT ON COLUMN wip_ledger.cost_material IS 'Material cost component';
COMMENT ON COLUMN wip_ledger.cost_labor IS 'Labor cost added at this stage';
COMMENT ON COLUMN wip_ledger.cost_overhead IS 'Overhead cost added at this stage';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW wip_balance_mv AS
SELECT 
  company_id,
  production_order_id,
  product_id,
  warehouse_id,
  stage,
  SUM(qty_in) as total_qty_in,
  SUM(qty_out) as total_qty_out,
  SUM(qty_in) - SUM(qty_out) as current_qty,
  SUM(cost_material) as total_cost_material,
  SUM(cost_labor) as total_cost_labor,
  SUM(cost_overhead) as total_cost_overhead,
  SUM(total_cost) as total_value,
  -- Average cost per unit in WIP
  CASE 
    WHEN SUM(qty_in) > 0 THEN SUM(total_cost) / SUM(qty_in)
    ELSE 0
  END as avg_unit_cost,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date,
  MAX(created_at) as last_movement_at
FROM wip_ledger
WHERE is_posted = true
GROUP BY company_id, production_order_id, product_id, warehouse_id, stage;

CREATE INDEX idx_wip_balance_company ON wip_balance_mv(company_id);
CREATE INDEX idx_wip_balance_po ON wip_balance_mv(production_order_id);
CREATE INDEX idx_wip_balance_product ON wip_balance_mv(product_id);
CREATE INDEX idx_wip_balance_stage ON wip_balance_mv(stage);
CREATE INDEX idx_wip_balance_current_qty ON wip_balance_mv(current_qty) WHERE current_qty > 0;

-- Unique index for direct balance lookup
CREATE UNIQUE INDEX idx_wip_balance_unique ON wip_balance_mv(
  company_id, COALESCE(production_order_id, '00000000-0000-0000-0000-000000000000'::uuid), 
  product_id, warehouse_id, stage
);

COMMENT ON MATERIALIZED VIEW wip_balance_mv IS 'Real-time WIP balance per stage per production order';

-- ==================== TRIGGERS ====================

-- Period lock enforcement
CREATE TRIGGER trigger_period_lock_wip
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MV
CREATE OR REPLACE FUNCTION refresh_wip_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY wip_balance_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_wip_balance
  AFTER INSERT ON wip_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_wip_balance();

-- Validate stage progression (CUT → SEW → FINISH)
CREATE OR REPLACE FUNCTION validate_wip_stage_progression()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_stage wip_stage;
BEGIN
  -- Only validate for production moves
  IF NEW.reference_type = 'PRODUCTION' AND NEW.qty_in > 0 THEN
    -- Get previous stage from reference
    IF NEW.stage = 'SEW' THEN
      v_prev_stage := 'CUT';
    ELSIF NEW.stage = 'FINISH' THEN
      v_prev_stage := 'SEW';
    END IF;
    
    -- Future enhancement: Validate previous stage had stock
    -- For now, just log
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_wip_stage
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION validate_wip_stage_progression();

-- ==================== RLS POLICIES ====================

ALTER TABLE wip_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY wip_ledger_tenant_isolation ON wip_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability
CREATE POLICY wip_ledger_no_update ON wip_ledger
  FOR UPDATE USING (false);

CREATE POLICY wip_ledger_no_delete ON wip_ledger
  FOR DELETE USING (false);

-- Service role
CREATE POLICY wip_ledger_service_role ON wip_ledger
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_wip_ledger
  AFTER INSERT ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get WIP balance for a production order at a specific stage
CREATE OR REPLACE FUNCTION get_wip_balance(
  p_company_id UUID,
  p_production_order_id UUID,
  p_stage wip_stage
)
RETURNS TABLE (
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  total_cost_material DECIMAL(15,2),
  total_cost_labor DECIMAL(15,2),
  total_cost_overhead DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    b.total_cost_material,
    b.total_cost_labor,
    b.total_cost_overhead
  FROM wip_balance_mv b
  WHERE b.company_id = p_company_id
    AND COALESCE(b.production_order_id, '00000000-0000-0000-0000-000000000000'::uuid) = 
        COALESCE(p_production_order_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND b.stage = p_stage;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_wip_balance IS 'Get current WIP balance at a specific stage';

-- Detect hanging WIP (WIP that hasn't moved in X days)
CREATE OR REPLACE FUNCTION get_hanging_wip(
  p_company_id UUID,
  p_days_threshold INTEGER DEFAULT 30
)
RETURNS TABLE (
  production_order_id UUID,
  product_id UUID,
  stage wip_stage,
  current_qty DECIMAL(15,4),
  days_hanging INTEGER,
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.production_order_id,
    b.product_id,
    b.stage,
    b.current_qty,
    EXTRACT(DAY FROM NOW() - b.last_movement_at)::INTEGER as days_hanging,
    b.last_movement_at
  FROM wip_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
    AND b.last_movement_at < NOW() - INTERVAL '1 day' * p_days_threshold
  ORDER BY b.last_movement_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_hanging_wip IS 'Detect WIP that has not moved for specified days (alerts for stalled production)';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 011_inventory_finished_goods.sql
-- Description: Finished Goods ledger with SKU-level tracking
-- Dependencies: 001_foundation_companies.sql, 006_master_data_products.sql, 010_inventory_wip.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== FINISHED GOODS LEDGER ====================

CREATE TABLE IF NOT EXISTS finished_goods_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Product reference (SKU level)
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type reference_type NOT NULL,
  reference_id UUID,
  reference_number VARCHAR(100) NOT NULL,
  
  -- Quantities
  qty_in DECIMAL(15,4) DEFAULT 0 CHECK (qty_in >= 0),
  qty_out DECIMAL(15,4) DEFAULT 0 CHECK (qty_out >= 0),
  
  -- Costing (FIFO or Weighted Average)
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE 
      WHEN qty_in > 0 THEN qty_in * unit_cost
      WHEN qty_out > 0 THEN qty_out * unit_cost
      ELSE 0
    END
  ) STORED,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  is_posted BOOLEAN DEFAULT true,
  
  -- Business rules
  CONSTRAINT check_fg_qty CHECK (
    (qty_in > 0 AND qty_out = 0) OR 
    (qty_out > 0 AND qty_in = 0)
  )
);

-- Indexes
CREATE INDEX idx_fg_ledger_company ON finished_goods_ledger(company_id);
CREATE INDEX idx_fg_ledger_variant ON finished_goods_ledger(product_variant_id);
CREATE INDEX idx_fg_ledger_warehouse ON finished_goods_ledger(warehouse_id);
CREATE INDEX idx_fg_ledger_bin ON finished_goods_ledger(bin_id);
CREATE INDEX idx_fg_ledger_date ON finished_goods_ledger(transaction_date DESC);
CREATE INDEX idx_fg_ledger_period ON finished_goods_ledger(period_id);
CREATE INDEX idx_fg_ledger_reference ON finished_goods_ledger(reference_type, reference_id);
CREATE INDEX idx_fg_ledger_posted ON finished_goods_ledger(is_posted) WHERE is_posted = true;

-- Composite for balance queries
CREATE INDEX idx_fg_ledger_balance ON finished_goods_ledger(
  company_id, product_variant_id, warehouse_id, bin_id
) WHERE is_posted = true;

COMMENT ON TABLE finished_goods_ledger IS 'Append-only ledger for finished goods (SKU-level)';
COMMENT ON COLUMN finished_goods_ledger.product_variant_id IS 'SKU (size + color combination)';
COMMENT ON COLUMN finished_goods_ledger.unit_cost IS 'Cost per unit from production or purchase';

-- ==================== BALANCE MATERIALIZED VIEW ====================

CREATE MATERIALIZED VIEW finished_goods_balance_mv AS
SELECT 
  company_id,
  product_variant_id,
  warehouse_id,
  bin_id,
  SUM(qty_in) as total_qty_in,
  SUM(qty_out) as total_qty_out,
  SUM(qty_in) - SUM(qty_out) as current_qty,
  -- Weighted average cost
  CASE 
    WHEN SUM(qty_in) > 0 THEN SUM(qty_in * unit_cost) / SUM(qty_in)
    ELSE 0
  END as avg_unit_cost,
  SUM(total_cost) as total_value,
  COUNT(*) as transaction_count,
  MAX(transaction_date) as last_transaction_date,
  MAX(created_at) as last_movement_at
FROM finished_goods_ledger
WHERE is_posted = true
GROUP BY company_id, product_variant_id, warehouse_id, bin_id;

-- Indexes for MV
CREATE UNIQUE INDEX idx_fg_balance_unique ON finished_goods_balance_mv(
  company_id, product_variant_id, warehouse_id, bin_id
);

CREATE INDEX idx_fg_balance_company ON finished_goods_balance_mv(company_id);
CREATE INDEX idx_fg_balance_variant ON finished_goods_balance_mv(product_variant_id);
CREATE INDEX idx_fg_balance_warehouse ON finished_goods_balance_mv(warehouse_id);
CREATE INDEX idx_fg_balance_current_qty ON finished_goods_balance_mv(current_qty) WHERE current_qty > 0;

-- Summary view (company-wide, all warehouses)
CREATE MATERIALIZED VIEW finished_goods_summary_mv AS
SELECT 
  company_id,
  product_variant_id,
  SUM(current_qty) as total_current_qty,
  AVG(avg_unit_cost) as overall_avg_cost,
  SUM(total_value) as total_value,
  COUNT(DISTINCT warehouse_id) as warehouse_count,
  MAX(last_movement_at) as last_movement_at
FROM finished_goods_balance_mv
WHERE current_qty > 0
GROUP BY company_id, product_variant_id;

CREATE UNIQUE INDEX idx_fg_summary_unique ON finished_goods_summary_mv(company_id, product_variant_id);

COMMENT ON MATERIALIZED VIEW finished_goods_balance_mv IS 'Real-time FG balance per SKU per location';
COMMENT ON MATERIALIZED VIEW finished_goods_summary_mv IS 'Company-wide FG summary (all warehouses aggregated)';

-- ==================== TRIGGERS ====================

-- Prevent negative stock
CREATE OR REPLACE FUNCTION check_negative_stock_fg()
RETURNS TRIGGER AS $$
DECLARE
  v_current_qty DECIMAL(15,4);
BEGIN
  IF NEW.qty_out > 0 THEN
    SELECT COALESCE(current_qty, 0) INTO v_current_qty
    FROM finished_goods_balance_mv
    WHERE company_id = NEW.company_id
      AND product_variant_id = NEW.product_variant_id
      AND warehouse_id = NEW.warehouse_id
      AND bin_id = NEW.bin_id;
    
    IF v_current_qty < NEW.qty_out THEN
      RAISE EXCEPTION 'Insufficient finished goods stock. Available: %, Requested: %', 
        v_current_qty, NEW.qty_out
        USING HINT = 'Check SKU balance before issuing';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_negative_stock_fg
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_negative_stock_fg();

-- Period lock enforcement
CREATE TRIGGER trigger_period_lock_fg
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW
  WHEN (NEW.is_posted = true)
  EXECUTE FUNCTION check_period_lock_raw();

-- Auto-refresh MVs
CREATE OR REPLACE FUNCTION refresh_fg_balance()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY finished_goods_balance_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY finished_goods_summary_mv;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_fg_balance
  AFTER INSERT ON finished_goods_ledger
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_fg_balance();

-- ==================== RLS POLICIES ====================

ALTER TABLE finished_goods_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY fg_ledger_tenant_isolation ON finished_goods_ledger
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Immutability
CREATE POLICY fg_ledger_no_update ON finished_goods_ledger
  FOR UPDATE USING (false);

CREATE POLICY fg_ledger_no_delete ON finished_goods_ledger
  FOR DELETE USING (false);

-- Service role
CREATE POLICY fg_ledger_service_role ON finished_goods_ledger
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_fg_ledger
  AFTER INSERT ON finished_goods_ledger
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER FUNCTIONS ====================

-- Get FG balance for a SKU at a location
CREATE OR REPLACE FUNCTION get_fg_balance(
  p_company_id UUID,
  p_variant_id UUID,
  p_warehouse_id UUID,
  p_bin_id UUID
)
RETURNS TABLE (
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    b.last_movement_at
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.product_variant_id = p_variant_id
    AND b.warehouse_id = p_warehouse_id
    AND b.bin_id = p_bin_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get FG balance across all warehouses (for multi-channel sales)
CREATE OR REPLACE FUNCTION get_fg_total_available(
  p_company_id UUID,
  p_variant_id UUID
)
RETURNS DECIMAL(15,4) AS $$
DECLARE
  v_total_qty DECIMAL(15,4);
BEGIN
  SELECT COALESCE(total_current_qty, 0) INTO v_total_qty
  FROM finished_goods_summary_mv
  WHERE company_id = p_company_id
    AND product_variant_id = p_variant_id;
  
  RETURN v_total_qty;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fg_total_available IS 'Get total available FG across all warehouses (prevents overselling in multi-channel)';

-- Get slow-moving inventory (hasn't moved in X days)
CREATE OR REPLACE FUNCTION get_slow_moving_fg(
  p_company_id UUID,
  p_days_threshold INTEGER DEFAULT 90
)
RETURNS TABLE (
  product_variant_id UUID,
  warehouse_id UUID,
  bin_id UUID,
  current_qty DECIMAL(15,4),
  avg_unit_cost DECIMAL(15,2),
  total_value DECIMAL(15,2),
  days_stagnant INTEGER,
  last_movement_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.product_variant_id,
    b.warehouse_id,
    b.bin_id,
    b.current_qty,
    b.avg_unit_cost,
    b.total_value,
    EXTRACT(DAY FROM NOW() - b.last_movement_at)::INTEGER as days_stagnant,
    b.last_movement_at
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
    AND b.last_movement_at < NOW() - INTERVAL '1 day' * p_days_threshold
  ORDER BY b.last_movement_at;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_slow_moving_fg IS 'Identify slow-moving or dead stock (for promotions or write-offs)';

-- Get inventory aging buckets
CREATE OR REPLACE FUNCTION get_fg_aging(
  p_company_id UUID
)
RETURNS TABLE (
  aging_bucket VARCHAR(20),
  total_qty DECIMAL(15,4),
  total_value DECIMAL(15,2),
  sku_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 30 THEN '0-30 days'
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 60 THEN '31-60 days'
      WHEN EXTRACT(DAY FROM NOW() - b.last_movement_at) <= 90 THEN '61-90 days'
      ELSE '90+ days'
    END as aging_bucket,
    SUM(b.current_qty) as total_qty,
    SUM(b.total_value) as total_value,
    COUNT(*) as sku_count
  FROM finished_goods_balance_mv b
  WHERE b.company_id = p_company_id
    AND b.current_qty > 0
  GROUP BY aging_bucket
  ORDER BY 
    CASE aging_bucket
      WHEN '0-30 days' THEN 1
      WHEN '31-60 days' THEN 2
      WHEN '61-90 days' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_fg_aging IS 'Inventory aging analysis for cash flow and discount planning';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 012_inventory_adjustments.sql
-- Description: Stock opname, inventory adjustments, and internal transfers
-- Dependencies: 009-011 (Inventory ledgers)
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE adjustment_reason AS ENUM (
  'DAMAGED',
  'EXPIRED',
  'LOST',
  'FOUND',
  'COUNTING_ERROR',
  'QUALITY_ISSUE',
  'SHRINKAGE',
  'OTHER'
);

CREATE TYPE opname_status AS ENUM ('draft', 'counting', 'completed', 'posted');
CREATE TYPE adjustment_status AS ENUM ('draft', 'approved', 'posted', 'cancelled');
CREATE TYPE transfer_status AS ENUM ('draft', 'in_transit', 'completed', 'cancelled');

-- ==================== STOCK OPNAME (PHYSICAL COUNT) ====================

CREATE TABLE IF NOT EXISTS stock_opname (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  opname_number VARCHAR(50) UNIQUE NOT NULL,
  opname_date DATE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  status opname_status DEFAULT 'draft',
  
  -- Lifecycle tracking
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_opname_company ON stock_opname(company_id);
CREATE INDEX idx_opname_warehouse ON stock_opname(warehouse_id);
CREATE INDEX idx_opname_status ON stock_opname(status);
CREATE INDEX idx_opname_date ON stock_opname(opname_date DESC);

COMMENT ON TABLE stock_opname IS 'Physical inventory count header';

CREATE TABLE IF NOT EXISTS stock_opname_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opname_id UUID REFERENCES stock_opname(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference (either material OR product variant)
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  -- System balance (from MV)
  system_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
  system_unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  system_value DECIMAL(15,2) GENERATED ALWAYS AS (system_qty * system_unit_cost) STORED,
  
  -- Physical count
  physical_qty DECIMAL(15,4) DEFAULT 0,
  physical_value DECIMAL(15,2) GENERATED ALWAYS AS (physical_qty * system_unit_cost) STORED,
  
  -- Variance (auto-calculated)
  variance_qty DECIMAL(15,4) GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
  variance_value DECIMAL(15,2) GENERATED ALWAYS AS (
    (physical_qty - system_qty) * system_unit_cost
  ) STORED,
  
  -- Audit
  reason_code adjustment_reason,
  notes TEXT,
  counted_by UUID REFERENCES auth.users(id),
  counted_at TIMESTAMPTZ,
  
  CONSTRAINT check_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_opname_lines_opname ON stock_opname_lines(opname_id);
CREATE INDEX idx_opname_lines_material ON stock_opname_lines(material_id);
CREATE INDEX idx_opname_lines_variant ON stock_opname_lines(product_variant_id);
CREATE INDEX idx_opname_lines_variance ON stock_opname_lines(variance_qty) WHERE variance_qty != 0;

COMMENT ON TABLE stock_opname_lines IS 'Physical count details with variance calculation';

-- ==================== INVENTORY ADJUSTMENTS ====================

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  adjustment_number VARCHAR(50) UNIQUE NOT NULL,
  adjustment_date DATE NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  adjustment_type VARCHAR(10) NOT NULL CHECK (adjustment_type IN ('IN', 'OUT')),
  reason adjustment_reason NOT NULL,
  
  -- Reference to source (e.g., stock opname)
  reference_type VARCHAR(50),
  reference_id UUID,
  
  status adjustment_status DEFAULT 'draft',
  
  -- Approval (for large adjustments)
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_adj_company ON inventory_adjustments(company_id);
CREATE INDEX idx_adj_warehouse ON inventory_adjustments(warehouse_id);
CREATE INDEX idx_adj_status ON inventory_adjustments(status);
CREATE INDEX idx_adj_date ON inventory_adjustments(adjustment_date DESC);
CREATE INDEX idx_adj_reference ON inventory_adjustments(reference_type, reference_id);

COMMENT ON TABLE inventory_adjustments IS 'Inventory adjustment header (IN/OUT)';

CREATE TABLE IF NOT EXISTS inventory_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID REFERENCES inventory_adjustments(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  total_value DECIMAL(15,2) GENERATED ALWAYS AS (qty * unit_cost) STORED,
  
  reason_code adjustment_reason,
  notes TEXT,
  
  CONSTRAINT check_adj_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_adj_lines_adjustment ON inventory_adjustment_lines(adjustment_id);
CREATE INDEX idx_adj_lines_material ON inventory_adjustment_lines(material_id);
CREATE INDEX idx_adj_lines_variant ON inventory_adjustment_lines(product_variant_id);

COMMENT ON TABLE inventory_adjustment_lines IS 'Adjustment line items';

-- ==================== INTERNAL TRANSFERS ====================

CREATE TABLE IF NOT EXISTS internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  transfer_date DATE NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- From location
  from_warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  from_bin_id UUID REFERENCES bins(id) NOT NULL,
  
  -- To location
  to_warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  to_bin_id UUID REFERENCES bins(id) NOT NULL,
  
  status transfer_status DEFAULT 'draft',
  
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT check_different_locations CHECK (
    from_warehouse_id != to_warehouse_id OR from_bin_id != to_bin_id
  )
);

CREATE INDEX idx_transfer_company ON internal_transfers(company_id);
CREATE INDEX idx_transfer_from_wh ON internal_transfers(from_warehouse_id);
CREATE INDEX idx_transfer_to_wh ON internal_transfers(to_warehouse_id);
CREATE INDEX idx_transfer_status ON internal_transfers(status);
CREATE INDEX idx_transfer_date ON internal_transfers(transfer_date DESC);

COMMENT ON TABLE internal_transfers IS 'Internal transfers between bins/warehouses';

CREATE TABLE IF NOT EXISTS internal_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES internal_transfers(id) ON DELETE CASCADE NOT NULL,
  
  -- Item reference
  material_id UUID REFERENCES materials(id),
  product_variant_id UUID REFERENCES product_variants(id),
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  
  notes TEXT,
  
  CONSTRAINT check_transfer_item_type CHECK (
    (material_id IS NOT NULL AND product_variant_id IS NULL) OR
    (material_id IS NULL AND product_variant_id IS NOT NULL)
  )
);

CREATE INDEX idx_transfer_lines_transfer ON internal_transfer_lines(transfer_id);
CREATE INDEX idx_transfer_lines_material ON internal_transfer_lines(material_id);
CREATE INDEX idx_transfer_lines_variant ON internal_transfer_lines(product_variant_id);

-- ==================== TRIGGERS ====================

-- Auto-check if adjustment requires approval (large variance)
CREATE OR REPLACE FUNCTION check_adjustment_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_total_value DECIMAL(15,2);
BEGIN
  -- Calculate total adjustment value
  SELECT SUM(total_value) INTO v_total_value
  FROM inventory_adjustment_lines
  WHERE adjustment_id = NEW.id;
  
  -- Require approval if total > 1M IDR
  IF v_total_value > 1000000 THEN
    NEW.requires_approval := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_adjustment_approval
  BEFORE UPDATE OF status ON inventory_adjustments
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION check_adjustment_approval();

-- Prevent posting without approval if required
CREATE OR REPLACE FUNCTION validate_adjustment_posting()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.requires_approval AND NEW.approved_by IS NULL THEN
    RAISE EXCEPTION 'Adjustment requires approval before posting';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_adjustment_posting
  BEFORE UPDATE OF status ON inventory_adjustments
  FOR EACH ROW
  WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION validate_adjustment_posting();

-- ==================== RLS POLICIES ====================

ALTER TABLE stock_opname ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfer_lines ENABLE ROW LEVEL SECURITY;

-- Tenant isolation (all tables)
CREATE POLICY opname_tenant_isolation ON stock_opname
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY opname_lines_tenant ON stock_opname_lines
  FOR ALL USING (opname_id IN (
    SELECT id FROM stock_opname WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY adj_tenant_isolation ON inventory_adjustments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY adj_lines_tenant ON inventory_adjustment_lines
  FOR ALL USING (adjustment_id IN (
    SELECT id FROM inventory_adjustments WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY transfer_tenant_isolation ON internal_transfers
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY transfer_lines_tenant ON internal_transfer_lines
  FOR ALL USING (transfer_id IN (
    SELECT id FROM internal_transfers WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Service role bypass
CREATE POLICY opname_service_role ON stock_opname FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY opname_lines_service_role ON stock_opname_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY adj_service_role ON inventory_adjustments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY adj_lines_service_role ON inventory_adjustment_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY transfer_service_role ON internal_transfers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY transfer_lines_service_role ON internal_transfer_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_opname
  AFTER INSERT OR UPDATE OR DELETE ON stock_opname
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON inventory_adjustments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_transfers
  AFTER INSERT OR UPDATE OR DELETE ON internal_transfers
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 013_purchase_orders.sql
-- Description: Purchase order management
-- Dependencies: 007_master_data_materials.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE po_status AS ENUM ('draft', 'submitted', 'approved', 'partial', 'closed', 'cancelled');

-- ==================== PURCHASE ORDERS ====================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) DEFAULT 1,
  
  -- Totals
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  
  status po_status DEFAULT 'draft',
  
  -- Delivery
  delivery_date DATE,
  delivery_address TEXT,
  
  -- Terms
  payment_terms payment_terms,
  custom_payment_days INTEGER,
  
  notes TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_po_company ON purchase_orders(company_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_date ON purchase_orders(po_date DESC);
CREATE INDEX idx_po_number ON purchase_orders(po_number);

COMMENT ON TABLE purchase_orders IS 'Purchase order header';

-- ==================== PURCHASE ORDER LINES ====================

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  material_id UUID REFERENCES materials(id) NOT NULL,
  description TEXT,
  
  -- Quantities
  qty_ordered DECIMAL(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_received DECIMAL(15,4) DEFAULT 0 CHECK (qty_received >= 0),
  qty_invoiced DECIMAL(15,4) DEFAULT 0 CHECK (qty_invoiced >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_ordered - qty_received) STORED,
  
  -- Pricing
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
  
  notes TEXT,
  
  UNIQUE(po_id, line_number),
  CONSTRAINT check_received_qty CHECK (qty_received <= qty_ordered * 1.05), -- 5% over-receipt tolerance
  CONSTRAINT check_invoiced_qty CHECK (qty_invoiced <= qty_received)
);

CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
CREATE INDEX idx_po_lines_material ON purchase_order_lines(material_id);
CREATE INDEX idx_po_lines_outstanding ON purchase_order_lines(qty_outstanding) WHERE qty_outstanding > 0;

COMMENT ON TABLE purchase_order_lines IS 'Purchase order line items';

-- ==================== TRIGGERS ====================

-- Auto-update PO subtotal when lines change
CREATE OR REPLACE FUNCTION update_po_total()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
BEGIN
  -- Get PO ID from either NEW or OLD
  v_po_id := COALESCE(NEW.po_id, OLD.po_id);
  
  -- Update subtotal
  UPDATE purchase_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_lines
    WHERE po_id = v_po_id
  )
  WHERE id = v_po_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_total_insert
  AFTER INSERT ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

CREATE TRIGGER trigger_update_po_total_update
  AFTER UPDATE ON purchase_order_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_po_total();

CREATE TRIGGER trigger_update_po_total_delete
  AFTER DELETE ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

-- Auto-update PO status based on receipt/invoice status
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_total_ordered DECIMAL(15,4);
  v_total_received DECIMAL(15,4);
  v_total_invoiced DECIMAL(15,4);
  v_current_status po_status;
BEGIN
  v_po_id := COALESCE(NEW.po_id, OLD.po_id);
  
  -- Get current status
  SELECT status INTO v_current_status
  FROM purchase_orders
  WHERE id = v_po_id;
  
  -- Don't update if already closed or cancelled
  IF v_current_status IN ('closed', 'cancelled') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get totals
  SELECT 
    SUM(qty_ordered),
    SUM(qty_received),
    SUM(qty_invoiced)
  INTO v_total_ordered, v_total_received, v_total_invoiced
  FROM purchase_order_lines
  WHERE po_id = v_po_id;
  
  -- Update status
  UPDATE purchase_orders
  SET status = CASE
    WHEN v_total_invoiced >= v_total_ordered THEN 'closed'
    WHEN v_total_received > 0 THEN 'partial'
    ELSE status
  END
  WHERE id = v_po_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_status
  AFTER UPDATE OF qty_received, qty_invoiced ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status();

-- ==================== RLS POLICIES ====================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_tenant_isolation ON purchase_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY po_lines_tenant ON purchase_order_lines
  FOR ALL USING (po_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Service role bypass
CREATE POLICY po_service_role ON purchase_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY po_lines_service_role ON purchase_order_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_po
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER VIEWS ====================

-- Outstanding POs
CREATE VIEW outstanding_po_vw AS
SELECT 
  po.id,
  po.company_id,
  po.po_number,
  po.po_date,
  v.code as vendor_code,
  v.name as vendor_name,
  pol.material_id,
  m.code as material_code,
  m.name as material_name,
  pol.qty_outstanding,
  pol.unit_price,
  pol.qty_outstanding * pol.unit_price as value_outstanding
FROM purchase_orders po
JOIN purchase_order_lines pol ON pol.po_id = po.id
JOIN vendors v ON v.id = po.vendor_id
JOIN materials m ON m.id = pol.material_id
WHERE po.status NOT IN ('closed', 'cancelled')
  AND pol.qty_outstanding > 0;

COMMENT ON VIEW outstanding_po_vw IS 'Outstanding purchase orders (not fully received)';


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 014_goods_receipt_notes.sql
-- Description: Goods Receipt Notes (GRN) with inventory integration
-- Dependencies: 009_inventory_raw_material.sql, 013_purchase_orders.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE grn_status AS ENUM ('draft', 'posted', 'cancelled');

-- ==================== GOODS RECEIPT NOTES ====================

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  grn_date DATE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  status grn_status DEFAULT 'draft',
  
  -- Reference
  delivery_note_number VARCHAR(100),
  vehicle_number VARCHAR(50),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_grn_company ON goods_receipt_notes(company_id);
CREATE INDEX idx_grn_po ON goods_receipt_notes(po_id);
CREATE INDEX idx_grn_vendor ON goods_receipt_notes(vendor_id);
CREATE INDEX idx_grn_status ON goods_receipt_notes(status);
CREATE INDEX idx_grn_date ON goods_receipt_notes(grn_date DESC);

COMMENT ON TABLE goods_receipt_notes IS 'Goods Receipt Notes (receiving documentation)';

-- ==================== GRN LINES ====================

CREATE TABLE IF NOT EXISTS grn_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES goods_receipt_notes(id) ON DELETE CASCADE NOT NULL,
  po_line_id UUID REFERENCES purchase_order_lines(id),
  material_id UUID REFERENCES materials(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  qty_received DECIMAL(15,4) NOT NULL CHECK (qty_received > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_received * unit_cost) STORED,
  
  -- Quality check
  qty_accepted DECIMAL(15,4),
  qty_rejected DECIMAL(15,4),
  
  notes TEXT
);

CREATE INDEX idx_grn_lines_grn ON grn_lines(grn_id);
CREATE INDEX idx_grn_lines_po_line ON grn_lines(po_line_id);
CREATE INDEX idx_grn_lines_material ON grn_lines(material_id);

COMMENT ON TABLE grn_lines IS 'GRN line items';

-- ==================== POSTING LOGIC ====================

-- Function to post GRN (create inventory ledger + journal entries)
CREATE OR REPLACE FUNCTION post_grn(p_grn_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_grn RECORD;
  v_line RECORD;
BEGIN
  -- Get GRN header
  SELECT * INTO v_grn
  FROM goods_receipt_notes
  WHERE id = p_grn_id;
  
  IF v_grn.status = 'posted' THEN
    RAISE EXCEPTION 'GRN already posted';
  END IF;
  
  -- Post each line to raw material ledger
  FOR v_line IN 
    SELECT * FROM grn_lines WHERE grn_id = p_grn_id
  LOOP
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
      v_grn.company_id,
      v_line.material_id,
      v_grn.warehouse_id,
      v_line.bin_id,
      v_grn.period_id,
      v_grn.grn_date,
      'RECEIPT',
      'PURCHASE',
      v_grn.id,
      v_grn.grn_number,
      v_line.qty_received,
      0,
      v_line.unit_cost,
      p_user_id,
      true
    );
    
    -- Update PO line qty_received
    IF v_line.po_line_id IS NOT NULL THEN
      UPDATE purchase_order_lines
      SET qty_received = qty_received + v_line.qty_received
      WHERE id = v_line.po_line_id;
    END IF;
  END LOOP;
  
  -- Update GRN status
  UPDATE goods_receipt_notes
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_grn_id;
  
  -- TODO: Create journal entry (Dr. Inventory, Cr. GRN/IR Clearing)
  -- Will implement when GL module is added
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_grn IS 'Post GRN to inventory ledger and update PO quantities';

-- ==================== RLS POLICIES ====================

ALTER TABLE goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_tenant_isolation ON goods_receipt_notes
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY grn_lines_tenant ON grn_lines
  FOR ALL USING (grn_id IN (
    SELECT id FROM goods_receipt_notes WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY grn_service_role ON goods_receipt_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY grn_lines_service_role ON grn_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_grn
  AFTER INSERT OR UPDATE OR DELETE ON goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 015_vendor_invoices.sql
-- Description: Vendor invoices with 3-way matching
-- Dependencies: 013_purchase_orders.sql, 014_goods_receipt_notes.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE invoice_status AS ENUM ('draft', 'posted', 'partial_paid', 'paid', 'cancelled');

-- ==================== VENDOR INVOICES ====================

CREATE TABLE IF NOT EXISTS vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) DEFAULT 1,
  
  -- Totals
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  
  -- Payment tracking
  amount_paid DECIMAL(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_outstanding DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount - amount_paid) STORED,
  
  status invoice_status DEFAULT 'draft',
  
  payment_terms payment_terms,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, vendor_id, invoice_number)
);

CREATE INDEX idx_invoice_company ON vendor_invoices(company_id);
CREATE INDEX idx_invoice_vendor ON vendor_invoices(vendor_id);
CREATE INDEX idx_invoice_po ON vendor_invoices(po_id);
CREATE INDEX idx_invoice_status ON vendor_invoices(status);
CREATE INDEX idx_invoice_date ON vendor_invoices(invoice_date DESC);
CREATE INDEX idx_invoice_due_date ON vendor_invoices(due_date);
CREATE INDEX idx_invoice_outstanding ON vendor_invoices(amount_outstanding) WHERE amount_outstanding > 0;

COMMENT ON TABLE vendor_invoices IS 'Vendor invoices (AP)';

-- ==================== VENDOR INVOICE LINES ====================

CREATE TABLE IF NOT EXISTS vendor_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES vendor_invoices(id) ON DELETE CASCADE NOT NULL,
  grn_line_id UUID REFERENCES grn_lines(id),
  po_line_id UUID REFERENCES purchase_order_lines(id),
  material_id UUID REFERENCES materials(id) NOT NULL,
  
  qty_invoiced DECIMAL(15,4) NOT NULL CHECK (qty_invoiced > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_invoiced * unit_price) STORED,
  
  -- Price variance detection
  po_unit_price DECIMAL(15,2),
  price_variance DECIMAL(15,2) GENERATED ALWAYS AS (
    (unit_price - COALESCE(po_unit_price, 0)) * qty_invoiced
  ) STORED,
  variance_approved BOOLEAN DEFAULT false,
  
  notes TEXT
);

CREATE INDEX idx_invoice_lines_invoice ON vendor_invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_grn ON vendor_invoice_lines(grn_line_id);
CREATE INDEX idx_invoice_lines_po_line ON vendor_invoice_lines(po_line_id);
CREATE INDEX idx_invoice_lines_variance ON vendor_invoice_lines(price_variance) WHERE ABS(price_variance) > 0;

COMMENT ON TABLE vendor_invoice_lines IS 'Invoice line items with variance tracking';

-- ==================== TRIGGERS ====================

-- Auto-update invoice subtotal
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE vendor_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM vendor_invoice_lines
    WHERE invoice_id = v_invoice_id
  )
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_total_insert
  AFTER INSERT ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_update
  AFTER UPDATE ON vendor_invoice_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_delete
  AFTER DELETE ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- Validate 3-way matching
CREATE OR REPLACE FUNCTION validate_3way_match()
RETURNS TRIGGER AS $$
DECLARE
  v_grn_qty DECIMAL(15,4);
  v_po_price DECIMAL(15,2);
  v_variance_pct DECIMAL(5,2);
BEGIN
  -- Check GRN quantity
  IF NEW.grn_line_id IS NOT NULL THEN
    SELECT qty_received INTO v_grn_qty
    FROM grn_lines
    WHERE id = NEW.grn_line_id;
    
    IF NEW.qty_invoiced > v_grn_qty THEN
      RAISE EXCEPTION 'Invoice quantity (%) exceeds GRN quantity (%)', 
        NEW.qty_invoiced, v_grn_qty;
    END IF;
  END IF;
  
  -- Check price variance (if PO exists)
  IF NEW.po_line_id IS NOT NULL THEN
    SELECT unit_price INTO v_po_price
    FROM purchase_order_lines
    WHERE id = NEW.po_line_id;
    
    NEW.po_unit_price := v_po_price;
    
    -- Calculate variance percentage
    IF v_po_price > 0 THEN
      v_variance_pct := ABS((NEW.unit_price - v_po_price) / v_po_price * 100);
      
      -- Require approval if variance > 5%
      IF v_variance_pct > 5 AND NOT NEW.variance_approved THEN
        RAISE EXCEPTION 'Price variance (%.2f%%) exceeds tolerance (5%%). Approval required.', 
          v_variance_pct;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_3way_match
  BEFORE INSERT OR UPDATE ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_3way_match();

-- Update PO qty_invoiced
CREATE OR REPLACE FUNCTION update_po_qty_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_line_id IS NOT NULL THEN
    UPDATE purchase_order_lines
    SET qty_invoiced = qty_invoiced + NEW.qty_invoiced
    WHERE id = NEW.po_line_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_qty_invoiced
  AFTER INSERT ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_qty_invoiced();

-- ==================== RLS POLICIES ====================

ALTER TABLE vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_tenant_isolation ON vendor_invoices
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY invoice_lines_tenant ON vendor_invoice_lines
  FOR ALL USING (invoice_id IN (
    SELECT id FROM vendor_invoices WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY invoice_service_role ON vendor_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY invoice_lines_service_role ON vendor_invoice_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== VIEWS ====================

-- AP Aging
CREATE VIEW ap_aging_vw AS
SELECT 
  vi.company_id,
  vi.vendor_id,
  v.code as vendor_code,
  v.name as vendor_name,
  vi.id as invoice_id,
  vi.invoice_number,
  vi.invoice_date,
  vi.due_date,
  vi.total_amount,
  vi.amount_paid,
  vi.amount_outstanding,
  
  CASE 
    WHEN CURRENT_DATE <= vi.due_date THEN 'current'
    WHEN CURRENT_DATE - vi.due_date <= 30 THEN '1-30 days'
    WHEN CURRENT_DATE - vi.due_date <= 60 THEN '31-60 days'
    WHEN CURRENT_DATE - vi.due_date <= 90 THEN '61-90 days'
    ELSE 'over 90 days'
  END as aging_bucket,
  
  CURRENT_DATE - vi.due_date as days_overdue
  
FROM vendor_invoices vi
JOIN vendors v ON v.id = vi.vendor_id
WHERE vi.status IN ('posted', 'partial_paid')
  AND vi.amount_outstanding > 0;

COMMENT ON VIEW ap_aging_vw IS 'Accounts Payable aging analysis';

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON vendor_invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 016_vendor_payments.sql
-- Description: Vendor payment tracking with invoice allocation
-- Dependencies: 015_vendor_invoices.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'GIRO', 'CREDIT_CARD');
CREATE TYPE payment_status AS ENUM ('draft', 'posted', 'cancelled', 'cleared');

-- ==================== VENDOR PAYMENTS ====================

CREATE TABLE IF NOT EXISTS vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  payment_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  payment_method payment_method NOT NULL,
  bank_account_id UUID, -- FK to chart_of_accounts (cash/bank accounts)
  reference_number VARCHAR(100), -- Check number, transfer reference, etc
  
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
  
  status payment_status DEFAULT 'draft',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payment_company ON vendor_payments(company_id);
CREATE INDEX idx_payment_vendor ON vendor_payments(vendor_id);
CREATE INDEX idx_payment_status ON vendor_payments(status);
CREATE INDEX idx_payment_date ON vendor_payments(payment_date DESC);
CREATE INDEX idx_payment_method ON vendor_payments(payment_method);

COMMENT ON TABLE vendor_payments IS 'Vendor payment header';

-- ==================== PAYMENT ALLOCATIONS ====================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES vendor_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES vendor_invoices(id) NOT NULL,
  
  amount_allocated DECIMAL(15,2) NOT NULL CHECK (amount_allocated > 0),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_allocation_payment ON payment_allocations(payment_id);
CREATE INDEX idx_allocation_invoice ON payment_allocations(invoice_id);

COMMENT ON TABLE payment_allocations IS 'Payment allocation to invoices (many-to-many)';

-- ==================== TRIGGERS ====================

-- Validate allocation amount
CREATE OR REPLACE FUNCTION validate_payment_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_outstanding DECIMAL(15,2);
  v_total_allocated DECIMAL(15,2);
  v_payment_total DECIMAL(15,2);
BEGIN
  -- Check invoice outstanding
  SELECT amount_outstanding INTO v_invoice_outstanding
  FROM vendor_invoices
  WHERE id = NEW.invoice_id;
  
  -- Get total already allocated to this invoice
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE invoice_id = NEW.invoice_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Check if new allocation exceeds outstanding
  IF v_total_allocated + NEW.amount_allocated > v_invoice_outstanding THEN
    RAISE EXCEPTION 'Allocation (%) exceeds invoice outstanding (%)', 
      NEW.amount_allocated, v_invoice_outstanding - v_total_allocated;
  END IF;
  
  -- Check if total allocations exceed payment amount
  SELECT total_amount INTO v_payment_total
  FROM vendor_payments
  WHERE id = NEW.payment_id;
  
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE payment_id = NEW.payment_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF v_total_allocated + NEW.amount_allocated > v_payment_total THEN
    RAISE EXCEPTION 'Total allocations (%) exceed payment amount (%)', 
      v_total_allocated + NEW.amount_allocated, v_payment_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_payment_allocation
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_allocation();

-- Update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid DECIMAL(15,2);
  v_total_amount DECIMAL(15,2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_paid
  FROM payment_allocations
  WHERE invoice_id = v_invoice_id;
  
  -- Get invoice total
  SELECT subtotal + tax_amount INTO v_total_amount
  FROM vendor_invoices
  WHERE id = v_invoice_id;
  
  -- Update invoice
  UPDATE vendor_invoices
  SET 
    amount_paid = v_total_paid,
    status = CASE
      WHEN v_total_paid >= v_total_amount THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial_paid'
      ELSE status
    END
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_payment_insert
  AFTER INSERT ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

CREATE TRIGGER trigger_update_invoice_payment_delete
  AFTER DELETE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- ==================== RLS POLICIES ====================

ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_tenant_isolation ON vendor_payments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY allocation_tenant ON payment_allocations
  FOR ALL USING (payment_id IN (
    SELECT id FROM vendor_payments WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY payment_service_role ON vendor_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allocation_service_role ON payment_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== VIEWS ====================

-- Payment summary
CREATE VIEW payment_summary_vw AS
SELECT 
  vp.id,
  vp.company_id,
  vp.payment_number,
  vp.payment_date,
  v.code as vendor_code,
  v.name as vendor_name,
  vp.payment_method,
  vp.total_amount,
  COALESCE(SUM(pa.amount_allocated), 0) as amount_allocated,
  vp.total_amount - COALESCE(SUM(pa.amount_allocated), 0) as amount_unallocated,
  COUNT(pa.id) as invoice_count
FROM vendor_payments vp
JOIN vendors v ON v.id = vp.vendor_id
LEFT JOIN payment_allocations pa ON pa.payment_id = vp.id
WHERE vp.status != 'cancelled'
GROUP BY vp.id, v.code, v.name;

COMMENT ON VIEW payment_summary_vw IS 'Payment summary with allocation details';

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 018_manufacturing_production_orders.sql
-- Description: Production orders with material reservations and MRP
-- Dependencies: 017_manufacturing_bom.sql, 009_inventory_raw_material.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE production_status AS ENUM (
  'planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'
);

-- ==================== PRODUCTION ORDERS ====================

CREATE TABLE IF NOT EXISTS production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  
  product_id UUID REFERENCES products(id) NOT NULL,
  bom_id UUID REFERENCES bom_headers(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Quantities
  qty_planned DECIMAL(15,4) NOT NULL CHECK (qty_planned > 0),
  qty_completed DECIMAL(15,4) DEFAULT 0 CHECK (qty_completed >= 0),
  qty_rejected DECIMAL(15,4) DEFAULT 0 CHECK (qty_rejected >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_planned - qty_completed - qty_rejected) STORED,
  
  -- Schedule
  start_date DATE,
  due_date DATE,
  completion_date DATE,
  
  status production_status DEFAULT 'planned',
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Costing
  standard_cost DECIMAL(15,2) DEFAULT 0,
  actual_cost DECIMAL(15,2) DEFAULT 0,
  cost_variance DECIMAL(15,2) GENERATED ALWAYS AS (actual_cost - standard_cost) STORED,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_prod_order_company ON production_orders(company_id);
CREATE INDEX idx_prod_order_product ON production_orders(product_id);
CREATE INDEX idx_prod_order_status ON production_orders(status);
CREATE INDEX idx_prod_order_date ON production_orders(po_date DESC);
CREATE INDEX idx_prod_order_due_date ON production_orders(due_date);
CREATE INDEX idx_prod_order_priority ON production_orders(priority);

CREATE TRIGGER trigger_prod_order_updated_at
  BEFORE UPDATE ON production_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE production_orders IS 'Production orders (manufacturing work orders)';

-- ==================== MATERIAL RESERVATIONS ====================

CREATE TABLE IF NOT EXISTS production_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_order_id UUID REFERENCES production_orders(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES materials(id) NOT NULL,
  stage wip_stage,
  
  qty_required DECIMAL(15,4) NOT NULL CHECK (qty_required > 0),
  qty_issued DECIMAL(15,4) DEFAULT 0 CHECK (qty_issued >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_required - qty_issued) STORED,
  
  unit_cost DECIMAL(15,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reservation_po ON production_reservations(production_order_id);
CREATE INDEX idx_reservation_material ON production_reservations(material_id);
CREATE INDEX idx_reservation_outstanding ON production_reservations(qty_outstanding) WHERE qty_outstanding > 0;

COMMENT ON TABLE production_reservations IS 'Material reservations for production orders';

-- ==================== FUNCTIONS ====================

-- Create reservations from BOM explosion
CREATE OR REPLACE FUNCTION create_production_reservations(
  p_production_order_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_po RECORD;
  v_material RECORD;
BEGIN
  -- Get production order
  SELECT * INTO v_po
  FROM production_orders
  WHERE id = p_production_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;
  
  -- Delete existing reservations
  DELETE FROM production_reservations
  WHERE production_order_id = p_production_order_id;
  
  -- Create reservations from BOM explosion
  INSERT INTO production_reservations (
    production_order_id,
    material_id,
    stage,
    qty_required,
    unit_cost
  )
  SELECT 
    p_production_order_id,
    e.material_id,
    e.stage,
    e.total_qty,
    m.standard_cost
  FROM explode_bom(v_po.product_id, v_po.qty_planned) e
  JOIN materials m ON m.id = e.material_id
  WHERE e.material_id IS NOT NULL;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_production_reservations IS 'Create material reservations from BOM explosion';

-- Calculate MRP (Material Requirements Planning)
CREATE OR REPLACE FUNCTION calculate_mrp(
  p_production_order_id UUID
)
RETURNS TABLE (
  material_id UUID,
  material_code VARCHAR,
  material_name VARCHAR,
  gross_requirement DECIMAL(15,4),
  on_hand DECIMAL(15,4),
  reserved_other DECIMAL(15,4),
  available DECIMAL(15,4),
  net_requirement DECIMAL(15,4),
  action VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.material_id,
    m.code as material_code,
    m.name as material_name,
    pr.qty_required as gross_requirement,
    COALESCE(rmb.current_qty, 0) as on_hand,
    COALESCE((
      SELECT SUM(qty_outstanding)
      FROM production_reservations
      WHERE material_id = pr.material_id
        AND production_order_id != p_production_order_id
    ), 0) as reserved_other,
    COALESCE(rmb.current_qty, 0) - COALESCE((
      SELECT SUM(qty_outstanding)
      FROM production_reservations
      WHERE material_id = pr.material_id
        AND production_order_id != p_production_order_id
    ), 0) as available,
    GREATEST(
      pr.qty_required - (
        COALESCE(rmb.current_qty, 0) - COALESCE((
          SELECT SUM(qty_outstanding)
          FROM production_reservations
          WHERE material_id = pr.material_id
            AND production_order_id != p_production_order_id
        ), 0)
      ),
      0
    ) as net_requirement,
    CASE
      WHEN COALESCE(rmb.current_qty, 0) - COALESCE((
        SELECT SUM(qty_outstanding)
        FROM production_reservations
        WHERE material_id = pr.material_id
          AND production_order_id != p_production_order_id
      ), 0) >= pr.qty_required THEN 'OK'
      WHEN COALESCE(rmb.current_qty, 0) > 0 THEN 'PARTIAL'
      ELSE 'PURCHASE'
    END as action
  FROM production_reservations pr
  JOIN materials m ON m.id = pr.material_id
  LEFT JOIN (
    SELECT 
      material_id,
      company_id,
      SUM(current_qty) as current_qty
    FROM raw_material_balance_mv
    GROUP BY material_id, company_id
  ) rmb ON rmb.material_id = pr.material_id
  WHERE pr.production_order_id = p_production_order_id
  ORDER BY action DESC, material_code;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_mrp IS 'Calculate material requirements and availability';

-- Release production order (check material availability)
CREATE OR REPLACE FUNCTION release_production_order(
  p_production_order_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_shortage_count INTEGER;
BEGIN
  -- Check for material shortages
  SELECT COUNT(*) INTO v_shortage_count
  FROM calculate_mrp(p_production_order_id)
  WHERE action = 'PURCHASE';
  
  IF v_shortage_count > 0 THEN
    RAISE EXCEPTION 'Cannot release production order: % materials in shortage', v_shortage_count;
  END IF;
  
  -- Release order
  UPDATE production_orders
  SET 
    status = 'released',
    released_at = NOW(),
    released_by = p_user_id
  WHERE id = p_production_order_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION release_production_order IS 'Release production order after checking material availability';

-- ==================== RLS POLICIES ====================

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY prod_order_tenant_isolation ON production_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY reservation_tenant ON production_reservations
  FOR ALL USING (production_order_id IN (
    SELECT id FROM production_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY prod_order_service_role ON production_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY reservation_service_role ON production_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_prod_orders
  AFTER INSERT OR UPDATE OR DELETE ON production_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Production Order Summary
CREATE VIEW production_order_summary_vw AS
SELECT 
  po.id,
  po.company_id,
  po.po_number,
  po.po_date,
  p.code as product_code,
  p.name as product_name,
  po.qty_planned,
  po.qty_completed,
  po.qty_rejected,
  po.qty_outstanding,
  po.status,
  po.priority,
  po.due_date,
  po.standard_cost,
  po.actual_cost,
  po.cost_variance,
  COUNT(pr.id) as material_count,
  SUM(CASE WHEN pr.qty_outstanding > 0 THEN 1 ELSE 0 END) as materials_pending
FROM production_orders po
JOIN products p ON p.id = po.product_id
LEFT JOIN production_reservations pr ON pr.production_order_id = po.id
GROUP BY po.id, p.code, p.name;

COMMENT ON VIEW production_order_summary_vw IS 'Production order summary with material status';


-- ═══════════ NEXT MIGRATION ═══════════


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


-- ═══════════ NEXT MIGRATION ═══════════


-- Migration: 020_sales_pos.sql
-- Description: Point of Sale (counter/cash sales)
-- Dependencies: 011_inventory_finished_goods.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== SALES POS ====================

CREATE TABLE IF NOT EXISTS sales_pos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  pos_number VARCHAR(50) UNIQUE NOT NULL,
  sale_date DATE NOT NULL,
  customer_id UUID REFERENCES customers(id), -- Optional for walk-in
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal - discount_amount + tax_amount) STORED,
  
  payment_method payment_method NOT NULL,
  payment_reference VARCHAR(100),
  amount_tendered DECIMAL(15,2),
  change_amount DECIMAL(15,2) GENERATED ALWAYS AS (
    CASE WHEN amount_tendered IS NOT NULL 
    THEN amount_tendered - (subtotal - discount_amount + tax_amount)
    ELSE 0 END
  ) STORED,
  
  status VARCHAR(20) DEFAULT 'completed', -- POS is typically instant
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_pos_company ON sales_pos(company_id);
CREATE INDEX idx_pos_customer ON sales_pos(customer_id);
CREATE INDEX idx_pos_warehouse ON sales_pos(warehouse_id);
CREATE INDEX idx_pos_date ON sales_pos(sale_date DESC);
CREATE INDEX idx_pos_status ON sales_pos(status);

COMMENT ON TABLE sales_pos IS 'Point of Sale transactions (counter/cash sales)';

-- ==================== SALES POS LINES ====================

CREATE TABLE IF NOT EXISTS sales_pos_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_id UUID REFERENCES sales_pos(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty DECIMAL(15,4) NOT NULL CHECK (qty > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    qty * unit_price * (1 - discount_percentage / 100)
  ) STORED,
  
  notes TEXT,
  
  UNIQUE(pos_id, line_number)
);

CREATE INDEX idx_pos_lines_pos ON sales_pos_lines(pos_id);
CREATE INDEX idx_pos_lines_variant ON sales_pos_lines(product_variant_id);

COMMENT ON TABLE sales_pos_lines IS 'POS transaction line items';

-- ==================== TRIGGERS ====================

-- Auto-update POS subtotal
CREATE OR REPLACE FUNCTION update_pos_total()
RETURNS TRIGGER AS $$
DECLARE
  v_pos_id UUID;
BEGIN
  v_pos_id := COALESCE(NEW.pos_id, OLD.pos_id);
  
  UPDATE sales_pos
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM sales_pos_lines
    WHERE pos_id = v_pos_id
  )
  WHERE id = v_pos_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pos_total_insert
  AFTER INSERT ON sales_pos_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_total();

CREATE TRIGGER trigger_update_pos_total_update
  AFTER UPDATE ON sales_pos_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_pos_total();

CREATE TRIGGER trigger_update_pos_total_delete
  AFTER DELETE ON sales_pos_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_total();

-- ==================== POSTING FUNCTION ====================

-- Post POS sale (issue inventory, create journal entry)
CREATE OR REPLACE FUNCTION post_pos_sale(
  p_pos_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_pos RECORD;
  v_line RECORD;
  v_bin_id UUID;
BEGIN
  -- Get POS header
  SELECT * INTO v_pos
  FROM sales_pos
  WHERE id = p_pos_id;
  
  IF v_pos.status = 'posted' THEN
    RAISE EXCEPTION 'POS sale already posted';
  END IF;
  
  -- Get default bin
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_pos.warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;
  
  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse';
  END IF;
  
  -- Issue each line from finished goods
  FOR v_line IN 
    SELECT * FROM sales_pos_lines WHERE pos_id = p_pos_id
  LOOP
    INSERT INTO finished_goods_ledger (
      company_id,
      product_variant_id,
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
    )
    SELECT 
      v_pos.company_id,
      v_line.product_variant_id,
      v_pos.warehouse_id,
      v_bin_id,
      v_pos.period_id,
      v_pos.sale_date,
      'ISSUE',
      'SALES_POS',
      v_pos.id,
      v_pos.pos_number,
      0,
      v_line.qty,
      fgb.avg_unit_cost,
      p_user_id,
      true
    FROM finished_goods_balance_mv fgb
    WHERE fgb.product_variant_id = v_line.product_variant_id
      AND fgb.warehouse_id = v_pos.warehouse_id
      AND fgb.bin_id = v_bin_id
      AND fgb.company_id = v_pos.company_id
    LIMIT 1;
  END LOOP;
  
  -- Update status
  UPDATE sales_pos
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_pos_id;
  
  -- TODO: Create journal entry (Dr. Cash, Cr. Sales Revenue, Dr. COGS, Cr. Inventory)
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_pos_sale IS 'Post POS sale: issue inventory and create journal entry';

-- ==================== RLS POLICIES ====================

ALTER TABLE sales_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_pos_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY pos_tenant_isolation ON sales_pos
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY pos_lines_tenant ON sales_pos_lines
  FOR ALL USING (pos_id IN (
    SELECT id FROM sales_pos WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY pos_service_role ON sales_pos FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY pos_lines_service_role ON sales_pos_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_pos
  AFTER INSERT OR UPDATE OR DELETE ON sales_pos
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== VIEWS ====================

-- Daily POS Sales Summary
CREATE VIEW daily_pos_sales_vw AS
SELECT 
  sp.company_id,
  sp.sale_date,
  sp.warehouse_id,
  w.name as warehouse_name,
  COUNT(sp.id) as transaction_count,
  SUM(sp.total_amount) as total_sales,
  SUM(sp.subtotal) as gross_sales,
  SUM(sp.discount_amount) as total_discounts,
  SUM(sp.tax_amount) as total_tax,
  COUNT(CASE WHEN sp.payment_method = 'CASH' THEN 1 END) as cash_transactions,
  COUNT(CASE WHEN sp.payment_method != 'CASH' THEN 1 END) as non_cash_transactions
FROM sales_pos sp
JOIN warehouses w ON w.id = sp.warehouse_id
WHERE sp.status = 'posted'
GROUP BY sp.company_id, sp.sale_date, sp.warehouse_id, w.name;

COMMENT ON VIEW daily_pos_sales_vw IS 'Daily POS sales summary by warehouse';


-- ═══════════ NEXT MIGRATION ═══════════


