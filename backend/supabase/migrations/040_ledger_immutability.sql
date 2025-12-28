-- ══════════════════════════════════════════════════════════════════
-- Migration: 040_ledger_immutability.sql
-- Description: Enforce ledger immutability - prevent UPDATE/DELETE on ledger tables
-- Author: Ziyada ERP Team
-- Date: 2025-12-29
-- 
-- RULES.md Compliance:
-- ✅ Database Invariants: IMMUTABILITY
-- ✅ "Ledger records are immutable. Use adjustment entries instead."
-- ══════════════════════════════════════════════════════════════════

-- ==================== IMMUTABILITY FUNCTION ====================

CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger records are immutable. Use adjustment entries to correct mistakes. Table: %, Operation: %', 
    TG_TABLE_NAME, TG_OP
  USING HINT = 'Create a new adjustment entry instead of modifying existing records',
        ERRCODE = '23514'; -- check_violation
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_ledger_modification() IS 
'Prevents any UPDATE or DELETE operations on ledger tables to maintain audit trail integrity';

-- ==================== RAW MATERIAL LEDGER ====================

-- Prevent UPDATE on raw_material_ledger
CREATE TRIGGER immutable_raw_material_ledger_update
  BEFORE UPDATE ON raw_material_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on raw_material_ledger
CREATE TRIGGER immutable_raw_material_ledger_delete
  BEFORE DELETE ON raw_material_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER immutable_raw_material_ledger_update ON raw_material_ledger IS
'Enforces immutability - prevents updates to raw material ledger entries';

COMMENT ON TRIGGER immutable_raw_material_ledger_delete ON raw_material_ledger IS
'Enforces immutability - prevents deletion of raw material ledger entries';

-- ==================== WIP LEDGER ====================

-- Prevent UPDATE on wip_ledger
CREATE TRIGGER immutable_wip_ledger_update
  BEFORE UPDATE ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on wip_ledger
CREATE TRIGGER immutable_wip_ledger_delete
  BEFORE DELETE ON wip_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER immutable_wip_ledger_update ON wip_ledger IS
'Enforces immutability - prevents updates to WIP ledger entries';

COMMENT ON TRIGGER immutable_wip_ledger_delete ON wip_ledger IS
'Enforces immutability - prevents deletion of WIP ledger entries';

-- ==================== FINISHED GOODS LEDGER ====================

-- Prevent UPDATE on finished_goods_ledger
CREATE TRIGGER immutable_finished_goods_ledger_update
  BEFORE UPDATE ON finished_goods_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on finished_goods_ledger
CREATE TRIGGER immutable_finished_goods_ledger_delete
  BEFORE DELETE ON finished_goods_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER immutable_finished_goods_ledger_update ON finished_goods_ledger IS
'Enforces immutability - prevents updates to finished goods ledger entries';

COMMENT ON TRIGGER immutable_finished_goods_ledger_delete ON finished_goods_ledger IS
'Enforces immutability - prevents deletion of finished goods ledger entries';

-- ==================== JOURNAL ENTRIES ====================

-- Prevent UPDATE on journal_entries (header)
CREATE TRIGGER immutable_journal_entries_update
  BEFORE UPDATE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on journal_entries (header)
CREATE TRIGGER immutable_journal_entries_delete
  BEFORE DELETE ON journals
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER immutable_journal_entries_update ON journals IS
'Enforces immutability - prevents updates to journal entries';

COMMENT ON TRIGGER immutable_journal_entries_delete ON journals IS
'Enforces immutability - prevents deletion of journal entries';

-- ==================== JOURNAL LINES ====================

-- Prevent UPDATE on journal_lines
CREATE TRIGGER immutable_journal_lines_update
  BEFORE UPDATE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- Prevent DELETE on journal_lines
CREATE TRIGGER immutable_journal_lines_delete
  BEFORE DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

COMMENT ON TRIGGER immutable_journal_lines_update ON journal_lines IS
'Enforces immutability - prevents updates to journal line items';

COMMENT ON TRIGGER immutable_journal_lines_delete ON journal_lines IS
'Enforces immutability - prevents deletion of journal line items';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════

-- Test immutability (these should all fail):
-- UPDATE raw_material_ledger SET qty_in = 999 WHERE id = '...';
-- DELETE FROM wip_ledger WHERE id = '...';
-- UPDATE finished_goods_ledger SET unit_cost = 0 WHERE id = '...';
-- DELETE FROM journals WHERE id = '...';
-- UPDATE journal_lines SET debit = 0 WHERE id = '...';

-- Expected error message:
-- ERROR:  Ledger records are immutable. Use adjustment entries to correct mistakes.
-- HINT:  Create a new adjustment entry instead of modifying existing records

-- ══════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ══════════════════════════════════════════════════════════════════
