-- ══════════════════════════════════════════════════════════════════
-- Migration: 041_period_lock_enforcement.sql
-- Description: Enforce period lock - prevent transactions in closed periods
-- Author: Ziyada ERP Team
-- Date: 2025-12-29
-- 
-- RULES.md Compliance:
-- ✅ Database Invariants: Period Lock
-- ✅ "Kalau business rule dilanggar → DB harus menolak"
-- ══════════════════════════════════════════════════════════════════

-- ==================== PERIOD LOCK FUNCTION ====================

CREATE OR REPLACE FUNCTION check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_period_status TEXT;
  v_period_name TEXT;
  v_transaction_date DATE;
BEGIN
  -- Get the transaction date based on table
  IF TG_TABLE_NAME = 'journals' THEN
    v_transaction_date := NEW.journal_date;
  ELSE
    v_transaction_date := NEW.transaction_date;
  END IF;

  -- Check if the transaction date falls in a closed period
  SELECT 
    CASE WHEN is_closed THEN 'closed' ELSE 'open' END,
    period_name
  INTO v_period_status, v_period_name
  FROM accounting_periods
  WHERE company_id = NEW.company_id
    AND v_transaction_date BETWEEN start_date AND end_date
  LIMIT 1;

  -- If period is closed, reject the transaction
  IF v_period_status = 'closed' THEN
    RAISE EXCEPTION 'Cannot post transactions to closed period: %. Transaction date: %', 
      v_period_name, v_transaction_date
    USING HINT = 'Open the period first or change the transaction date',
          ERRCODE = '23514'; -- check_violation
  END IF;

  -- If no period found, warn but allow (for flexibility during setup)
  IF v_period_status IS NULL THEN
    RAISE WARNING 'No accounting period defined for date: %. Company: %', 
      v_transaction_date, NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_period_lock() IS 
'Prevents posting transactions to closed accounting periods';

-- ==================== RAW MATERIAL LEDGER ====================

CREATE TRIGGER enforce_period_lock_raw_material
  BEFORE INSERT OR UPDATE OF transaction_date ON raw_material_ledger
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

COMMENT ON TRIGGER enforce_period_lock_raw_material ON raw_material_ledger IS
'Enforces period lock - prevents transactions in closed periods';

-- ==================== WIP LEDGER ====================

CREATE TRIGGER enforce_period_lock_wip
  BEFORE INSERT OR UPDATE OF transaction_date ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

COMMENT ON TRIGGER enforce_period_lock_wip ON wip_ledger IS
'Enforces period lock - prevents WIP transactions in closed periods';

-- ==================== FINISHED GOODS LEDGER ====================

CREATE TRIGGER enforce_period_lock_finished_goods
  BEFORE INSERT OR UPDATE OF transaction_date ON finished_goods_ledger
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

COMMENT ON TRIGGER enforce_period_lock_finished_goods ON finished_goods_ledger IS
'Enforces period lock - prevents finished goods transactions in closed periods';

-- ==================== JOURNAL ENTRIES ====================

CREATE TRIGGER enforce_period_lock_journals
  BEFORE INSERT OR UPDATE OF journal_date ON journals
  FOR EACH ROW
  EXECUTE FUNCTION check_period_lock();

COMMENT ON TRIGGER enforce_period_lock_journals ON journals IS
'Enforces period lock - prevents journal entries in closed periods';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════

-- Test period lock (assuming period Jan 2024 is closed):
-- 
-- 1. Close a period:
-- UPDATE accounting_periods 
-- SET is_closed = true 
-- WHERE period_name = 'Jan 2024';
--
-- 2. Try to post transaction (should fail):
-- INSERT INTO raw_material_ledger (
--   company_id, material_id, transaction_date, ...
-- ) VALUES (
--   '...', '...', '2024-01-15', ...
-- );
--
-- Expected error:
-- ERROR:  Cannot post transactions to closed period: Jan 2024. Transaction date: 2024-01-15
-- HINT:  Open the period first or change the transaction date

-- ══════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ══════════════════════════════════════════════════════════════════
