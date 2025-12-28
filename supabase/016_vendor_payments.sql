-- Migration: 016_vendor_payments.sql
-- Description: Vendor payment tracking with invoice allocation
-- Dependencies: 015_vendor_invoices.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE payment_method AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'GIRO', 'CREDIT_CARD');
CREATE TYPE payment_status AS ENUM ('draft', 'posted', 'cancelled', 'cleared');

-- ==================== VENDOR PAYMENTS ====================

CREATE TABLE IF NOT EXISTS vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  payment_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  payment_method payment_method NOT NULL,
  bank_account_id UUID, -- FK to chart_of_accounts (cash/bank accounts)
  reference_number VARCHAR(100), -- Check number, transfer reference, etc
  
  total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount > 0),
  
  status payment_status DEFAULT 'draft',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  cleared_at TIMESTAMPTZ,
  cleared_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payment_company ON vendor_payments(company_id);
CREATE INDEX idx_payment_vendor ON vendor_payments(vendor_id);
CREATE INDEX idx_payment_status ON vendor_payments(status);
CREATE INDEX idx_payment_date ON vendor_payments(payment_date DESC);
CREATE INDEX idx_payment_method ON vendor_payments(payment_method);

COMMENT ON TABLE vendor_payments IS 'Vendor payment header';

-- ==================== PAYMENT ALLOCATIONS ====================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES vendor_payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES vendor_invoices(id) NOT NULL,
  
  amount_allocated DECIMAL(15,2) NOT NULL CHECK (amount_allocated > 0),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_allocation_payment ON payment_allocations(payment_id);
CREATE INDEX idx_allocation_invoice ON payment_allocations(invoice_id);

COMMENT ON TABLE payment_allocations IS 'Payment allocation to invoices (many-to-many)';

-- ==================== TRIGGERS ====================

-- Validate allocation amount
CREATE OR REPLACE FUNCTION validate_payment_allocation()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_outstanding DECIMAL(15,2);
  v_total_allocated DECIMAL(15,2);
  v_payment_total DECIMAL(15,2);
BEGIN
  -- Check invoice outstanding
  SELECT amount_outstanding INTO v_invoice_outstanding
  FROM vendor_invoices
  WHERE id = NEW.invoice_id;
  
  -- Get total already allocated to this invoice
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE invoice_id = NEW.invoice_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Check if new allocation exceeds outstanding
  IF v_total_allocated + NEW.amount_allocated > v_invoice_outstanding THEN
    RAISE EXCEPTION 'Allocation (%) exceeds invoice outstanding (%)', 
      NEW.amount_allocated, v_invoice_outstanding - v_total_allocated;
  END IF;
  
  -- Check if total allocations exceed payment amount
  SELECT total_amount INTO v_payment_total
  FROM vendor_payments
  WHERE id = NEW.payment_id;
  
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_allocated
  FROM payment_allocations
  WHERE payment_id = NEW.payment_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF v_total_allocated + NEW.amount_allocated > v_payment_total THEN
    RAISE EXCEPTION 'Total allocations (%) exceed payment amount (%)', 
      v_total_allocated + NEW.amount_allocated, v_payment_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_payment_allocation
  BEFORE INSERT OR UPDATE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_allocation();

-- Update invoice payment status
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id UUID;
  v_total_paid DECIMAL(15,2);
  v_total_amount DECIMAL(15,2);
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate total paid
  SELECT COALESCE(SUM(amount_allocated), 0) INTO v_total_paid
  FROM payment_allocations
  WHERE invoice_id = v_invoice_id;
  
  -- Get invoice total
  SELECT subtotal + tax_amount INTO v_total_amount
  FROM vendor_invoices
  WHERE id = v_invoice_id;
  
  -- Update invoice
  UPDATE vendor_invoices
  SET 
    amount_paid = v_total_paid,
    status = CASE
      WHEN v_total_paid >= v_total_amount THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial_paid'
      ELSE status
    END
  WHERE id = v_invoice_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_payment_insert
  AFTER INSERT ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

CREATE TRIGGER trigger_update_invoice_payment_delete
  AFTER DELETE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_payment_status();

-- ==================== RLS POLICIES ====================

ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_tenant_isolation ON vendor_payments
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY allocation_tenant ON payment_allocations
  FOR ALL USING (payment_id IN (
    SELECT id FROM vendor_payments WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY payment_service_role ON vendor_payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY allocation_service_role ON payment_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== VIEWS ====================

-- Payment summary
CREATE VIEW payment_summary_vw AS
SELECT 
  vp.id,
  vp.company_id,
  vp.payment_number,
  vp.payment_date,
  v.code as vendor_code,
  v.name as vendor_name,
  vp.payment_method,
  vp.total_amount,
  COALESCE(SUM(pa.amount_allocated), 0) as amount_allocated,
  vp.total_amount - COALESCE(SUM(pa.amount_allocated), 0) as amount_unallocated,
  COUNT(pa.id) as invoice_count
FROM vendor_payments vp
JOIN vendors v ON v.id = vp.vendor_id
LEFT JOIN payment_allocations pa ON pa.payment_id = vp.id
WHERE vp.status != 'cancelled'
GROUP BY vp.id, v.code, v.name;

COMMENT ON VIEW payment_summary_vw IS 'Payment summary with allocation details';

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON vendor_payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
