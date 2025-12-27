/**
 * Journal Service
 * Handles journal entries with automatic balance validation
 * 
 * Core accounting principle: Debit must equal Credit in every journal entry.
 * This service enforces this rule at creation, validation, and posting stages.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

export interface JournalHeader {
    company_id: string;
    period_id: string;
    journal_number: string;
    journal_date: string;
    description?: string;
    reference_type?: string;
    reference_id?: string;
}

export interface JournalLine {
    account_code: string;
    debit: number;
    credit: number;
    description?: string;
}

export interface JournalBalance {
    balanced: boolean;
    total_debit: number;
    total_credit: number;
    variance: number;
}

/**
 * Creates a journal entry with automatic balance validation and atomic transaction handling.
 * 
 * This is the primary function for creating journal entries. It validates the accounting
 * period is open, ensures debits equal credits (with 0.01 rounding tolerance), creates
 * the journal header and lines atomically, and implements rollback on failure.
 * 
 * **Validation Steps:**
 * 1. Period must be open (validatePeriodIsOpen)
 * 2. Lines must balance (validateLinesBalance)
 * 3. At least one line must be provided
 * 
 * **Atomic Transaction:**
 * - If line insert fails, header is automatically deleted (rollback)
 * - Both header and lines are created or both fail
 * 
 * @param header - Journal header information
 * @param header.company_id - UUID of the company
 * @param header.period_id - UUID of the accounting period (must be open)
 * @param header.journal_number - Unique journal number (e.g., 'JE-2025-001')
 * @param header.journal_date - Date of the journal entry
 * @param header.description - Optional description/memo
 * @param header.reference_type - Optional source document type (e.g., 'INVOICE', 'PAYMENT')
 * @param header.reference_id - Optional source document ID for audit trail
 * 
 * @param lines - Array of journal lines (debit/credit entries)
 * @param lines[].account_code - Chart of accounts code (e.g., '1010')
 * @param lines[].debit - Debit amount (0 if credit entry)
 * @param lines[].credit - Credit amount (0 if debit entry)
 * @param lines[].description - Optional line description
 * 
 * @param userId - UUID of user creating the journal
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If lines don't balance (debit ≠ credit)
 * @throws {Error} If no lines provided
 * @throws {Error} If database operations fail
 * 
 * @returns Promise resolving to object with journal ID and number
 * 
 * @example
 * ```typescript
 * // Simple cash sale journal entry
 * const journal = await createJournal(
 *   {
 *     company_id: companyId,
 *     period_id: periodId,
 *     journal_number: 'JE-2025-001',
 *     journal_date: '2025-01-15',
 *     description: 'Cash sale to customer',
 *     reference_type: 'INVOICE',
 *     reference_id: invoiceId
 *   },
 *   [
 *     { account_code: '1010', debit: 1000, credit: 0, description: 'Cash' },
 *     { account_code: '4010', debit: 0, credit: 1000, description: 'Sales Revenue' }
 *   ],
 *   userId
 * );
 * 
 * console.log(`Created journal: ${journal.journal_number}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Complex journal with multiple lines
 * const journal = await createJournal(
 *   { ... },
 *   [
 *     { account_code: '1200', debit: 1500, credit: 0 },  // Accounts Receivable
 *     { account_code: '4010', debit: 0, credit: 1300 },  // Sales Revenue
 *     { account_code: '2100', debit: 0, credit: 200 }    // Sales Tax Payable
 *   ],
 *   userId
 * );
 * ```
 * 
 * @see {@link validateLinesBalance} for pre-validation
 * @see {@link postJournal} for posting the journal
 * @see {@link reverseJournal} for reversing posted journals
 */
export async function createJournal(
    header: JournalHeader,
    lines: JournalLine[],
    userId: string
): Promise<{ id: string; journal_number: string }> {
    // Validate period is open
    await validatePeriodIsOpen(header.period_id);

    // Validate lines are balanced
    const balance = validateLinesBalance(lines);
    if (!balance.balanced) {
        throw new Error(
            `Journal is not balanced. Debit: ${balance.total_debit}, Credit: ${balance.total_credit}, Variance: ${balance.variance}`
        );
    }

    // Create journal header
    const { data: journal, error: journalError } = await supabaseServer
        .from('journals')
        .insert({
            ...header,
            status: 'draft',
            created_by: userId,
        })
        .select()
        .single();

    if (journalError) throw journalError;

    // Create journal lines
    const linesWithJournalId = lines.map(line => ({
        ...line,
        journal_id: journal.id,
        company_id: header.company_id,
    }));

    const { error: linesError } = await supabaseServer
        .from('journal_lines')
        .insert(linesWithJournalId);

    if (linesError) {
        // Rollback: delete journal header if lines fail
        await supabaseServer.from('journals').delete().eq('id', journal.id);
        throw linesError;
    }

    return { id: journal.id, journal_number: journal.journal_number };
}

/**
 * Validates that a journal's debits equal credits after it's been saved.
 * 
 * Queries the journal_lines table and calculates total debits and credits.
 * Allows for rounding errors up to 0.01 (1 cent) to handle floating point precision.
 * 
 * @param journalId - UUID of the journal to validate
 * 
 * @throws {Error} If journal has no lines
 * @throws {Error} If database query fails
 * 
 * @returns Promise resolving to balance validation result
 * @returns balance.balanced - true if variance < 0.01
 * @returns balance.total_debit - Sum of all debit amounts
 * @returns balance.total_credit - Sum of all credit amounts
 * @returns balance.variance - Absolute difference (|debit - credit|)
 * 
 * @example
 * ```typescript
 * const balance = await validateJournalBalance(journalId);
 * 
 * if (balance.balanced) {
 *   console.log('Journal is balanced');
 * } else {
 *   console.error(`Out of balance by ${balance.variance}`);
 * }
 * ```
 * 
 * @see {@link validateLinesBalance} for pre-insert validation
 * @see {@link postJournal} which uses this before posting
 */
export async function validateJournalBalance(journalId: string): Promise<JournalBalance> {
    const { data: lines, error } = await supabaseServer
        .from('journal_lines')
        .select('debit, credit')
        .eq('journal_id', journalId);

    if (error) throw error;

    if (!lines || lines.length === 0) {
        throw new Error('Journal has no lines');
    }

    const total_debit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const total_credit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const variance = Math.abs(total_debit - total_credit);

    return {
        balanced: variance < 0.01, // Allow for rounding errors
        total_debit,
        total_credit,
        variance,
    };
}

/**
 * Validates lines balance before database insertion (client-side validation).
 * 
 * Use this for early validation before attempting to create a journal.
 * Prevents unnecessary database operations if lines don't balance.
 * 
 * @param lines - Array of journal lines to validate
 * 
 * @throws {Error} If no lines provided
 * 
 * @returns Balance validation result
 * 
 * @example
 * ```typescript
 * const lines = [
 *   { account_code: '1010', debit: 100, credit: 0 },
 *   { account_code: '4010', debit: 0, credit: 100 }
 * ];
 * 
 * const balance = validateLinesBalance(lines);
 * if (!balance.balanced) {
 *   throw new Error('Lines must balance before submission');
 * }
 * ```
 * 
 * @see {@link createJournal} which calls this automatically
 */
export function validateLinesBalance(lines: JournalLine[]): JournalBalance {
    if (!lines || lines.length === 0) {
        throw new Error('No journal lines provided');
    }

    const total_debit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const total_credit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const variance = Math.abs(total_debit - total_credit);

    return {
        balanced: variance < 0.01,
        total_debit,
        total_credit,
        variance,
    };
}

/**
 * Posts a draft journal entry to the general ledger.
 * 
 * **Posting Process:**
 * 1. Validates journal is in 'draft' status
 * 2. Re-validates period is open
 * 3. Re-validates lines balance
 * 4. Updates status to 'posted' with timestamp and user
 * 
 * Once posted, a journal cannot be modified, only reversed.
 * 
 * @param journalId - UUID of the journal to post
 * @param userId - UUID of user posting the journal
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If journal not in draft status
 * @throws {Error} If lines don't balance
 * @throws {Error} If database update fails
 * 
 * @returns Promise that resolves when posting complete
 * 
 * @example
 * ```typescript
 * // Create journal
 * const journal = await createJournal(header, lines, userId);
 * 
 * // Review and approve...
 * 
 * // Post to ledger
 * await postJournal(journal.id, userId);
 * console.log('Journal posted to GL');
 * ```
 * 
 * @see {@link createJournal} for creating journals
 * @see {@link reverseJournal} for reversing posted journals
 */
export async function postJournal(journalId: string, userId: string): Promise<void> {
    // Get journal with period
    const { data: journal, error: journalError } = await supabaseServer
        .from('journals')
        .select('*, period:accounting_periods(*)')
        .eq('id', journalId)
        .single();

    if (journalError) throw journalError;

    if (journal.status !== 'draft') {
        throw new Error(`Journal is not in draft status: ${journal.status}`);
    }

    // Validate period is open
    await validatePeriodIsOpen(journal.period_id);

    // Validate balance
    const balance = await validateJournalBalance(journalId);
    if (!balance.balanced) {
        throw new Error(
            `Cannot post unbalanced journal. Debit: ${balance.total_debit}, Credit: ${balance.total_credit}`
        );
    }

    // Post the journal
    const { error: updateError } = await supabaseServer
        .from('journals')
        .update({
            status: 'posted',
            posted_at: new Date().toISOString(),
            posted_by: userId,
        })
        .eq('id', journalId);

    if (updateError) throw updateError;
}

/**
 * Reverses a posted journal entry by creating an offsetting entry.
 * 
 * **Reversal Process:**
 * 1. Validates original journal is posted
 * 2. Creates new journal with debits/credits swapped
 * 3. Auto-posts the reversal journal
 * 4. Updates original journal status to 'reversed'
 * 5. Links reversal to original for audit trail
 * 
 * The reversal journal has debits and credits swapped, effectively
 * undoing the original journal's impact on account balances.
 * 
 * @param journalId - UUID of the journal to reverse
 * @param reversalDate - Date for the reversal journal entry
 * @param userId - UUID of user creating the reversal
 * 
 * @throws {Error} If original journal is not posted
 * @throws {Error} If reversal period is closed
 * @throws {Error} If database operations fail
 * 
 * @returns Promise resolving to reversal journal info
 * 
 * @example
 * ```typescript
 * // Reverse a posted journal
 * const reversal = await reverseJournal(
 *   originalJournalId,
 *   '2025-01-20',  // Reversal date
 *   userId
 * );
 * 
 * console.log(`Created reversal: ${reversal.journal_number}`);
 * // Result: "JE-2025-001-REV"
 * ```
 * 
 * @example
 * ```typescript
 * // Original journal:
 * // DR Cash          1000
 * // CR Sales Revenue 1000
 * 
 * // Reversal automatically creates:
 * // DR Sales Revenue 1000  (swapped)
 * // CR Cash          1000  (swapped)
 * ```
 * 
 * @see {@link postJournal} for posting journals
 * @see {@link createJournal} for creating journals
 */
export async function reverseJournal(
    journalId: string,
    reversalDate: string,
    userId: string
): Promise<{ id: string; journal_number: string }> {
    // Get original journal with lines
    const { data: original, error } = await supabaseServer
        .from('journals')
        .select('*, lines:journal_lines(*)')
        .eq('id', journalId)
        .single();

    if (error) throw error;

    if (original.status !== 'posted') {
        throw new Error('Can only reverse posted journals');
    }

    // Create reversal (swap debit/credit)
    const reversalLines: JournalLine[] = original.lines.map((line: any) => ({
        account_code: line.account_code,
        debit: line.credit, // Swap
        credit: line.debit, // Swap
        description: `Reversal of ${original.journal_number}: ${line.description || ''}`,
    }));

    const reversalHeader: JournalHeader = {
        company_id: original.company_id,
        period_id: original.period_id,
        journal_number: `${original.journal_number}-REV`,
        journal_date: reversalDate,
        description: `Reversal of ${original.journal_number}`,
        reference_type: 'REVERSAL',
        reference_id: journalId,
    };

    const reversal = await createJournal(reversalHeader, reversalLines, userId);

    // Auto-post the reversal
    await postJournal(reversal.id, userId);

    // Update original journal
    await supabaseServer
        .from('journals')
        .update({
            status: 'reversed',
            reversed_at: new Date().toISOString(),
            reversed_by: userId,
            reversal_journal_id: reversal.id,
        })
        .eq('id', journalId);

    return reversal;
}
