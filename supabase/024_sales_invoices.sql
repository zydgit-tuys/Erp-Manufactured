-- Migration: 024_sales_invoices.sql
-- Description: Sales Invoices and Accounts Receivable
-- Dependencies: 022_sales_orders.sql, 023_delivery_notes.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== SALES INVOICES ====================

CREATE TABLE IF NOT EXISTS sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  so_id UUID REFERENCES sales_orders(id),  -- Optional reference
  do_id UUID REFERENCES delivery_notes(id),  -- Optional reference
  customer_id UUID REFERENCES customers(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal - discount_amount + tax_amount) STORED,
  
  -- Payment tracking
  payment_status VARCHAR(20) DEFAULT 'unpaid',  -- unpaid, partial, paid, overdue
  amount_paid DECIMAL(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
  amount_due DECIMAL(15,2) GENERATED ALWAYS AS (
    subtotal - discount_amount + tax_amount - amount_paid
  ) STORED,
  
  -- Terms
  payment_terms VARCHAR(20),
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',  -- draft, posted, void
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_invoice_status CHECK (status IN ('draft', 'posted', 'void')),
  CONSTRAINT valid_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overdue'))
);

CREATE INDEX IF NOT EXISTS idx_invoice_company ON sales_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_so ON sales_invoices(so_id);
CREATE INDEX IF NOT EXISTS idx_invoice_do ON sales_invoices(do_id);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON sales_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_due_date ON sales_invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_payment_status ON sales_invoices(payment_status);

COMMENT ON TABLE sales_invoices IS 'Sales invoices for credit sales';

-- ==================== SALES INVOICE LINES ====================

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  so_line_id UUID REFERENCES sales_order_lines(id),
  do_line_id UUID REFERENCES delivery_note_lines(id),
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty_invoiced DECIMAL(15,4) NOT NULL CHECK (qty_invoiced > 0),
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    qty_invoiced * unit_price * (1 - discount_percentage / 100)
  ) STORED,
  
  notes TEXT,
  
  UNIQUE(invoice_id, line_number)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON sales_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_so_line ON sales_invoice_lines(so_line_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_do_line ON sales_invoice_lines(do_line_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_variant ON sales_invoice_lines(product_variant_id);

COMMENT ON TABLE sales_invoice_lines IS 'Sales invoice line items';

-- ==================== TRIGGERS ====================

-- Auto-update invoice subtotal
CREATE OR REPLACE FUNCTION update_invoice_total()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE sales_invoices
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM sales_invoice_lines
    WHERE invoice_id = v_invoice_id
  )
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_total_insert
  AFTER INSERT ON sales_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_update
  AFTER UPDATE ON sales_invoice_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_invoice_total();

CREATE TRIGGER trigger_update_invoice_total_delete
  AFTER DELETE ON sales_invoice_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_total();

-- Auto-update payment status based on amount paid
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount_paid >= NEW.total_amount THEN
    NEW.payment_status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.payment_status := 'partial';
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_paid = 0 THEN
    NEW.payment_status := 'overdue';
  ELSE
    NEW.payment_status := 'unpaid';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_status
  BEFORE UPDATE OF amount_paid ON sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_status();

-- ==================== POST INVOICE (Create AR) ====================

-- Post sales invoice (create AR liability)
CREATE OR REPLACE FUNCTION post_sales_invoice(
  p_invoice_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice
  FROM sales_invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  IF v_invoice.status = 'posted' THEN
    RAISE EXCEPTION 'Invoice already posted';
  END IF;
  
  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'Cannot post voided invoice';
  END IF;
  
  -- Update SO line qty_invoiced if linked
  IF v_invoice.so_id IS NOT NULL THEN
    UPDATE sales_order_lines sol
    SET qty_invoiced = qty_invoiced + (
      SELECT COALESCE(SUM(sil.qty_invoiced), 0)
      FROM sales_invoice_lines sil
      WHERE sil.invoice_id = p_invoice_id
        AND sil.so_line_id = sol.id
    )
    WHERE so_id = v_invoice.so_id;
  END IF;
  
  -- Update invoice status
  UPDATE sales_invoices
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_invoice_id;
  
  -- TODO: Create journal entry
  -- Dr. Accounts Receivable    total_amount
  --   Cr. Sales Revenue         subtotal
  --   Cr. Sales Tax Payable     tax_amount
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_sales_invoice IS 'Post sales invoice: create AR, update SO, create journal entry';

-- ==================== VIEWS ====================

-- AR Aging (Unpaid Invoices by Age)
CREATE VIEW ar_aging_vw AS
SELECT 
  si.company_id,
  si.customer_id,
  c.name as customer_name,
  si.id as invoice_id,
  si.invoice_number,
  si.invoice_date,
  si.due_date,
  si.total_amount,
  si.amount_paid,
  si.amount_due,
  CURRENT_DATE - si.due_date as days_overdue,
  CASE 
    WHEN CURRENT_DATE <= si.due_date THEN 'Current'
    WHEN CURRENT_DATE - si.due_date BETWEEN 1 AND 30 THEN '1-30 Days'
    WHEN CURRENT_DATE - si.due_date BETWEEN 31 AND 60 THEN '31-60 Days'
    WHEN CURRENT_DATE - si.due_date BETWEEN 61 AND 90 THEN '61-90 Days'
    ELSE '90+ Days'
  END as aging_bucket,
  CASE 
    WHEN CURRENT_DATE <= si.due_date THEN 0
    WHEN CURRENT_DATE - si.due_date BETWEEN 1 AND 30 THEN 1
    WHEN CURRENT_DATE - si.due_date BETWEEN 31 AND 60 THEN 2
    WHEN CURRENT_DATE - si.due_date BETWEEN 61 AND 90 THEN 3
    ELSE 4
  END as aging_bucket_order
FROM sales_invoices si
JOIN customers c ON c.id = si.customer_id
WHERE si.status = 'posted' AND si.amount_due > 0
ORDER BY si.customer_id, aging_bucket_order, si.due_date;

COMMENT ON VIEW ar_aging_vw IS 'AR aging report with unpaid invoices by age bucket';

-- Customer AR Balance
CREATE VIEW customer_ar_balance_vw AS
SELECT 
  c.id as customer_id,
  c.company_id,
  c.name as customer_name,
  c.credit_limit,
  COUNT(si.id) as invoice_count,
  COALESCE(SUM(si.total_amount), 0) as total_invoiced,
  COALESCE(SUM(si.amount_paid), 0) as total_paid,
  COALESCE(SUM(si.amount_due), 0) as total_ar_balance,
  COALESCE(SUM(CASE WHEN si.payment_status = 'overdue' THEN si.amount_due ELSE 0 END), 0) as overdue_amount,
  c.credit_limit - COALESCE(SUM(si.amount_due), 0) as available_credit
FROM customers c
LEFT JOIN sales_invoices si ON si.customer_id = c.id 
  AND si.status = 'posted' 
  AND si.amount_due > 0
GROUP BY c.id, c.company_id, c.name, c.credit_limit;

COMMENT ON VIEW customer_ar_balance_vw IS 'Customer AR balance summary';

-- Overdue Invoices Alert
CREATE VIEW overdue_invoices_vw AS
SELECT 
  si.company_id,
  si.id as invoice_id,
  si.invoice_number,
  si.invoice_date,
  si.due_date,
  si.customer_id,
  c.name as customer_name,
  si.total_amount,
  si.amount_due,
  CURRENT_DATE - si.due_date as days_overdue,
  CASE 
    WHEN CURRENT_DATE - si.due_date > 90 THEN 'Critical'
    WHEN CURRENT_DATE - si.due_date > 60 THEN 'High'
    WHEN CURRENT_DATE - si.due_date > 30 THEN 'Medium'
    ELSE 'Low'
  END as priority
FROM sales_invoices si
JOIN customers c ON c.id = si.customer_id
WHERE si.status = 'posted' 
  AND si.amount_due > 0
  AND si.due_date < CURRENT_DATE
ORDER BY days_overdue DESC, si.amount_due DESC;

COMMENT ON VIEW overdue_invoices_vw IS 'Overdue invoices alert list';

-- Invoice Summary
CREATE VIEW sales_invoice_summary_vw AS
SELECT 
  si.id,
  si.company_id,
  si.invoice_number,
  si.invoice_date,
  si.due_date,
  si.customer_id,
  c.name as customer_name,
  si.so_id,
  so.so_number,
  si.do_id,
  dn.do_number,
  si.total_amount,
  si.amount_paid,
  si.amount_due,
  si.payment_status,
  si.status,
  si.payment_terms,
  COUNT(sil.id) as line_count,
  SUM(sil.qty_invoiced) as total_qty
FROM sales_invoices si
JOIN customers c ON c.id = si.customer_id
LEFT JOIN sales_orders so ON so.id = si.so_id
LEFT JOIN delivery_notes dn ON dn.id = si.do_id
LEFT JOIN sales_invoice_lines sil ON sil.invoice_id = si.id
GROUP BY si.id, si.company_id, si.invoice_number, si.invoice_date,
         si.due_date, si.customer_id, c.name, si.so_id, so.so_number,
         si.do_id, dn.do_number, si.total_amount, si.amount_paid,
         si.amount_due, si.payment_status, si.status, si.payment_terms;

COMMENT ON VIEW sales_invoice_summary_vw IS 'Sales invoice summary with details';

-- ==================== RLS POLICIES ====================

ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_tenant_isolation ON sales_invoices
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY invoice_lines_tenant ON sales_invoice_lines
  FOR ALL USING (invoice_id IN (
    SELECT id FROM sales_invoices WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY invoice_service_role ON sales_invoices FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY invoice_lines_service_role ON sales_invoice_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_invoice
  AFTER INSERT OR UPDATE OR DELETE ON sales_invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== ENHANCE CREDIT CHECK (from migration 022) ====================

-- First add credit_hold column to customers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'credit_hold'
  ) THEN
    ALTER TABLE customers ADD COLUMN credit_hold BOOLEAN DEFAULT false;
    COMMENT ON COLUMN customers.credit_hold IS 'If true, blocks new sales orders and deliveries';
  END IF;
END $$;

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS check_customer_credit_limit(UUID, DECIMAL);

-- Update credit check function to include AR from invoices and credit_hold
CREATE OR REPLACE FUNCTION check_customer_credit_limit(
  p_customer_id UUID,
  p_new_order_amount DECIMAL
)
RETURNS TABLE(
  credit_limit DECIMAL,
  current_ar_balance DECIMAL,
  available_credit DECIMAL,
  new_total DECIMAL,
  credit_exceeded BOOLEAN,
  credit_hold BOOLEAN
) AS $$
DECLARE
  v_customer RECORD;
  v_current_ar DECIMAL;
BEGIN
  -- Get customer info
  SELECT 
    COALESCE(c.credit_limit, 0) as credit_limit,
    COALESCE(c.credit_hold, false) as credit_hold
  INTO v_customer
  FROM customers c
  WHERE c.id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;
  
  -- Calculate current AR balance (unpaid invoices)
  SELECT COALESCE(SUM(amount_due), 0)
  INTO v_current_ar
  FROM sales_invoices
  WHERE customer_id = p_customer_id
    AND status = 'posted'
    AND amount_due > 0;
  
  -- Add pending SOs (approved but not yet invoiced)
  SELECT v_current_ar + COALESCE(SUM(total_amount), 0)
  INTO v_current_ar
  FROM sales_orders
  WHERE customer_id = p_customer_id
    AND status IN ('approved', 'sent', 'in_delivery');
  
  -- Return results
  RETURN QUERY SELECT
    v_customer.credit_limit,
    v_current_ar,
    v_customer.credit_limit - v_current_ar as available_credit,
    v_current_ar + p_new_order_amount as new_total,
    (v_current_ar + p_new_order_amount) > v_customer.credit_limit as credit_exceeded,
    v_customer.credit_hold;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_customer_credit_limit IS 'Check customer credit limit including invoices and pending SOs (enhanced)';

-- Update credit status view to include AR
DROP VIEW IF EXISTS customer_credit_status_vw;

CREATE VIEW customer_credit_status_vw AS
SELECT 
  c.id as customer_id,
  c.company_id,
  c.name as customer_name,
  c.credit_limit,
  c.credit_hold,
  c.payment_terms as default_payment_terms,
  COALESCE(SUM(CASE WHEN si.status = 'posted' AND si.amount_due > 0 THEN si.amount_due ELSE 0 END), 0) as current_ar_balance,
  COALESCE(SUM(CASE WHEN so.status IN ('approved', 'sent', 'in_delivery') THEN so.total_amount ELSE 0 END), 0) as pending_so_amount,
  c.credit_limit - COALESCE(SUM(CASE WHEN si.status = 'posted' AND si.amount_due > 0 THEN si.amount_due ELSE 0 END), 0) as available_credit,
  CASE 
    WHEN c.credit_hold THEN 'On Hold'
    WHEN COALESCE(SUM(CASE WHEN si.status = 'posted' AND si.amount_due > 0 THEN si.amount_due ELSE 0 END), 0) > c.credit_limit THEN 'Exceeded'
    WHEN COALESCE(SUM(CASE WHEN si.status = 'posted' AND si.amount_due > 0 THEN si.amount_due ELSE 0 END), 0) > c.credit_limit * 0.8 THEN 'Near Limit'
    ELSE 'Good'
  END as credit_status
FROM customers c
LEFT JOIN sales_invoices si ON si.customer_id = c.id
LEFT JOIN sales_orders so ON so.customer_id = c.id
GROUP BY c.id, c.company_id, c.name, c.credit_limit, c.credit_hold, c.payment_terms;

COMMENT ON VIEW customer_credit_status_vw IS 'Customer credit status with AR and available credit (enhanced)';
