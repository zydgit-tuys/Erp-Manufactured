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
