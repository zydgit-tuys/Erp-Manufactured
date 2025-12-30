-- ══════════════════════════════════════════════════════════════════
-- Migration: 051_fix_security_functions.sql
-- Description: Fix Security Risks in RPC Functions (Tenant Isolation)
-- Addresses: "Tenant Isolation" (Audit Finding)
-- ══════════════════════════════════════════════════════════════════

-- 1. Helper Function for Tenant Validation
-- This function raises an exception if the current user does not belong to the target company.
CREATE OR REPLACE FUNCTION check_tenant_access(p_company_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Bypass check for service_role/admin if needed, but for now strict check
  IF NOT EXISTS (
    SELECT 1 FROM user_company_mapping
    WHERE user_id = auth.uid()
      AND company_id = p_company_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access Denied: User does not belong to this company'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_tenant_access(UUID) IS
'Security barrier: raises exception if auth.uid() is not active member of company';

-- 2. Securing check_account_mappings (from 021_auto_journal_setup.sql)
-- Vulnerability: Information Disclosure (could read account codes of other companies)
CREATE OR REPLACE FUNCTION check_account_mappings(p_company_id UUID, p_mapping_codes TEXT[])
RETURNS TABLE(mapping_code TEXT, account_id UUID, account_code TEXT, account_name TEXT, is_configured BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER -- Added SECURITY DEFINER to effectively control access
AS $$
BEGIN
  -- SECURITY CHECK
  PERFORM check_tenant_access(p_company_id);

  RETURN QUERY
  SELECT 
    unnest.mapping_code,
    sam.account_id,
    coa.account_code,
    coa.account_name,
    (sam.account_id IS NOT NULL) as is_configured
  FROM unnest(p_mapping_codes) AS unnest(mapping_code)
  LEFT JOIN system_account_mappings sam 
    ON sam.company_id = p_company_id 
    AND sam.mapping_code = unnest.mapping_code
  LEFT JOIN chart_of_accounts coa 
    ON coa.id = sam.account_id;
END;
$$;

-- 3. Securing seed_account_mappings (from 045_account_mapping_and_full_coa.sql)
-- Vulnerability: Unauthorized Write (could seed data for other companies)
CREATE OR REPLACE FUNCTION seed_account_mappings(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- SECURITY CHECK
  PERFORM check_tenant_access(p_company_id);

  -- (Original Logic Preserved)
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

-- 4. Securing post_pos_sale (from 020_sales_pos.sql)
-- Vulnerability: Unauthorized Action (could post sales for other companies)
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
  
  -- SECURITY CHECK
  IF v_pos IS NULL THEN
     RAISE EXCEPTION 'POS not found or access denied';
  END IF;

  PERFORM check_tenant_access(v_pos.company_id);

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
