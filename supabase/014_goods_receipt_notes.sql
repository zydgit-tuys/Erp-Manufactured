-- Migration: 014_goods_receipt_notes.sql
-- Description: Goods Receipt Notes (GRN) with inventory integration
-- Dependencies: 009_inventory_raw_material.sql, 013_purchase_orders.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE grn_status AS ENUM ('draft', 'posted', 'cancelled');

-- ==================== GOODS RECEIPT NOTES ====================

CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  grn_date DATE NOT NULL,
  po_id UUID REFERENCES purchase_orders(id),
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id) NOT NULL,
  period_id UUID REFERENCES accounting_periods(id) NOT NULL,
  
  status grn_status DEFAULT 'draft',
  
  -- Reference
  delivery_note_number VARCHAR(100),
  vehicle_number VARCHAR(50),
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_grn_company ON goods_receipt_notes(company_id);
CREATE INDEX idx_grn_po ON goods_receipt_notes(po_id);
CREATE INDEX idx_grn_vendor ON goods_receipt_notes(vendor_id);
CREATE INDEX idx_grn_status ON goods_receipt_notes(status);
CREATE INDEX idx_grn_date ON goods_receipt_notes(grn_date DESC);

COMMENT ON TABLE goods_receipt_notes IS 'Goods Receipt Notes (receiving documentation)';

-- ==================== GRN LINES ====================

CREATE TABLE IF NOT EXISTS grn_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES goods_receipt_notes(id) ON DELETE CASCADE NOT NULL,
  po_line_id UUID REFERENCES purchase_order_lines(id),
  material_id UUID REFERENCES materials(id) NOT NULL,
  bin_id UUID REFERENCES bins(id) NOT NULL,
  
  qty_received DECIMAL(15,4) NOT NULL CHECK (qty_received > 0),
  unit_cost DECIMAL(15,2) NOT NULL CHECK (unit_cost >= 0),
  line_total DECIMAL(15,2) GENERATED ALWAYS AS (qty_received * unit_cost) STORED,
  
  -- Quality check
  qty_accepted DECIMAL(15,4),
  qty_rejected DECIMAL(15,4),
  
  notes TEXT
);

CREATE INDEX idx_grn_lines_grn ON grn_lines(grn_id);
CREATE INDEX idx_grn_lines_po_line ON grn_lines(po_line_id);
CREATE INDEX idx_grn_lines_material ON grn_lines(material_id);

COMMENT ON TABLE grn_lines IS 'GRN line items';

-- ==================== POSTING LOGIC ====================

-- Function to post GRN (create inventory ledger + journal entries)
CREATE OR REPLACE FUNCTION post_grn(p_grn_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_grn RECORD;
  v_line RECORD;
BEGIN
  -- Get GRN header
  SELECT * INTO v_grn
  FROM goods_receipt_notes
  WHERE id = p_grn_id;
  
  IF v_grn.status = 'posted' THEN
    RAISE EXCEPTION 'GRN already posted';
  END IF;
  
  -- Post each line to raw material ledger
  FOR v_line IN 
    SELECT * FROM grn_lines WHERE grn_id = p_grn_id
  LOOP
    INSERT INTO raw_material_ledger (
      company_id,
      material_id,
      warehouse_id,
      bin_id,
      period_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_number,
      qty_in,
      qty_out,
      unit_cost,
      created_by,
      is_posted
    ) VALUES (
      v_grn.company_id,
      v_line.material_id,
      v_grn.warehouse_id,
      v_line.bin_id,
      v_grn.period_id,
      v_grn.grn_date,
      'RECEIPT',
      'PURCHASE',
      v_grn.id,
      v_grn.grn_number,
      v_line.qty_received,
      0,
      v_line.unit_cost,
      p_user_id,
      true
    );
    
    -- Update PO line qty_received
    IF v_line.po_line_id IS NOT NULL THEN
      UPDATE purchase_order_lines
      SET qty_received = qty_received + v_line.qty_received
      WHERE id = v_line.po_line_id;
    END IF;
  END LOOP;
  
  -- Update GRN status
  UPDATE goods_receipt_notes
  SET 
    status = 'posted',
    posted_at = NOW(),
    posted_by = p_user_id
  WHERE id = p_grn_id;
  
  -- TODO: Create journal entry (Dr. Inventory, Cr. GRN/IR Clearing)
  -- Will implement when GL module is added
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION post_grn IS 'Post GRN to inventory ledger and update PO quantities';

-- ==================== RLS POLICIES ====================

ALTER TABLE goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY grn_tenant_isolation ON goods_receipt_notes
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY grn_lines_tenant ON grn_lines
  FOR ALL USING (grn_id IN (
    SELECT id FROM goods_receipt_notes WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY grn_service_role ON goods_receipt_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY grn_lines_service_role ON grn_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRAIL ====================

CREATE TRIGGER trigger_audit_grn
  AFTER INSERT OR UPDATE OR DELETE ON goods_receipt_notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
