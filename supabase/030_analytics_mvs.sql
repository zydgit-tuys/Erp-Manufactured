-- Migration: 030_analytics_mvs.sql
-- Description: Materialized Views for Analytics (Module M8)
-- Dependencies: 009, 011, 025, 028_journals_schema.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== INVENTORY SNAPSHOT ====================
-- Aggregates current inventory valuation by item
-- Refresh Strategy: Nightly or On-Demand

DROP MATERIALIZED VIEW IF EXISTS mv_inventory_valuation;

CREATE MATERIALIZED VIEW mv_inventory_valuation AS
SELECT
  'RAW_MATERIAL' as inventory_type,
  m.company_id,
  m.id as item_id,
  m.name as item_name, -- Corrected column name
  m.code as sku,       -- Corrected column name
  Sum(COALESCE(ledger.qty_in, 0) - COALESCE(ledger.qty_out, 0)) as current_qty,
  MAX(m.standard_cost) as unit_cost, 
  (Sum(COALESCE(ledger.qty_in, 0) - COALESCE(ledger.qty_out, 0)) * MAX(m.standard_cost)) as total_value
FROM materials m -- Corrected table name
LEFT JOIN raw_material_ledger ledger ON ledger.material_id = m.id
GROUP BY m.company_id, m.id, m.name, m.code, m.standard_cost
UNION ALL
SELECT
  'FINISHED_GOODS' as inventory_type,
  p.company_id,
  p.id as item_id,
  p.sku as item_name, -- Use SKU as name since variant_name doesn't exist directly
  p.sku,
  Sum(COALESCE(ledger.qty_in, 0) - COALESCE(ledger.qty_out, 0)) as current_qty,
  MAX(p.unit_cost) as unit_cost, -- Corrected column name (unit_cost vs standard_cost)
  (Sum(COALESCE(ledger.qty_in, 0) - COALESCE(ledger.qty_out, 0)) * MAX(p.unit_cost)) as total_value
FROM product_variants p
LEFT JOIN finished_goods_ledger ledger ON ledger.product_variant_id = p.id
GROUP BY p.company_id, p.id, p.sku, p.unit_cost;

CREATE INDEX idx_mv_inv_val_company ON mv_inventory_valuation(company_id);
CREATE INDEX idx_mv_inv_val_type ON mv_inventory_valuation(inventory_type);

-- ==================== SALES PERFORMANCE ====================
-- Aggregates Sales from POS and Distributor (Invoices)

DROP MATERIALIZED VIEW IF EXISTS mv_sales_performance;

CREATE MATERIALIZED VIEW mv_sales_performance AS
WITH all_sales AS (
  -- POS Sales
  SELECT 
    company_id,
    date(sale_date) as sale_date, -- Corrected column name
    'POS' as channel,
    total_amount as revenue
  FROM sales_pos -- Corrected table name
  WHERE status = 'completed'
  
  UNION ALL
  
  -- Distributor (Invoices)
  SELECT 
    company_id,
    date(invoice_date) as sale_date,
    'DISTRIBUTOR' as channel,
    total_amount as revenue
  FROM sales_invoices
  WHERE status = 'posted'
  
  UNION ALL
  
  -- Placeholder for Marketplace 
  -- (Currently, MP orders are mapped to Sales Orders -> Sales Invoices, so they appear in Distributor)
  -- This block is for future direct MP sales if needed.
  SELECT 
    id as company_id, -- dummy fallback 
    current_date as sale_date, 
    'MARKETPLACE_DIRECT' as channel,
    0 as revenue
  FROM companies
  WHERE 1=0
)
SELECT 
  company_id,
  sale_date,
  channel,
  SUM(revenue) as daily_revenue,
  COUNT(*) as transaction_count
FROM all_sales
GROUP BY company_id, sale_date, channel;

CREATE INDEX idx_mv_sales_company_date ON mv_sales_performance(company_id, sale_date);

-- ==================== FINANCIAL SUMMARY ====================
-- Aggregates Period-to-Date metrics

DROP MATERIALIZED VIEW IF EXISTS mv_financial_summary;

CREATE MATERIALIZED VIEW mv_financial_summary AS
SELECT 
  je.company_id,
  p.name as period_name, -- Corrected column name
  p.start_date,
  p.end_date,
  coa.account_type, -- REVENUE, EXPENSE, ASSET...
  SUM(COALESCE(jel.credit,0) - COALESCE(jel.debit,0)) as net_credit_balance, -- Revenue usually Credit positive
  SUM(COALESCE(jel.debit,0) - COALESCE(jel.credit,0)) as net_debit_balance
FROM journals je -- Corrected table name
JOIN accounting_periods p ON p.id = je.period_id
JOIN journal_lines jel ON jel.journal_id = je.id -- Corrected table/column
JOIN chart_of_accounts coa ON coa.id = jel.account_id
WHERE je.status = 'posted'
GROUP BY je.company_id, p.name, p.start_date, p.end_date, coa.account_type;

CREATE INDEX idx_mv_fin_summary_comp ON mv_financial_summary(company_id);


-- ==================== REFRESH FUNCTION ====================

CREATE OR REPLACE FUNCTION refresh_analytics_mvs()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_inventory_valuation;
  REFRESH MATERIALIZED VIEW mv_sales_performance;
  REFRESH MATERIALIZED VIEW mv_financial_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
