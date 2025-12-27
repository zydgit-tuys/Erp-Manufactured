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
