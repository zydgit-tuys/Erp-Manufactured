-- Migration: 029_financial_reporting.sql
-- Description: Financial reporting functions and period closing
-- Dependencies: 000_schema_v2.sql (chart_of_accounts), 028_journals_schema.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== PERIOD CLOSING LOGS ====================

CREATE TABLE IF NOT EXISTS period_closing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  step_name VARCHAR(100) NOT NULL, -- 'inventory_valuation', 'depreciation', 'final_lock'
  status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
  message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(period_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_closing_log_period ON period_closing_logs(period_id);

COMMENT ON TABLE period_closing_logs IS 'Audit trail for accounting period closing steps';

-- ==================== FINANCIAL REPORT TEMPLATES ====================

CREATE TABLE IF NOT EXISTS financial_report_structure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  report_type VARCHAR(50) NOT NULL, -- 'BALANCE_SHEET', 'INCOME_STATEMENT'
  section_code VARCHAR(50) NOT NULL, -- 'ASSETS_CURRENT', 'LIABILITIES_LONG_TERM'
  section_name VARCHAR(100) NOT NULL,
  display_order INTEGER NOT NULL,
  
  -- Logic to include accounts
  account_type_filter VARCHAR(50), -- 'ASSET', 'LIABILITY'
  account_category_filter VARCHAR(50), -- 'CURRENT_ASSET'
  
  -- Parent section for hierarchy
  parent_section_id UUID REFERENCES financial_report_structure(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, report_type, section_code)
);

CREATE INDEX IF NOT EXISTS idx_fin_struct_company ON financial_report_structure(company_id);

COMMENT ON TABLE financial_report_structure IS 'Structure definition for standard financial reports';

-- ==================== REPORTING FUNCTIONS ====================

-- 1. TRIAL BALANCE
-- Summarizes all accounts with their debit/credit totals and net balance
CREATE OR REPLACE FUNCTION get_trial_balance(
  p_company_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  account_id UUID,
  account_code VARCHAR,
  account_name VARCHAR,
  account_type VARCHAR,
  total_debit DECIMAL,
  total_credit DECIMAL,
  net_balance DECIMAL
) AS $$
DECLARE
  v_end_date DATE;
BEGIN
  -- Get period end date
  SELECT end_date INTO v_end_date FROM accounting_periods WHERE id = p_period_id;

  RETURN QUERY
  WITH account_totals AS (
    SELECT 
      jel.account_id,
      SUM(jel.debit) as total_debit,
      SUM(jel.credit) as total_credit
    FROM journal_lines jel
    JOIN journals je ON je.id = jel.journal_id
    WHERE je.company_id = p_company_id
      AND je.status = 'posted'
      AND je.journal_date <= v_end_date -- Cumulative for BS, Period-only for PL? Standard TB is usually cumulative
    GROUP BY jel.account_id
  )
  SELECT 
    coa.id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    COALESCE(at.total_debit, 0) as total_debit,
    COALESCE(at.total_credit, 0) as total_credit,
    CASE 
      WHEN coa.normal_balance = 'DEBIT' THEN COALESCE(at.total_debit, 0) - COALESCE(at.total_credit, 0)
      ELSE COALESCE(at.total_credit, 0) - COALESCE(at.total_debit, 0)
    END as net_balance
  FROM chart_of_accounts coa
  LEFT JOIN account_totals at ON at.account_id = coa.id
  WHERE coa.company_id = p_company_id
    AND coa.is_active = true
  ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. BALANCE SHEET
-- Assets = Liabilities + Equity
CREATE OR REPLACE FUNCTION get_balance_sheet(
  p_company_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  section VARCHAR, -- 'ASSET', 'LIABILITY', 'EQUITY'
  category VARCHAR,
  account_code VARCHAR,
  account_name VARCHAR,
  balance DECIMAL
) AS $$
DECLARE
  v_end_date DATE;
BEGIN
  SELECT end_date INTO v_end_date FROM accounting_periods WHERE id = p_period_id;

  RETURN QUERY
  SELECT 
    coa.account_type as section,
    coa.account_category as category,
    coa.account_code,
    coa.account_name,
    CASE 
      WHEN coa.normal_balance = 'DEBIT' THEN (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))
      ELSE (COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0))
    END as balance
  FROM chart_of_accounts coa
  LEFT JOIN journal_lines jel ON jel.account_id = coa.id
  LEFT JOIN journals je ON je.id = jel.journal_id 
    AND je.status = 'posted' 
    AND je.journal_date <= v_end_date
  WHERE coa.company_id = p_company_id
    AND coa.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
  GROUP BY coa.id, coa.account_type, coa.account_category, coa.account_code, coa.account_name, coa.normal_balance
  HAVING (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) != 0
  ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. INCOME STATEMENT (P&L)
-- Revenue - Expenses
CREATE OR REPLACE FUNCTION get_income_statement(
  p_company_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  section VARCHAR, -- 'REVENUE', 'EXPENSE'
  category VARCHAR,
  account_code VARCHAR,
  account_name VARCHAR,
  balance DECIMAL
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  SELECT start_date, end_date INTO v_start_date, v_end_date FROM accounting_periods WHERE id = p_period_id;

  RETURN QUERY
  SELECT 
    coa.account_type as section,
    coa.account_category as category,
    coa.account_code,
    coa.account_name,
    CASE 
      WHEN coa.normal_balance = 'DEBIT' THEN (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0))
      ELSE (COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0))
    END as balance
  FROM chart_of_accounts coa
  LEFT JOIN journal_lines jel ON jel.account_id = coa.id
  LEFT JOIN journals je ON je.id = jel.journal_id 
    AND je.status = 'posted' 
    AND je.journal_date BETWEEN v_start_date AND v_end_date -- Only transactions within period
  WHERE coa.company_id = p_company_id
    AND coa.account_type IN ('REVENUE', 'EXPENSE')
  GROUP BY coa.id, coa.account_type, coa.account_category, coa.account_code, coa.account_name, coa.normal_balance
  HAVING (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) != 0
  ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== RLS POLICIES ====================

ALTER TABLE period_closing_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_report_structure ENABLE ROW LEVEL SECURITY;

CREATE POLICY closing_logs_tenant ON period_closing_logs
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY fin_struct_tenant ON financial_report_structure
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY closing_logs_service ON period_closing_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY fin_struct_service ON financial_report_structure FOR ALL TO service_role USING (true) WITH CHECK (true);

