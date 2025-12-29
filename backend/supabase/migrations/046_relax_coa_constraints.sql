-- Migration: 046_relax_coa_constraints.sql
-- Description: Drop strict normal_balance constraint to allow Contra Accounts (e.g., Allowance for Doubtful Accounts, Sales Returns)
-- Dependencies: 002_foundation_coa.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

-- The original constraint check_normal_balance_type prevented ASSETs from having CREDIT balance
-- and REVENUE from having DEBIT balance. This blocks valid Contra Accounts.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'check_normal_balance_type'
        AND table_name = 'chart_of_accounts'
    ) THEN
        ALTER TABLE chart_of_accounts DROP CONSTRAINT check_normal_balance_type;
    END IF;
END $$;
