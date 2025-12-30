-- Migration: 058_margin_and_period_lock.sql
-- Description: Margin Analysis View and Robust Period Locking
-- Author: Ziyada ERP Team
-- Date: 2025-12-30

-- ==================== MARGIN ANALYSIS VIEW ====================

CREATE OR REPLACE VIEW sales_margin_analysis_vw AS
SELECT 
  si.company_id,
  si.id as invoice_id,
  si.invoice_number,
  si.invoice_date,
  si.customer_id,
  c.name as customer_name,
  sil.product_variant_id,
  p.name as product_name,
  pv.sku,
  
  -- Sales Info
  sil.qty_invoiced,
  sil.unit_price as unit_sales_price,
  sil.line_total as revenue,
  
  -- Cost Info (from Ledger linked via DO)
  COALESCE(ledger_cost.total_cogs, 0) as cogs,
  COALESCE(ledger_cost.avg_unit_cost, 0) as unit_cost,
  
  -- Margin Calculation
  (sil.line_total - COALESCE(ledger_cost.total_cogs, 0)) as margin,
  CASE 
    WHEN sil.line_total > 0 THEN 
      ROUND(((sil.line_total - COALESCE(ledger_cost.total_cogs, 0)) / sil.line_total * 100), 2)
    ELSE 0 
  END as margin_percentage

FROM sales_invoices si
JOIN sales_invoice_lines sil ON sil.invoice_id = si.id
JOIN customers c ON c.id = si.customer_id
JOIN product_variants pv ON pv.id = sil.product_variant_id
JOIN products p ON p.id = pv.product_id
LEFT JOIN delivery_note_lines dnl ON dnl.id = sil.do_line_id
LEFT JOIN (
  -- Aggregate ledger entries in case of split-bin issues (1:N robustness)
  SELECT 
    reference_id, -- DO ID
    product_variant_id,
    SUM(qty_out) as total_qty,
    SUM(ABS(total_cost)) as total_cogs,
    CASE 
        WHEN SUM(qty_out) > 0 THEN SUM(ABS(total_cost)) / SUM(qty_out)
        ELSE 0 
    END as avg_unit_cost
  FROM finished_goods_ledger
  WHERE reference_type = 'DELIVERY_NOTE'
  GROUP BY reference_id, product_variant_id
) ledger_cost ON 
    ledger_cost.reference_id = dnl.do_id AND 
    ledger_cost.product_variant_id = pv.id

WHERE si.status = 'posted';

COMMENT ON VIEW sales_margin_analysis_vw IS 'Margin analysis joining Invoices, DOs, and Ledger Costs';

-- ==================== PERIOD LOCK ENFORCEMENT (DOCUMENTS) ====================
-- Extending period lock to Document Headers to prevent backdating at the source

-- 1. Sales Invoices
CREATE TRIGGER enforce_period_lock_invoice_header
  BEFORE INSERT OR UPDATE OF invoice_date ON sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

-- 2. Purchase Orders
CREATE TRIGGER enforce_period_lock_po_header
  BEFORE INSERT OR UPDATE OF po_date ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

-- 3. Delivery Notes
CREATE TRIGGER enforce_period_lock_do_header
  BEFORE INSERT OR UPDATE OF do_date ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

-- 4. Goods Receipt Notes
CREATE TRIGGER enforce_period_lock_grn_header
  BEFORE INSERT OR UPDATE OF received_date ON goods_receipt_notes
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

-- 5. Production Orders
CREATE TRIGGER enforce_period_lock_wo_header
  BEFORE INSERT OR UPDATE OF planned_start_date ON production_orders
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();
