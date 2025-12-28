-- Migration: 026_credit_management_polish.sql
-- Description: Credit management enhancements and credit_hold enforcement
-- Dependencies: 024_sales_invoices.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== CREDIT MANAGEMENT ENHANCEMENTS ====================

-- Update approve_sales_order to enforce credit_hold
CREATE OR REPLACE FUNCTION approve_sales_order(
  p_so_id UUID,
  p_user_id UUID,
  p_override_credit BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
DECLARE
  v_so RECORD;
  v_credit_check RECORD;
BEGIN
  -- Get SO details
  SELECT * INTO v_so
  FROM sales_orders
  WHERE id = p_so_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;
  
  IF v_so.status != 'draft' THEN
    RAISE EXCEPTION 'Sales order must be in draft status to approve';
  END IF;
  
  -- Check credit limit (unless override)
  IF NOT p_override_credit THEN
    SELECT * INTO v_credit_check
    FROM check_customer_credit_limit(v_so.customer_id, v_so.total_amount);
    
    -- ✅ ADDED: Credit hold check
    IF v_credit_check.credit_hold THEN
      RAISE EXCEPTION 'Customer is on credit hold. Cannot approve sales order.';
    END IF;
    
    IF v_credit_check.credit_exceeded THEN
      RAISE EXCEPTION 'Credit limit exceeded. Limit: %, Current AR: %, This Order: %, Total: %',
        v_credit_check.credit_limit,
        v_credit_check.current_ar_balance,
        v_so.total_amount,
        v_credit_check.new_total;
    END IF;
  END IF;
  
  -- Approve SO
  UPDATE sales_orders
  SET 
    status = 'approved',
    approved_at = NOW(),
    approved_by = p_user_id
  WHERE id = p_so_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION approve_sales_order IS 'Approve sales order with credit limit and credit hold validation (enhanced)';

-- ==================== CREDIT HOLD HISTORY ====================

CREATE TABLE IF NOT EXISTS customer_credit_hold_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  
  action VARCHAR(20) NOT NULL,  -- 'hold_set', 'hold_removed'
  reason TEXT NOT NULL,
  
  previous_credit_hold BOOLEAN NOT NULL,
  new_credit_hold BOOLEAN NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_hold_action CHECK (action IN ('hold_set', 'hold_removed'))
);

CREATE INDEX IF NOT EXISTS idx_credit_history_customer ON customer_credit_hold_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_history_created ON customer_credit_hold_history(created_at DESC);

COMMENT ON TABLE customer_credit_hold_history IS 'Audit trail for credit hold changes';

-- ==================== CREDIT LIMIT HISTORY ====================

CREATE TABLE IF NOT EXISTS customer_credit_limit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  
  previous_limit DECIMAL(15,2) NOT NULL,
  new_limit DECIMAL(15,2) NOT NULL,
  reason TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_limit_history_customer ON customer_credit_limit_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_limit_history_created ON customer_credit_limit_history(created_at DESC);

COMMENT ON TABLE customer_credit_limit_history IS 'Audit trail for credit limit changes';

-- ==================== RLS POLICIES ====================

ALTER TABLE customer_credit_hold_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_limit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY hold_history_tenant ON customer_credit_hold_history
  FOR ALL USING (customer_id IN (
    SELECT id FROM customers WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY limit_history_tenant ON customer_credit_limit_history
  FOR ALL USING (customer_id IN (
    SELECT id FROM customers WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY hold_history_service ON customer_credit_hold_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY limit_history_service ON customer_credit_limit_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_hold_history
  AFTER INSERT OR UPDATE OR DELETE ON customer_credit_hold_history
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_limit_history
  AFTER INSERT OR UPDATE OR DELETE ON customer_credit_limit_history
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
