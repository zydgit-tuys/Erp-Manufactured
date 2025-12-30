-- ══════════════════════════════════════════════════════════════════
-- Migration: 050_integrity_journal_entry.sql
-- Description: Implement Deferred Constraint for Journal Validation
-- Addresses: "Partial Journal Entry" (Audit Finding #3)
-- ══════════════════════════════════════════════════════════════════

-- 1. Drop existing IMMEDIATE triggers
-- These triggers prevent creating multi-line journals because they fire after *each* row.

DROP TRIGGER IF EXISTS validate_journal_balance_insert ON journal_lines;
DROP TRIGGER IF EXISTS validate_journal_balance_update ON journal_lines;
DROP TRIGGER IF EXISTS validate_journal_balance_delete ON journal_lines;

-- 2. Create DEFERRED Constraint Trigger
-- This trigger will only fire at COMMIT time (or when explicitly checked), 
-- allowing the user to insert multiple unbalanced lines as long as they sum to 0 by the end of the transaction.

CREATE CONSTRAINT TRIGGER validate_journal_balance_deferred
AFTER INSERT OR UPDATE OR DELETE ON journal_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_journal_balance();

-- 3. Comments
COMMENT ON TRIGGER validate_journal_balance_deferred ON journal_lines IS
'Validates journal balance at transaction commit time (Deferred Constraint). Allows multi-line inserts.';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION (Mental Check)
-- ══════════════════════════════════════════════════════════════════
-- PREVIOUSLY (Fails):
-- BEGIN;
-- INSERT INTO journal_lines (debit: 100); -- FAIL immediately (Unbalanced)
-- INSERT INTO journal_lines (credit: 100);
-- COMMIT;

-- NOW (Succeeds):
-- BEGIN;
-- INSERT INTO journal_lines (debit: 100); -- OK (Validation deferred)
-- INSERT INTO journal_lines (credit: 100); -- OK
-- COMMIT; -- Trigger fires here. Total 100-100 = 0. SUCCESS.
