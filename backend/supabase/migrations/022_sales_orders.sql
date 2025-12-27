-- Migration: 022_sales_orders.sql
-- Description: Sales Orders for distributor/credit sales
-- Dependencies: 011_inventory_finished_goods.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== SALES ORDERS ====================

CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  so_number VARCHAR(50) UNIQUE NOT NULL,
  so_date DATE NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Pricing
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount DECIMAL(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal - discount_amount + tax_amount) STORED,
  
  -- Credit terms
  payment_terms VARCHAR(20) DEFAULT 'Net 30',  -- Net 14, Net 30, Net 60, COD
  due_date DATE,
  
  -- Status workflow: draft → approved → sent → in_delivery → completed → cancelled
  status VARCHAR(20) DEFAULT 'draft',
  
  -- Delivery
  delivery_date DATE,
  delivery_address TEXT,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  
  CONSTRAINT valid_status CHECK (status IN ('draft', 'approved', 'sent', 'in_delivery', 'completed', 'cancelled'))
);

CREATE INDEX idx_so_company ON sales_orders(company_id);
CREATE INDEX idx_so_customer ON sales_orders(customer_id);
CREATE INDEX idx_so_warehouse ON sales_orders(warehouse_id);
CREATE INDEX idx_so_date ON sales_orders(so_date DESC);
CREATE INDEX idx_so_status ON sales_orders(status);

COMMENT ON TABLE sales_orders IS 'Sales orders for distributor/wholesale credit sales';

-- ==================== SALES ORDER LINES ====================

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  product_variant_id UUID REFERENCES product_variants(id) NOT NULL,
  
  qty_ordered DECIMAL(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_delivered DECIMAL(15,4) DEFAULT 0 CHECK (qty_delivered >= 0),
  qty_invoiced DECIMAL(15,4) DEFAULT 0 CHECK (qty_invoiced >= 0),
  
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  discount_percentage DECIMAL(5,2) DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage < 100),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (
    qty_ordered * unit_price * (1 - discount_percentage / 100)
  ) STORED,
  
  notes TEXT,
  
  UNIQUE(so_id, line_number),
  CONSTRAINT qty_delivered_check CHECK (qty_delivered <= qty_ordered),
  CONSTRAINT qty_invoiced_check CHECK (qty_invoiced <= qty_ordered)
);

CREATE INDEX idx_so_lines_so ON sales_order_lines(so_id);
CREATE INDEX idx_so_lines_variant ON sales_order_lines(product_variant_id);

COMMENT ON TABLE sales_order_lines IS 'Sales order line items';

-- ==================== TRIGGERS ====================

-- Auto-update SO subtotal
CREATE OR REPLACE FUNCTION update_so_total()
RETURNS TRIGGER AS $$
DECLARE
  v_so_id UUID;
BEGIN
  v_so_id := COALESCE(NEW.so_id, OLD.so_id);
  
  UPDATE sales_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM sales_order_lines
    WHERE so_id = v_so_id
  )
  WHERE id = v_so_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_so_total_insert
  AFTER INSERT ON sales_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_so_total();

CREATE TRIGGER trigger_update_so_total_update
  AFTER UPDATE ON sales_order_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_so_total();

CREATE TRIGGER trigger_update_so_total_delete
  AFTER DELETE ON sales_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_so_total();

-- Auto-calculate due date from payment terms
CREATE OR REPLACE FUNCTION calculate_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_terms = 'COD' THEN
    NEW.due_date := NEW.so_date;
  ELSIF NEW.payment_terms = 'Net 14' THEN
    NEW.due_date := NEW.so_date + INTERVAL '14 days';
  ELSIF NEW.payment_terms = 'Net 30' THEN
    NEW.due_date := NEW.so_date + INTERVAL '30 days';
  ELSIF NEW.payment_terms = 'Net 60' THEN
    NEW.due_date := NEW.so_date + INTERVAL '60 days';
  ELSE
    NEW.due_date := NEW.so_date + INTERVAL '30 days';  -- Default to Net 30
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_due_date
  BEFORE INSERT OR UPDATE OF payment_terms, so_date ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_due_date();

-- ==================== CREDIT LIMIT VALIDATION ====================

-- Check customer credit limit (without credit_hold for now)
CREATE OR REPLACE FUNCTION check_customer_credit_limit(
  p_customer_id UUID,
  p_new_order_amount DECIMAL
)
RETURNS TABLE(
  credit_limit DECIMAL,
  current_ar_balance DECIMAL,
  available_credit DECIMAL,
  new_total DECIMAL,
  credit_exceeded BOOLEAN
) AS $$
DECLARE
  v_customer RECORD;
  v_current_ar DECIMAL;
BEGIN
  -- Get customer info
  SELECT 
    COALESCE(c.credit_limit, 0) as credit_limit
  INTO v_customer
  FROM customers c
  WHERE c.id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;
  
  -- Calculate current pending amount from approved SOs
  -- Note: AR from invoices will be added when sales_invoices table exists
  SELECT COALESCE(SUM(total_amount), 0)
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
    (v_current_ar + p_new_order_amount) > v_customer.credit_limit as credit_exceeded;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_customer_credit_limit IS 'Check if customer has available credit for new order (credit_hold to be added in migration 024)';

-- Approve sales order with credit check
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
    
    -- Note: credit_hold check will be added in migration 024
    
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

COMMENT ON FUNCTION approve_sales_order IS 'Approve sales order with credit limit validation';

-- ==================== VIEWS ====================

-- Outstanding Sales Orders (pending delivery)
CREATE VIEW outstanding_sales_orders_vw AS
SELECT 
  so.id,
  so.company_id,
  so.so_number,
  so.so_date,
  so.customer_id,
  c.name as customer_name,
  so.warehouse_id,
  w.name as warehouse_name,
  so.total_amount,
  so.status,
  so.delivery_date,
  COUNT(sol.id) as line_count,
  SUM(sol.qty_ordered) as total_qty_ordered,
  SUM(sol.qty_delivered) as total_qty_delivered,
  SUM(sol.qty_ordered - sol.qty_delivered) as total_qty_pending
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
JOIN warehouses w ON w.id = so.warehouse_id
LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
WHERE so.status IN ('approved', 'sent', 'in_delivery')
  AND EXISTS (
    SELECT 1 FROM sales_order_lines 
    WHERE so_id = so.id AND qty_ordered > qty_delivered
  )
GROUP BY so.id, so.company_id, so.so_number, so.so_date, 
         so.customer_id, c.name, so.warehouse_id, w.name,
         so.total_amount, so.status, so.delivery_date;

COMMENT ON VIEW outstanding_sales_orders_vw IS 'Sales orders with pending deliveries';

-- Sales Order Summary
CREATE VIEW sales_order_summary_vw AS
SELECT 
  so.id,
  so.company_id,
  so.so_number,
  so.so_date,
  so.customer_id,
  c.name as customer_name,
  c.credit_limit,
  so.total_amount,
  so.status,
  so.payment_terms,
  so.due_date,
  so.created_at,
  so.approved_at,
  COUNT(sol.id) as line_count,
  SUM(sol.qty_ordered) as total_qty,
  CASE 
    WHEN so.status = 'completed' THEN 'Completed'
    WHEN so.status = 'cancelled' THEN 'Cancelled'
    WHEN SUM(sol.qty_delivered) = 0 THEN 'Not Started'
    WHEN SUM(sol.qty_delivered) < SUM(sol.qty_ordered) THEN 'Partial'
    WHEN SUM(sol.qty_delivered) >= SUM(sol.qty_ordered) THEN 'Fully Delivered'
    ELSE 'Unknown'
  END as delivery_status
FROM sales_orders so
JOIN customers c ON c.id = so.customer_id
LEFT JOIN sales_order_lines sol ON sol.so_id = so.id
GROUP BY so.id, so.company_id, so.so_number, so.so_date,
         so.customer_id, c.name, c.credit_limit, so.total_amount,
         so.status, so.payment_terms, so.due_date, 
         so.created_at, so.approved_at;

COMMENT ON VIEW sales_order_summary_vw IS 'Sales order summary with delivery status';

-- Customer Credit Status (SO-based, will be enhanced with AR in migration 024)
CREATE VIEW customer_credit_status_vw AS
SELECT 
  c.id as customer_id,
  c.company_id,
  c.name as customer_name,
  c.credit_limit,
  c.payment_terms as default_payment_terms,
  0::DECIMAL(15,2) as current_ar_balance,  -- Will be populated when invoices exist
  COALESCE(SUM(CASE WHEN so.status IN ('approved', 'sent', 'in_delivery') THEN so.total_amount ELSE 0 END), 0) as pending_so_amount,
  c.credit_limit - COALESCE(SUM(CASE WHEN so.status IN ('approved', 'sent', 'in_delivery') THEN so.total_amount ELSE 0 END), 0) as available_credit,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN so.status IN ('approved', 'sent', 'in_delivery') THEN so.total_amount ELSE 0 END), 0) > c.credit_limit THEN 'Exceeded'
    WHEN COALESCE(SUM(CASE WHEN so.status IN ('approved', 'sent', 'in_delivery') THEN so.total_amount ELSE 0 END), 0) > c.credit_limit * 0.8 THEN 'Near Limit'
    ELSE 'Good'
  END as credit_status
FROM customers c
LEFT JOIN sales_orders so ON so.customer_id = c.id
GROUP BY c.id, c.company_id, c.name, c.credit_limit, c.payment_terms;

COMMENT ON VIEW customer_credit_status_vw IS 'Customer credit status based on pending SOs (credit_hold will be added in migration 024)';

-- ==================== RLS POLICIES ====================

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY so_tenant_isolation ON sales_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY so_lines_tenant ON sales_order_lines
  FOR ALL USING (so_id IN (
    SELECT id FROM sales_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY so_service_role ON sales_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY so_lines_service_role ON sales_order_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_so
  AFTER INSERT OR UPDATE OR DELETE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
