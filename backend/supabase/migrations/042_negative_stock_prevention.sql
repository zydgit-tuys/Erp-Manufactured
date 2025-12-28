-- ══════════════════════════════════════════════════════════════════
-- Migration: 042_negative_stock_prevention.sql
-- Description: Prevent negative stock at database level
-- Author: Ziyada ERP Team
-- Date: 2025-12-29
-- 
-- RULES.md Compliance:
-- ✅ Database Invariants: Stock Validation
-- ✅ "Kalau business rule dilanggar → DB harus menolak"
-- ══════════════════════════════════════════════════════════════════

-- ==================== STOCK VALIDATION FUNCTION ====================

CREATE OR REPLACE FUNCTION validate_stock_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance DECIMAL(15,4);
  v_material_code TEXT;
  v_warehouse_code TEXT;
BEGIN
  -- Only validate when issuing stock (qty_out > 0)
  IF NEW.qty_out > 0 THEN
    
    -- Get current balance for raw material ledger
    IF TG_TABLE_NAME = 'raw_material_ledger' THEN
      SELECT COALESCE(SUM(qty_in - qty_out), 0)
      INTO v_current_balance
      FROM raw_material_ledger
      WHERE material_id = NEW.material_id
        AND warehouse_id = NEW.warehouse_id
        AND company_id = NEW.company_id
        AND (bin_id = NEW.bin_id OR (bin_id IS NULL AND NEW.bin_id IS NULL));
      
      -- Get material and warehouse codes for error message
      SELECT m.code, w.code
      INTO v_material_code, v_warehouse_code
      FROM materials m, warehouses w
      WHERE m.id = NEW.material_id AND w.id = NEW.warehouse_id;
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient stock for material %. Available: %, Requested: %, Warehouse: %',
          v_material_code, v_current_balance, NEW.qty_out, v_warehouse_code
        USING HINT = 'Check stock balance before issuing',
              ERRCODE = '23514'; -- check_violation
      END IF;
    END IF;
    
    -- Get current balance for WIP ledger
    IF TG_TABLE_NAME = 'wip_ledger' THEN
      SELECT COALESCE(SUM(qty_in - qty_out), 0)
      INTO v_current_balance
      FROM wip_ledger
      WHERE product_id = NEW.product_id
        AND stage = NEW.stage
        AND company_id = NEW.company_id
        AND (variant_id = NEW.variant_id OR (variant_id IS NULL AND NEW.variant_id IS NULL));
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient WIP stock at stage %. Available: %, Requested: %',
          NEW.stage, v_current_balance, NEW.qty_out
        USING HINT = 'Check WIP balance before moving to next stage',
              ERRCODE = '23514';
      END IF;
    END IF;
    
    -- Get current balance for finished goods ledger
    IF TG_TABLE_NAME = 'finished_goods_ledger' THEN
      SELECT COALESCE(SUM(qty_in - qty_out), 0)
      INTO v_current_balance
      FROM finished_goods_ledger
      WHERE product_id = NEW.product_id
        AND warehouse_id = NEW.warehouse_id
        AND company_id = NEW.company_id
        AND (variant_id = NEW.variant_id OR (variant_id IS NULL AND NEW.variant_id IS NULL))
        AND (bin_id = NEW.bin_id OR (bin_id IS NULL AND NEW.bin_id IS NULL));
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient finished goods stock. Available: %, Requested: %',
          v_current_balance, NEW.qty_out
        USING HINT = 'Check finished goods balance before issuing',
              ERRCODE = '23514';
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_stock_availability() IS 
'Prevents negative stock by validating availability before issuing';

-- ==================== RAW MATERIAL LEDGER ====================

CREATE TRIGGER validate_stock_raw_material
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW
  WHEN (NEW.qty_out > 0)
  EXECUTE FUNCTION validate_stock_availability();

COMMENT ON TRIGGER validate_stock_raw_material ON raw_material_ledger IS
'Validates stock availability before issuing raw materials';

-- ==================== WIP LEDGER ====================

CREATE TRIGGER validate_stock_wip
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW
  WHEN (NEW.qty_out > 0)
  EXECUTE FUNCTION validate_stock_availability();

COMMENT ON TRIGGER validate_stock_wip ON wip_ledger IS
'Validates WIP stock availability before moving to next stage';

-- ==================== FINISHED GOODS LEDGER ====================

CREATE TRIGGER validate_stock_finished_goods
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW
  WHEN (NEW.qty_out > 0)
  EXECUTE FUNCTION validate_stock_availability();

COMMENT ON TRIGGER validate_stock_finished_goods ON finished_goods_ledger IS
'Validates finished goods stock availability before issuing';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════

-- Test negative stock prevention:
--
-- 1. Check current balance:
-- SELECT SUM(qty_in - qty_out) as balance
-- FROM raw_material_ledger
-- WHERE material_id = '...' AND warehouse_id = '...';
--
-- 2. Try to issue more than available (should fail):
-- INSERT INTO raw_material_ledger (
--   company_id, material_id, warehouse_id,
--   transaction_type, qty_in, qty_out, ...
-- ) VALUES (
--   '...', '...', '...',
--   'ISSUE', 0, 999999, ...  -- More than available
-- );
--
-- Expected error:
-- ERROR:  Insufficient stock for material XXX. Available: 10, Requested: 999999, Warehouse: WH01
-- HINT:  Check stock balance before issuing

-- ══════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ══════════════════════════════════════════════════════════════════
