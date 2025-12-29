-- Migration: 047_add_missing_mappings.sql
-- Description: Add missing account mappings for Adjustments, Returns, and Discounts
-- Dependencies: 045_account_mapping_and_full_coa.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

CREATE OR REPLACE FUNCTION seed_account_mappings(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Helper to insert if mapping doesn't exist AND account exists
  
  -- ==================== CASH & BANK ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'DEFAULT_CASH', id, 'Default Cash Account for POS/Payments'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'DEFAULT_BANK', id, 'Default Bank Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1020'
  ON CONFLICT DO NOTHING;

  -- ==================== SALES (REVENUE) ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_POS', id, 'Sales Revenue for Retail/POS'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_WHOLESALE', id, 'Sales Revenue for Distributor/B2B'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4020'
  ON CONFLICT DO NOTHING;
  
  -- [NEW] Sales Returns (Contra-Revenue)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_RETURNS', id, 'Sales Returns and Allowances'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4100'
  ON CONFLICT DO NOTHING;

  -- [NEW] Sales Discounts (Contra-Revenue)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'SALES_DISCOUNTS', id, 'Sales Discounts'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '4200'
  ON CONFLICT DO NOTHING;

  -- ==================== RECEIVABLES ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'ACCOUNTS_RECEIVABLE', id, 'Default AR Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1100'
  ON CONFLICT DO NOTHING;

  -- ==================== INVENTORY ====================
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

  -- [NEW] Inventory Adjustment (Expense)
  -- Mapping to 'Inventory Variance' (6910)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'INVENTORY_ADJUSTMENT', id, 'Inventory Variance/Adjustment Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6910'
  ON CONFLICT DO NOTHING;
  
  -- [NEW] Inventory Loss/Scrap (Expense)
  -- Mapping to 'Loss/Scrap' (6900)
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'INVENTORY_SCRAP', id, 'Loss or Scrap Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6900'
  ON CONFLICT DO NOTHING;

  -- ==================== PAYABLES ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'ACCOUNTS_PAYABLE', id, 'Default AP Account'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'TAX_PAYABLE', id, 'VAT/Tax Payable'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2030'
  ON CONFLICT DO NOTHING;

  -- ==================== COST & EXPENSES ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'COGS_DEFAULT', id, 'Cost of Goods Sold'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '5010'
  ON CONFLICT DO NOTHING;
  
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'EXPENSE_LABOR', id, 'Direct Labor Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6010'
  ON CONFLICT DO NOTHING;

  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'EXPENSE_OVERHEAD', id, 'Factory Overhead Expense'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '6020'
  ON CONFLICT DO NOTHING;
  
  -- ==================== CLEARING ====================
  INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
  SELECT p_company_id, 'CLEARING_SHOPEE', id, 'Shopee Wallet Clearing'
  FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2110'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
