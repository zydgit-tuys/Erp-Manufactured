-- Migration: 055_auto_populate_created_by.sql
-- Description: Automatically set created_by to auth.uid() if NULL on INSERT
-- Impact: Ensures audit trail integrity for all new records.

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- If created_by is already set (e.g. by system), leave it.
  -- If NULL, set it to the current authenticated user.
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_created_by IS 'Automatically sets created_by to auth.uid() if not provided';

-- 2. Define List of Tables to Apply Trigger
-- Helper macro or just repeated blocks. We will use repeated blocks for clarity and compatibility.

-- Foundation
DROP TRIGGER IF EXISTS trigger_set_created_by ON companies;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON companies FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON chart_of_accounts;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON accounting_periods;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON accounting_periods FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Master Data
DROP TRIGGER IF EXISTS trigger_set_created_by ON products;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON products FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON product_variants;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON product_variants FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON materials;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON materials FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON material_categories;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON material_categories FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON vendors;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON vendors FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON customers;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON customers FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON warehouses;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON warehouses FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON bins;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON bins FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON sizes;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON sizes FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON colors;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON colors FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Inventory
DROP TRIGGER IF EXISTS trigger_set_created_by ON inventory_adjustments;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON inventory_adjustments FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON internal_transfers;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON internal_transfers FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Purchasing
DROP TRIGGER IF EXISTS trigger_set_created_by ON purchase_orders;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON goods_receipt_notes;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON goods_receipt_notes FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON vendor_invoices;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON vendor_invoices FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Sales
DROP TRIGGER IF EXISTS trigger_set_created_by ON sales_orders;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON sales_orders FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON sales_invoices;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON sales_invoices FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON sales_pos;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON sales_pos FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON delivery_notes;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON delivery_notes FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Production
DROP TRIGGER IF EXISTS trigger_set_created_by ON production_orders;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON production_orders FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON work_orders;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON work_orders FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON bom_headers;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON bom_headers FOR EACH ROW EXECUTE FUNCTION set_created_by();

-- Operations
DROP TRIGGER IF EXISTS trigger_set_created_by ON operations;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON operations FOR EACH ROW EXECUTE FUNCTION set_created_by();

DROP TRIGGER IF EXISTS trigger_set_created_by ON work_centers;
CREATE TRIGGER trigger_set_created_by BEFORE INSERT ON work_centers FOR EACH ROW EXECUTE FUNCTION set_created_by();
