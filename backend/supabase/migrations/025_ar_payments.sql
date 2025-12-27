-- Migration: 025_ar_payments.sql
-- Description: AR Payments and allocation to invoices
-- Dependencies: 024_sales_invoices.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== AR PAYMENTS ====================

CREATE TABLE IF NOT EXISTS ar_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  payment_date DATE NOT NULL,
  
  customer_id UUID REFERENCES customers(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Payment details
  amount_received DECIMAL(15,2) NOT NULL CHECK (amount_received > 0),
  amount_allocated DECIMAL(15,2) DEFAULT 0 CHECK (amount_allocated >= 0),
  amount_unallocated DECIMAL(15,2) GENERATED ALWAYS AS (amount_received - amount_allocated) STORED,
  
  payment_method VARCHAR(50) NOT NULL,  -- Cash, Transfer, Check, Card
  reference_number VARCHAR(100),  -- Bank transfer ref, check number, etc.
  bank_account VARCHAR(100),  -- Receiving bank account
  
  -- Early payment discount
  discount_taken DECIMAL(15,2) DEFAULT 0 CHECK (discount_taken >= 0),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('Cash', 'Transfer', 'Check', 'Card', 'Other'))
);

CREATE INDEX IF NOT EXISTS idx_ar_payment_company ON ar_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_payment_customer ON ar_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_ar_payment_date ON ar_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_ar_payment_period ON ar_payments(period_id);

COMMENT ON TABLE ar_payments IS 'Customer payments (AR receipts)';
COMMENT ON COLUMN ar_payments.amount_unallocated IS 'Amount not yet allocated to invoices';

-- ==================== AR PAYMENT ALLOCATIONS ====================

CREATE TABLE IF NOT EXISTS ar_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES ar_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES sales_invoices(id) ON DELETE CASCADE NOT NULL,
  
  amount_allocated DECIMAL(15,2) NOT NULL CHECK (amount_allocated > 0),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_allocation_payment ON ar_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocation_invoice ON ar_payment_allocations(invoice_id);

COMMENT ON TABLE ar_payment_allocations IS 'Allocation of payments to specific invoices';

-- ==================== TRIGGERS ====================

-- Auto-update payment allocated amount
CREATE OR REPLACE FUNCTION update_payment_allocated()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  v_payment_id := COALESCE(NEW.payment_id, OLD.payment_id);
  
  UPDATE ar_payments
  SET amount_allocated = (
    SELECT COALESCE(SUM(amount_allocated), 0)
    FROM ar_payment_allocations
    WHERE payment_id = v_payment_id
  )
  WHERE id = v_payment_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_allocated_insert
  AFTER INSERT ON ar_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_allocated();

CREATE TRIGGER trigger_update_payment_allocated_update
  AFTER UPDATE ON ar_payment_allocations
  FOR EACH ROW
  WHEN (OLD.amount_allocated IS DISTINCT FROM NEW.amount_allocated)
  EXECUTE FUNCTION update_payment_allocated();

CREATE TRIGGER trigger_update_payment_allocated_delete
  AFTER DELETE ON ar_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_allocated();

-- Auto-update invoice amount_paid
CREATE OR REPLACE FUNCTION update_invoice_amount_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  UPDATE sales_invoices
  SET amount_paid = (
    SELECT COALESCE(SUM(amount_allocated), 0)
    FROM ar_payment_allocations
    WHERE invoice_id = v_invoice_id
  )
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_paid_insert
  AFTER INSERT ON ar_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_amount_paid();

CREATE TRIGGER trigger_update_invoice_paid_update
  AFTER UPDATE ON ar_payment_allocations
  FOR EACH ROW
  WHEN (OLD.amount_allocated IS DISTINCT FROM NEW.amount_allocated)
  EXECUTE FUNCTION update_invoice_amount_paid();

CREATE TRIGGER trigger_update_invoice_paid_delete
  AFTER DELETE ON ar_payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_amount_paid();

-- ==================== PAYMENT ALLOCATION FUNCTIONS ====================

-- Allocate payment to specific invoice
CREATE OR REPLACE FUNCTION allocate_payment_to_invoice(
  p_payment_id UUID,
  p_invoice_id UUID,
  p_amount DECIMAL,
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment
  FROM ar_payments
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  -- Get invoice details
  SELECT * INTO v_invoice
  FROM sales_invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  -- Validate customer match
  IF v_payment.customer_id != v_invoice.customer_id THEN
    RAISE EXCEPTION 'Payment and invoice must be for the same customer';
  END IF;
  
  -- Validate invoice is posted
  IF v_invoice.status != 'posted' THEN
    RAISE EXCEPTION 'Can only allocate payments to posted invoices';
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Allocation amount must be positive';
  END IF;
  
  -- Check if enough unallocated amount
  IF p_amount > v_payment.amount_unallocated THEN
    RAISE EXCEPTION 'Allocation amount (%) exceeds unallocated payment amount (%)',
      p_amount, v_payment.amount_unallocated;
  END IF;
  
  -- Check if invoice already fully paid
  IF v_invoice.amount_due <= 0 THEN
    RAISE EXCEPTION 'Invoice is already fully paid';
  END IF;
  
  -- Prevent over-allocation to invoice
  IF p_amount > v_invoice.amount_due THEN
    RAISE EXCEPTION 'Allocation amount (%) exceeds invoice amount due (%)',
      p_amount, v_invoice.amount_due;
  END IF;
  
  -- Create allocation (or update if exists)
  INSERT INTO ar_payment_allocations (
    payment_id,
    invoice_id,
    amount_allocated,
    created_by
  )
  VALUES (
    p_payment_id,
    p_invoice_id,
    p_amount,
    p_user_id
  )
  ON CONFLICT (payment_id, invoice_id)
  DO UPDATE SET
    amount_allocated = ar_payment_allocations.amount_allocated + p_amount;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION allocate_payment_to_invoice IS 'Allocate payment to specific invoice with validation';

-- Auto-allocate payment to oldest invoices (FIFO)
CREATE OR REPLACE FUNCTION auto_allocate_payment(
  p_payment_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  invoice_id UUID,
  invoice_number VARCHAR,
  amount_allocated DECIMAL
) AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_remaining DECIMAL;
  v_to_allocate DECIMAL;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment
  FROM ar_payments
  WHERE id = p_payment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  v_remaining := v_payment.amount_unallocated;
  
  IF v_remaining <= 0 THEN
    RAISE NOTICE 'Payment already fully allocated';
    RETURN;
  END IF;
  
  -- Loop through unpaid invoices from oldest to newest (FIFO)
  FOR v_invoice IN
    SELECT si.id, si.invoice_number, si.amount_due, si.due_date
    FROM sales_invoices si
    WHERE si.customer_id = v_payment.customer_id
      AND si.status = 'posted'
      AND si.amount_due > 0
    ORDER BY si.due_date ASC, si.invoice_date ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    -- Allocate min(remaining payment, invoice due amount)
    v_to_allocate := LEAST(v_remaining, v_invoice.amount_due);
    
    -- Create allocation
    PERFORM allocate_payment_to_invoice(
      p_payment_id,
      v_invoice.id,
      v_to_allocate,
      p_user_id
    );
    
    -- Reduce remaining
    v_remaining := v_remaining - v_to_allocate;
    
    -- Return allocation info
    RETURN QUERY SELECT
      v_invoice.id,
      v_invoice.invoice_number,
      v_to_allocate;
  END LOOP;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_allocate_payment IS 'Auto-allocate payment to oldest unpaid invoices (FIFO)';

-- ==================== VIEWS ====================

-- Payment Summary
CREATE VIEW ar_payment_summary_vw AS
SELECT 
  p.id,
  p.company_id,
  p.payment_number,
  p.payment_date,
  p.customer_id,
  c.name as customer_name,
  p.amount_received,
  p.amount_allocated,
  p.amount_unallocated,
  p.payment_method,
  p.reference_number,
  COUNT(pa.id) as invoice_count,
  CASE 
    WHEN p.amount_unallocated = 0 THEN 'Fully Allocated'
    WHEN p.amount_allocated = 0 THEN 'Unallocated'
    ELSE 'Partially Allocated'
  END as allocation_status
FROM ar_payments p
JOIN customers c ON c.id = p.customer_id
LEFT JOIN ar_payment_allocations pa ON pa.payment_id = p.id
GROUP BY p.id, p.company_id, p.payment_number, p.payment_date,
         p.customer_id, c.name, p.amount_received, p.amount_allocated,
         p.amount_unallocated, p.payment_method, p.reference_number;

COMMENT ON VIEW ar_payment_summary_vw IS 'Payment summary with allocation status';

-- Payment Allocation Details
CREATE VIEW payment_allocation_details_vw AS
SELECT 
  pa.id,
  pa.payment_id,
  p.payment_number,
  p.payment_date,
  pa.invoice_id,
  si.invoice_number,
  si.invoice_date,
  si.due_date,
  pa.amount_allocated,
  si.total_amount as invoice_total,
  si.amount_due as invoice_remaining,
  p.customer_id,
  c.name as customer_name,
  pa.created_at
FROM ar_payment_allocations pa
JOIN ar_payments p ON p.id = pa.payment_id
JOIN sales_invoices si ON si.id = pa.invoice_id
JOIN customers c ON c.id = p.customer_id
ORDER BY p.payment_date DESC, pa.created_at DESC;

COMMENT ON VIEW payment_allocation_details_vw IS 'Detailed view of payment allocations';

-- Unallocated Payments
CREATE VIEW unallocated_payments_vw AS
SELECT 
  p.id,
  p.company_id,
  p.payment_number,
  p.payment_date,
  p.customer_id,
  c.name as customer_name,
  p.amount_received,
  p.amount_allocated,
  p.amount_unallocated,
  p.payment_method,
  CURRENT_DATE - p.payment_date as days_unallocated
FROM ar_payments p
JOIN customers c ON c.id = p.customer_id
WHERE p.amount_unallocated > 0
ORDER BY p.payment_date;

COMMENT ON VIEW unallocated_payments_vw IS 'Payments with unallocated amounts';

-- ==================== RLS POLICIES ====================

ALTER TABLE ar_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ar_payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_tenant_isolation ON ar_payments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY allocation_tenant ON ar_payment_allocations
  FOR ALL USING (payment_id IN (
    SELECT id FROM ar_payments WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY payment_service_role ON ar_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allocation_service_role ON ar_payment_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_payment
  AFTER INSERT OR UPDATE OR DELETE ON ar_payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_allocation
  AFTER INSERT OR UPDATE OR DELETE ON ar_payment_allocations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
