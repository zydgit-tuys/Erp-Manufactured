-- Migration: 028_journals_schema.sql
-- Description: Journal Entries (General Ledger) Tables
-- Dependencies: 002_foundation_coa.sql, 003_foundation_periods.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== JOURNALS (HEADER) ====================

CREATE TABLE IF NOT EXISTS journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES accounting_periods(id), -- Auto-assigned or manual
  
  journal_number VARCHAR(50) NOT NULL, -- Auto-generated code
  journal_date DATE NOT NULL,
  description TEXT,
  
  -- Reference (Source)
  reference_type VARCHAR(50) DEFAULT 'MANUAL', -- SALES_POS, SALES_INVOICE, PURCHASE, PAYMENT, MANUAL
  reference_id UUID,
  reference_number VARCHAR(100),
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft', -- draft, posted, void
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, journal_number)
);

CREATE INDEX idx_journals_company ON journals(company_id);
CREATE INDEX idx_journals_period ON journals(period_id);
CREATE INDEX idx_journals_date ON journals(journal_date DESC);
CREATE INDEX idx_journals_ref ON journals(reference_type, reference_id);
CREATE INDEX idx_journals_status ON journals(status);

COMMENT ON TABLE journals IS 'General Ledger journal entries (headers)';

-- ==================== JOURNAL LINES ====================

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID REFERENCES journals(id) ON DELETE CASCADE NOT NULL,
  
  account_id UUID REFERENCES chart_of_accounts(id) NOT NULL,
  
  debit DECIMAL(15,2) DEFAULT 0 CHECK (debit >= 0),
  credit DECIMAL(15,2) DEFAULT 0 CHECK (credit >= 0),
  
  description TEXT,
  
  -- Dimensions (Optional)
  department_id UUID, 
  project_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_double_entry CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit=0 AND credit=0))
);

CREATE INDEX idx_jlines_journal ON journal_lines(journal_id);
CREATE INDEX idx_jlines_account ON journal_lines(account_id);

COMMENT ON TABLE journal_lines IS 'GL journal entry line items';

-- ==================== TRIGGERS ====================

-- 1. Auto-update Period ID based on Date
CREATE OR REPLACE FUNCTION set_journal_period()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id UUID;
BEGIN
  IF NEW.period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM accounting_periods
    WHERE company_id = NEW.company_id
      AND NEW.journal_date BETWEEN start_date AND end_date
    LIMIT 1;
    
    IF v_period_id IS NOT NULL THEN
      NEW.period_id := v_period_id;
    END IF;
  END IF;
  return NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_journal_period
  BEFORE INSERT OR UPDATE OF journal_date ON journals
  FOR EACH ROW
  EXECUTE FUNCTION set_journal_period();

-- 2. Audit
CREATE TRIGGER trigger_audit_journals
  AFTER INSERT OR UPDATE OR DELETE ON journals
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== RLS ====================

ALTER TABLE journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY journals_isolation ON journals
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY jlines_isolation ON journal_lines
  FOR ALL USING (journal_id IN (
    SELECT id FROM journals WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY journals_service ON journals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY jlines_service ON journal_lines FOR ALL TO service_role USING (true) WITH CHECK (true);
