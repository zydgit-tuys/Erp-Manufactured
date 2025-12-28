-- Migration: 013_purchase_orders.sql
-- Description: Purchase order management
-- Dependencies: 007_master_data_materials.sql, 008_master_data_vendors_customers.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE po_status AS ENUM ('draft', 'submitted', 'approved', 'partial', 'closed', 'cancelled');

-- ==================== PURCHASE ORDERS ====================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  po_date DATE NOT NULL,
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  -- Currency
  currency VARCHAR(3) DEFAULT 'IDR',
  exchange_rate DECIMAL(15,6) DEFAULT 1,
  
  -- Totals
  subtotal DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  
  status po_status DEFAULT 'draft',
  
  -- Delivery
  delivery_date DATE,
  delivery_address TEXT,
  
  -- Terms
  payment_terms payment_terms,
  custom_payment_days INTEGER,
  
  notes TEXT,
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_po_company ON purchase_orders(company_id);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_po_date ON purchase_orders(po_date DESC);
CREATE INDEX idx_po_number ON purchase_orders(po_number);

COMMENT ON TABLE purchase_orders IS 'Purchase order header';

-- ==================== PURCHASE ORDER LINES ====================

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  line_number INTEGER NOT NULL,
  
  material_id UUID REFERENCES materials(id) NOT NULL,
  description TEXT,
  
  -- Quantities
  qty_ordered DECIMAL(15,4) NOT NULL CHECK (qty_ordered > 0),
  qty_received DECIMAL(15,4) DEFAULT 0 CHECK (qty_received >= 0),
  qty_invoiced DECIMAL(15,4) DEFAULT 0 CHECK (qty_invoiced >= 0),
  qty_outstanding DECIMAL(15,4) GENERATED ALWAYS AS (qty_ordered - qty_received) STORED,
  
  -- Pricing
  unit_price DECIMAL(15,2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_ordered * unit_price) STORED,
  
  notes TEXT,
  
  UNIQUE(po_id, line_number),
  CONSTRAINT check_received_qty CHECK (qty_received <= qty_ordered * 1.05), -- 5% over-receipt tolerance
  CONSTRAINT check_invoiced_qty CHECK (qty_invoiced <= qty_received)
);

CREATE INDEX idx_po_lines_po ON purchase_order_lines(po_id);
CREATE INDEX idx_po_lines_material ON purchase_order_lines(material_id);
CREATE INDEX idx_po_lines_outstanding ON purchase_order_lines(qty_outstanding) WHERE qty_outstanding > 0;

COMMENT ON TABLE purchase_order_lines IS 'Purchase order line items';

-- ==================== TRIGGERS ====================

-- Auto-update PO subtotal when lines change
CREATE OR REPLACE FUNCTION update_po_total()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
BEGIN
  -- Get PO ID from either NEW or OLD
  v_po_id := COALESCE(NEW.po_id, OLD.po_id);
  
  -- Update subtotal
  UPDATE purchase_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_lines
    WHERE po_id = v_po_id
  )
  WHERE id = v_po_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_total_insert
  AFTER INSERT ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

CREATE TRIGGER trigger_update_po_total_update
  AFTER UPDATE ON purchase_order_lines
  FOR EACH ROW
  WHEN (OLD.line_total IS DISTINCT FROM NEW.line_total)
  EXECUTE FUNCTION update_po_total();

CREATE TRIGGER trigger_update_po_total_delete
  AFTER DELETE ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_total();

-- Auto-update PO status based on receipt/invoice status
CREATE OR REPLACE FUNCTION update_po_status()
RETURNS TRIGGER AS $$
DECLARE
  v_po_id UUID;
  v_total_ordered DECIMAL(15,4);
  v_total_received DECIMAL(15,4);
  v_total_invoiced DECIMAL(15,4);
  v_current_status po_status;
BEGIN
  v_po_id := COALESCE(NEW.po_id, OLD.po_id);
  
  -- Get current status
  SELECT status INTO v_current_status
  FROM purchase_orders
  WHERE id = v_po_id;
  
  -- Don't update if already closed or cancelled
  IF v_current_status IN ('closed', 'cancelled') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get totals
  SELECT 
    SUM(qty_ordered),
    SUM(qty_received),
    SUM(qty_invoiced)
  INTO v_total_ordered, v_total_received, v_total_invoiced
  FROM purchase_order_lines
  WHERE po_id = v_po_id;
  
  -- Update status
  UPDATE purchase_orders
  SET status = CASE
    WHEN v_total_invoiced >= v_total_ordered THEN 'closed'
    WHEN v_total_received > 0 THEN 'partial'
    ELSE status
  END
  WHERE id = v_po_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_status
  AFTER UPDATE OF qty_received, qty_invoiced ON purchase_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_status();

-- ==================== RLS POLICIES ====================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY po_tenant_isolation ON purchase_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY po_lines_tenant ON purchase_order_lines
  FOR ALL USING (po_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Service role bypass
CREATE POLICY po_service_role ON purchase_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY po_lines_service_role ON purchase_order_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_po
  AFTER INSERT OR UPDATE OR DELETE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== HELPER VIEWS ====================

-- Outstanding POs
CREATE VIEW outstanding_po_vw AS
SELECT 
  po.id,
  po.company_id,
  po.po_number,
  po.po_date,
  v.code as vendor_code,
  v.name as vendor_name,
  pol.material_id,
  m.code as material_code,
  m.name as material_name,
  pol.qty_outstanding,
  pol.unit_price,
  pol.qty_outstanding * pol.unit_price as value_outstanding
FROM purchase_orders po
JOIN purchase_order_lines pol ON pol.po_id = po.id
JOIN vendors v ON v.id = po.vendor_id
JOIN materials m ON m.id = pol.material_id
WHERE po.status NOT IN ('closed', 'cancelled')
  AND pol.qty_outstanding > 0;

COMMENT ON VIEW outstanding_po_vw IS 'Outstanding purchase orders (not fully received)';
