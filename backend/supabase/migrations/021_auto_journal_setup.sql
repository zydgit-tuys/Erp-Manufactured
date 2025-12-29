-- Migration: 021_auto_journal_setup.sql
-- Description: Setup system account mappings for auto journaling
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

-- ==================== SYSTEM ACCOUNT MAPPINGS ====================

-- Insert default system account mappings for all companies
-- These map system functions to chart of accounts for auto journaling

INSERT INTO system_account_mappings (company_id, mapping_code, account_id, description)
SELECT 
  c.id as company_id,
  mapping.code as mapping_code,
  (
    SELECT id 
    FROM chart_of_accounts 
    WHERE company_id = c.id 
    AND account_code = mapping.default_code 
    LIMIT 1
  ) as account_id,
  mapping.description
FROM companies c
CROSS JOIN (
  VALUES
    -- Inventory Accounts
    ('INVENTORY_RAW_MATERIALS', '1210', 'Raw Materials Inventory - Auto Journaling'),
    ('INVENTORY_WIP', '1220', 'Work in Progress Inventory - Auto Journaling'),
    ('INVENTORY_FINISHED_GOODS', '1230', 'Finished Goods Inventory - Auto Journaling'),
    
    -- Payables
    ('ACCOUNTS_PAYABLE_ACCRUED', '2110', 'Accounts Payable (Accrued) - Auto Journaling'),
    ('ACCOUNTS_PAYABLE', '2100', 'Accounts Payable - Auto Journaling'),
    
    -- Receivables
    ('ACCOUNTS_RECEIVABLE', '1110', 'Accounts Receivable - Auto Journaling'),
    
    -- Revenue & Expenses
    ('SALES_REVENUE', '4000', 'Sales Revenue - Auto Journaling'),
    ('COST_OF_GOODS_SOLD', '5000', 'Cost of Goods Sold - Auto Journaling'),
    
    -- Variances
    ('INVENTORY_VARIANCE', '5100', 'Inventory Variance - Auto Journaling'),
    ('PURCHASE_PRICE_VARIANCE', '5110', 'Purchase Price Variance - Auto Journaling'),
    
    -- Cash & Bank
    ('CASH_IN_HAND', '1010', 'Cash in Hand - Auto Journaling'),
    ('BANK_ACCOUNT', '1020', 'Bank Account - Auto Journaling')
) AS mapping(code, default_code, description)
WHERE NOT EXISTS (
  SELECT 1 
  FROM system_account_mappings 
  WHERE company_id = c.id 
  AND mapping_code = mapping.code
)
AND EXISTS (
  SELECT 1 
  FROM chart_of_accounts 
  WHERE company_id = c.id 
  AND account_code = mapping.default_code
);

-- Add comments
COMMENT ON TABLE system_account_mappings IS 
'Maps system functions to chart of accounts for automatic journal entry generation';

COMMENT ON COLUMN system_account_mappings.mapping_code IS 
'Unique code identifying the system function (e.g., INVENTORY_RAW_MATERIALS)';

COMMENT ON COLUMN system_account_mappings.account_id IS 
'References the chart of accounts entry to use for this system function';

-- ==================== HELPER FUNCTION ====================

-- Function to check if company has all required account mappings
CREATE OR REPLACE FUNCTION check_account_mappings(p_company_id UUID, p_mapping_codes TEXT[])
RETURNS TABLE(mapping_code TEXT, account_id UUID, account_code TEXT, account_name TEXT, is_configured BOOLEAN)
LANGUAGE plpgsql
AS $$
BEGIN
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

COMMENT ON FUNCTION check_account_mappings(UUID, TEXT[]) IS
'Helper function to check which account mappings are configured for a company';

-- ==================== VERIFICATION ====================

-- View to see all account mappings by company
CREATE OR REPLACE VIEW v_system_account_mappings AS
SELECT 
  c.code as company_code,
  c.name as company_name,
  sam.mapping_code,
  sam.description,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  sam.created_at,
  sam.updated_at
FROM system_account_mappings sam
JOIN companies c ON c.id = sam.company_id
LEFT JOIN chart_of_accounts coa ON coa.id = sam.account_id
ORDER BY c.code, sam.mapping_code;

COMMENT ON VIEW v_system_account_mappings IS
'View showing all system account mappings with company and account details';

-- ==================== USAGE EXAMPLES ====================

-- Example 1: Check if company has all required mappings for inventory transactions
-- SELECT * FROM check_account_mappings(
--   'company-uuid-here',
--   ARRAY['INVENTORY_RAW_MATERIALS', 'INVENTORY_WIP', 'INVENTORY_FINISHED_GOODS']
-- );

-- Example 2: View all mappings for a company
-- SELECT * FROM v_system_account_mappings WHERE company_code = 'COMP001';

-- Example 3: Update a mapping
-- UPDATE system_account_mappings
-- SET account_id = 'new-account-uuid'
-- WHERE company_id = 'company-uuid' AND mapping_code = 'INVENTORY_RAW_MATERIALS';
