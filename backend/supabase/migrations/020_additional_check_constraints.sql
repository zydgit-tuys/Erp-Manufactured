-- Migration: 020_additional_check_constraints.sql
-- Description: Add CHECK constraints for business rules validation
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

-- ==================== MASTER DATA CONSTRAINTS ====================

-- Vendors
ALTER TABLE vendors
ADD CONSTRAINT check_positive_credit_limit CHECK (credit_limit >= 0),
ADD CONSTRAINT check_valid_custom_payment_days CHECK (
  (payment_terms = 'CUSTOM' AND custom_payment_days > 0) OR 
  (payment_terms != 'CUSTOM')
);

COMMENT ON CONSTRAINT check_positive_credit_limit ON vendors IS 'Ensure credit limit is non-negative';
COMMENT ON CONSTRAINT check_valid_custom_payment_days ON vendors IS 'Ensure custom payment days is set when payment terms is CUSTOM';

-- Customers
ALTER TABLE customers
ADD CONSTRAINT check_positive_credit_limit CHECK (credit_limit >= 0),
ADD CONSTRAINT check_valid_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
ADD CONSTRAINT check_valid_custom_payment_days CHECK (
  (payment_terms = 'CUSTOM' AND custom_payment_days > 0) OR 
  (payment_terms != 'CUSTOM')
);

COMMENT ON CONSTRAINT check_positive_credit_limit ON customers IS 'Ensure credit limit is non-negative';
COMMENT ON CONSTRAINT check_valid_discount ON customers IS 'Ensure discount percentage is between 0 and 100';
COMMENT ON CONSTRAINT check_valid_custom_payment_days ON customers IS 'Ensure custom payment days is set when payment terms is CUSTOM';

-- Materials
ALTER TABLE materials
ADD CONSTRAINT check_positive_lead_time CHECK (lead_time_days >= 0);

COMMENT ON CONSTRAINT check_positive_lead_time ON materials IS 'Ensure lead time is non-negative';

-- Products
ALTER TABLE products
ADD CONSTRAINT check_positive_standard_cost CHECK (standard_cost >= 0);

COMMENT ON CONSTRAINT check_positive_standard_cost ON products IS 'Ensure standard cost is non-negative';

-- ==================== TRANSACTION CONSTRAINTS ====================

-- Purchase Order Lines
ALTER TABLE purchase_order_lines
ADD CONSTRAINT check_received_not_exceed_ordered CHECK (qty_received <= qty_ordered),
ADD CONSTRAINT check_invoiced_not_exceed_received CHECK (qty_invoiced <= qty_received),
ADD CONSTRAINT check_positive_unit_price CHECK (unit_price >= 0);

COMMENT ON CONSTRAINT check_received_not_exceed_ordered ON purchase_order_lines IS 'Ensure received quantity does not exceed ordered quantity';
COMMENT ON CONSTRAINT check_invoiced_not_exceed_received ON purchase_order_lines IS 'Ensure invoiced quantity does not exceed received quantity';
COMMENT ON CONSTRAINT check_positive_unit_price ON purchase_order_lines IS 'Ensure unit price is non-negative';

-- Sales Order Lines
ALTER TABLE sales_order_lines
ADD CONSTRAINT check_delivered_not_exceed_ordered CHECK (qty_delivered <= qty_ordered),
ADD CONSTRAINT check_invoiced_not_exceed_delivered CHECK (qty_invoiced <= qty_delivered),
ADD CONSTRAINT check_positive_unit_price CHECK (unit_price >= 0);

COMMENT ON CONSTRAINT check_delivered_not_exceed_ordered ON sales_order_lines IS 'Ensure delivered quantity does not exceed ordered quantity';
COMMENT ON CONSTRAINT check_invoiced_not_exceed_delivered ON sales_order_lines IS 'Ensure invoiced quantity does not exceed delivered quantity';
COMMENT ON CONSTRAINT check_positive_unit_price ON sales_order_lines IS 'Ensure unit price is non-negative';

-- BOM Lines
ALTER TABLE bom_lines
ADD CONSTRAINT check_positive_qty_per CHECK (qty_per > 0),
ADD CONSTRAINT check_valid_scrap_percentage CHECK (scrap_percentage >= 0 AND scrap_percentage < 100);

COMMENT ON CONSTRAINT check_positive_qty_per ON bom_lines IS 'Ensure quantity per unit is positive';
COMMENT ON CONSTRAINT check_valid_scrap_percentage ON bom_lines IS 'Ensure scrap percentage is between 0 and 100';

-- ==================== INVENTORY LEDGER CONSTRAINTS ====================

-- Note: Ledger tables already have proper CHECK constraints in their original schema:
-- - qty_in >= 0 (ensures receipts are positive)
-- - qty_out >= 0 (ensures issues are positive, stored as positive then negated in logic)
-- - unit_cost >= 0
-- See migrations: 009_inventory_raw_material.sql, 010_inventory_wip.sql, 011_inventory_finished_goods.sql


-- ==================== ACCOUNTING CONSTRAINTS ====================

-- Chart of Accounts
ALTER TABLE chart_of_accounts
ADD CONSTRAINT check_valid_level CHECK (level >= 1 AND level <= 5);

COMMENT ON CONSTRAINT check_valid_level ON chart_of_accounts IS 'Ensure account level is between 1 and 5';

-- Note: Journal balance validation is enforced by trigger validate_journal_balance()
-- in migration 043_unbalanced_journal_check.sql

