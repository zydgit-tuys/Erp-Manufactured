-- Migration: 052_remediate_client_trust.sql
-- Description: Enforce server-side pricing to prevent client-side manipulation risk.
-- Impact: sales_order_lines.unit_price will be overwritten by product_variants.price.

CREATE OR REPLACE FUNCTION enforce_so_line_price()
RETURNS TRIGGER AS $$
DECLARE
  v_list_price DECIMAL(15,2);
BEGIN
  -- 1. Get List Price from Product Variant
  SELECT price INTO v_list_price
  FROM product_variants
  WHERE id = NEW.product_variant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product variant not found: %', NEW.product_variant_id;
  END IF;
  
  -- 2. Enforce Unit Price
  -- We allow the insert to proceed but we OVERWRITE the unit_price with the authoritative List Price.
  -- Modifications to price must be done via discount_percentage.
  
  -- Optional: Allow exact match or warn? 
  -- We strictly overwrite to ensure "Base Price" is always Source of Truth.
  NEW.unit_price := v_list_price;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Sales Order Lines (Insert and Update)
DROP TRIGGER IF EXISTS trigger_enforce_so_line_price ON sales_order_lines;

CREATE TRIGGER trigger_enforce_so_line_price
  BEFORE INSERT OR UPDATE OF product_variant_id, unit_price
  ON sales_order_lines
  FOR EACH ROW
  EXECUTE FUNCTION enforce_so_line_price();

-- Update comment
COMMENT ON TRIGGER trigger_enforce_so_line_price ON sales_order_lines IS 'Security: Enforces unit_price to match product master data, preventing client-side price updates.';
