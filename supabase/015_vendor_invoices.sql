-- Migration: 015_vendor_invoices.sql
-- Description: Vendor invoices with 3-way matching
-- Dependencies: 013_purchase_orders.sql, 014_goods_receipt_notes.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE invoice_status AS ENUM ('draft', 'posted', 'partial_paid', 'paid', 'cancelled');

-- ==================== VENDOR INVOICES ====================

CREATE TABLE IF NOT EXISTS vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) DEFAULT 1,
  
  -- Totals
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  
  -- Payment tracking
  amount_paid DECIMAL(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_outstanding DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount - amount_paid) STORED,
  
  status invoice_status DEFAULT 'draft',
  
  payment_terms payment_terms,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, vendor_id, invoice_number)
);

CREATE INDEX idx_invoice_company ON vendor_invoices(company_id);
CREATE INDEX idx_invoice_vendor ON vendor_invoices(vendor_id);
CREATE INDEX idx_invoice_po ON vendor_invoices(po_id);
CREATE INDEX idx_invoice_status ON vendor_invoices(status);
CREATE INDEX idx_invoice_date ON vendor_invoices(invoice_date DESC);
CREATE INDEX idx_invoice_due_date ON vendor_invoices(due_date);
CREATE INDEX idx_invoice_outstanding ON vendor_invoices(amount_outstanding) WHERE amount_outstanding > 0;

COMMENT ON TABLE vendor_invoices IS 'Vendor invoices (AP)';

-- ==================== VENDOR INVOICE LINES ====================

CREATE TABLE IF NOT EXISTS vendor_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES vendor_invoices(id) ON DELETE CASCADE NOT NULL,
  grn_line_id UUID REFERENCES grn_lines(id),
  po_line_id UUID REFERENCES purchase_order_lines(id),
  material_id UUID REFERENCES materials(id) NOT NULL,
  
  qty_invoiced DECIMAL(15,4) NOT NULL CHECK (qty_invoiced > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_invoiced * unit_price) STORED,
  
  -- Price variance detection
  po_unit_price DECIMAL(15,2),
  price_variance DECIMAL(15,2) GENERATED ALWAYS AS (
    (unit_price - COALESCE(po_unit_price, 0)) * qty_invoiced
  ) STORED,
  variance_approved BOOLEAN DEFAULT false,
  
  notes TEXT
);

CREATE INDEX idx_invoice_lines_invoice ON vendor_invoice_lines(invoice_id);
CREATE INDEX idx_invoice_lines_grn ON vendor_invoice_lines(grn_line_id);
CREATE INDEX idx_invoice_lines_po_line ON vendor_invoice_lines(po_line_id);
CREATE INDEX idx_invoice_lines_variance ON vendor_invoice_lines(price_variance) WHERE ABS(price_variance) > 0;

COMMENT ON TABLE vendor_invoice_lines IS 'Invoice line items with variance tracking';

-- ==================== TRIGGERS ====================

-- Auto-update invoice subtotal
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE vendor_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM vendor_invoice_lines
    WHERE invoice_id = v_invoice_id
  )
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_total_insert
  AFTER INSERT ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_update
  AFTER UPDATE ON vendor_invoice_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_delete
  AFTER DELETE ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- Validate 3-way matching
CREATE OR REPLACE FUNCTION validate_3way_match()
RETURNS TRIGGER AS $$
DECLARE
  v_grn_qty DECIMAL(15,4);
  v_po_price DECIMAL(15,2);
  v_variance_pct DECIMAL(5,2);
BEGIN
  -- Check GRN quantity
  IF NEW.grn_line_id IS NOT NULL THEN
    SELECT qty_received INTO v_grn_qty
    FROM grn_lines
    WHERE id = NEW.grn_line_id;
    
    IF NEW.qty_invoiced > v_grn_qty THEN
      RAISE EXCEPTION 'Invoice quantity (%) exceeds GRN quantity (%)', 
        NEW.qty_invoiced, v_grn_qty;
    END IF;
  END IF;
  
  -- Check price variance (if PO exists)
  IF NEW.po_line_id IS NOT NULL THEN
    SELECT unit_price INTO v_po_price
    FROM purchase_order_lines
    WHERE id = NEW.po_line_id;
    
    NEW.po_unit_price := v_po_price;
    
    -- Calculate variance percentage
    IF v_po_price > 0 THEN
      v_variance_pct := ABS((NEW.unit_price - v_po_price) / v_po_price * 100);
      
      -- Require approval if variance > 5%
      IF v_variance_pct > 5 AND NOT NEW.variance_approved THEN
        RAISE EXCEPTION 'Price variance (%.2f%%) exceeds tolerance (5%%). Approval required.', 
          v_variance_pct;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_3way_match
  BEFORE INSERT OR UPDATE ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_3way_match();

-- Update PO qty_invoiced
CREATE OR REPLACE FUNCTION update_po_qty_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.po_line_id IS NOT NULL THEN
    UPDATE purchase_order_lines
    SET qty_invoiced = qty_invoiced + NEW.qty_invoiced
    WHERE id = NEW.po_line_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_qty_invoiced
  AFTER INSERT ON vendor_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_qty_invoiced();

-- ==================== RLS POLICIES ====================

ALTER TABLE vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_tenant_isolation ON vendor_invoices
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY invoice_lines_tenant ON vendor_invoice_lines
  FOR ALL USING (invoice_id IN (
    SELECT id FROM vendor_invoices WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY invoice_service_role ON vendor_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY invoice_lines_service_role ON vendor_invoice_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== VIEWS ====================

-- AP Aging
CREATE VIEW ap_aging_vw AS
SELECT 
  vi.company_id,
  vi.vendor_id,
  v.code as vendor_code,
  v.name as vendor_name,
  vi.id as invoice_id,
  vi.invoice_number,
  vi.invoice_date,
  vi.due_date,
  vi.total_amount,
  vi.amount_paid,
  vi.amount_outstanding,
  
  CASE 
    WHEN CURRENT_DATE <= vi.due_date THEN 'current'
    WHEN CURRENT_DATE - vi.due_date <= 30 THEN '1-30 days'
    WHEN CURRENT_DATE - vi.due_date <= 60 THEN '31-60 days'
    WHEN CURRENT_DATE - vi.due_date <= 90 THEN '61-90 days'
    ELSE 'over 90 days'
  END as aging_bucket,
  
  CURRENT_DATE - vi.due_date as days_overdue
  
FROM vendor_invoices vi
JOIN vendors v ON v.id = vi.vendor_id
WHERE vi.status IN ('posted', 'partial_paid')
  AND vi.amount_outstanding > 0;

COMMENT ON VIEW ap_aging_vw IS 'Accounts Payable aging analysis';

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON vendor_invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
