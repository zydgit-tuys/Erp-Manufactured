-- ══════════════════════════════════════════════════════════════════
-- Migration: 043_unbalanced_journal_check.sql
-- Description: Prevent unbalanced journal entries
-- Author: Ziyada ERP Team
-- Date: 2025-12-29
-- 
-- RULES.md Compliance:
-- ✅ Database Invariants: Journal Balance
-- ✅ "Kalau business rule dilanggar → DB harus menolak"
-- ══════════════════════════════════════════════════════════════════

-- ==================== JOURNAL BALANCE VALIDATION ====================

CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit DECIMAL(15,2);
  v_total_credit DECIMAL(15,2);
  v_difference DECIMAL(15,2);
  v_journal_number TEXT;
BEGIN
  -- Calculate total debit and credit for this journal
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM journal_lines
  WHERE journal_id = COALESCE(NEW.journal_id, OLD.journal_id);
  
  -- Calculate difference
  v_difference := v_total_debit - v_total_credit;
  
  -- Get journal number for error message
  SELECT journal_number
  INTO v_journal_number
  FROM journals
  WHERE id = COALESCE(NEW.journal_id, OLD.journal_id);
  
  -- If unbalanced, reject
  IF ABS(v_difference) > 0.01 THEN  -- Allow 1 cent rounding difference
    RAISE EXCEPTION 'Unbalanced journal entry: %. Total Debit: %, Total Credit: %, Difference: %',
      v_journal_number, v_total_debit, v_total_credit, v_difference
    USING HINT = 'Ensure total debits equal total credits',
          ERRCODE = '23514'; -- check_violation
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_journal_balance() IS 
'Ensures journal entries are balanced (debit = credit)';

-- ==================== JOURNAL LINES TRIGGERS ====================

-- Validate balance after INSERT
CREATE TRIGGER validate_journal_balance_insert
  AFTER INSERT ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_balance();

-- Validate balance after UPDATE
CREATE TRIGGER validate_journal_balance_update
  AFTER UPDATE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_balance();

-- Validate balance after DELETE
CREATE TRIGGER validate_journal_balance_delete
  AFTER DELETE ON journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION validate_journal_balance();

COMMENT ON TRIGGER validate_journal_balance_insert ON journal_lines IS
'Validates journal balance after inserting a line';

COMMENT ON TRIGGER validate_journal_balance_update ON journal_lines IS
'Validates journal balance after updating a line';

COMMENT ON TRIGGER validate_journal_balance_delete ON journal_lines IS
'Validates journal balance after deleting a line';

-- ══════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Check if journal is balanced
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION is_journal_balanced(p_journal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total_debit DECIMAL(15,2);
  v_total_credit DECIMAL(15,2);
BEGIN
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM journal_lines
  WHERE journal_id = p_journal_id;
  
  RETURN ABS(v_total_debit - v_total_credit) <= 0.01;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_journal_balanced(UUID) IS
'Returns true if journal is balanced (debit = credit within 1 cent)';

-- ══════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════════════════

-- Test unbalanced journal prevention:
--
-- 1. Create a journal header:
-- INSERT INTO journals (company_id, journal_number, transaction_date, ...)
-- VALUES ('...', 'JV-001', '2024-01-15', ...)
-- RETURNING id;
--
-- 2. Try to create unbalanced lines (should fail):
-- INSERT INTO journal_lines (journal_id, account_id, debit, credit, ...)
-- VALUES
--   ('...', '...', 1000, 0, ...),  -- Debit 1000
--   ('...', '...', 0, 900, ...);   -- Credit 900 (UNBALANCED!)
--
-- Expected error:
-- ERROR:  Unbalanced journal entry: JV-001. Total Debit: 1000.00, Total Credit: 900.00, Difference: 100.00
-- HINT:  Ensure total debits equal total credits

-- Test balanced journal (should succeed):
-- INSERT INTO journal_lines (journal_id, account_id, debit, credit, ...)
-- VALUES
--   ('...', '...', 1000, 0, ...),  -- Debit 1000
--   ('...', '...', 0, 1000, ...);  -- Credit 1000 (BALANCED!)

-- ══════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- ══════════════════════════════════════════════════════════════════
