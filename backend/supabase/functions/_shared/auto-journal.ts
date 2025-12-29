// Auto Journal Utility
// Automatically creates journal entries for transactions
// Follows RULES.md: Business logic in Edge Functions

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createLogger } from './logger.ts';

export interface JournalEntryLine {
    account_id: string;
    debit: number;
    credit: number;
    description?: string;
}

export interface CreateJournalParams {
    company_id: string;
    transaction_date: string;
    reference_type: string;
    reference_id: string;
    reference_number: string;
    description: string;
    lines: JournalEntryLine[];
    created_by: string;
}

/**
 * Generate next journal number for company
 */
async function generateJournalNumber(
    supabase: SupabaseClient,
    company_id: string
): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JV-${year}-`;

    // Get last journal number for this year
    const { data, error } = await supabase
        .from('journals')
        .select('journal_number')
        .eq('company_id', company_id)
        .like('journal_number', `${prefix}%`)
        .order('journal_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw error;
    }

    if (!data) {
        return `${prefix}00001`;
    }

    // Extract number and increment
    const lastNumber = parseInt(data.journal_number.split('-')[2]);
    const nextNumber = (lastNumber + 1).toString().padStart(5, '0');
    return `${prefix}${nextNumber}`;
}

/**
 * Create automatic journal entry
 * Validates balanced entry and creates journal header + lines
 */
export async function createAutoJournal(
    supabase: SupabaseClient,
    params: CreateJournalParams,
    requestId?: string
): Promise<{ journal_id: string; journal_number: string }> {
    const logger = createLogger({
        requestId,
        operation: 'create-auto-journal',
        company_id: params.company_id
    });

    logger.info('Creating auto journal entry', {
        reference_type: params.reference_type,
        reference_number: params.reference_number,
        line_count: params.lines.length
    });

    // 1. Validate balanced entry
    const totalDebit = params.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = params.lines.reduce((sum, line) => sum + line.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);

    if (difference > 0.01) {
        logger.error('Unbalanced journal entry', {
            totalDebit,
            totalCredit,
            difference
        });
        throw new Error(
            `Unbalanced journal entry: Debit=${totalDebit}, Credit=${totalCredit}, Diff=${difference}`
        );
    }

    logger.debug('Journal entry is balanced', { totalDebit, totalCredit });

    // 2. Generate journal number
    const journalNumber = await generateJournalNumber(supabase, params.company_id);
    logger.debug('Generated journal number', { journalNumber });

    // 3. Create journal header
    const { data: journal, error: journalError } = await supabase
        .from('journals')
        .insert({
            company_id: params.company_id,
            journal_number: journalNumber,
            journal_date: params.transaction_date,
            reference_type: params.reference_type,
            reference_id: params.reference_id,
            reference_number: params.reference_number,
            description: params.description,
            created_by: params.created_by,
        })
        .select()
        .single();

    if (journalError) {
        logger.error('Failed to create journal header', journalError);
        throw journalError;
    }

    logger.debug('Journal header created', { journal_id: journal.id });

    // 4. Create journal lines
    const journalLines = params.lines.map(line => ({
        journal_id: journal.id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description || params.description,
    }));

    const { error: linesError } = await supabase
        .from('journal_lines')
        .insert(journalLines);

    if (linesError) {
        logger.error('Failed to create journal lines', linesError);
        throw linesError;
    }

    logger.info('Auto journal created successfully', {
        journal_id: journal.id,
        journal_number: journalNumber,
        lines_created: journalLines.length
    });

    return {
        journal_id: journal.id,
        journal_number: journalNumber
    };
}

/**
 * Validate journal entry before creation
 * Returns validation errors if any
 */
export function validateJournalEntry(lines: JournalEntryLine[]): string[] {
    const errors: string[] = [];

    if (lines.length === 0) {
        errors.push('Journal entry must have at least one line');
    }

    if (lines.length === 1) {
        errors.push('Journal entry must have at least two lines');
    }

    // Check for negative amounts
    lines.forEach((line, index) => {
        if (line.debit < 0) {
            errors.push(`Line ${index + 1}: Debit amount cannot be negative`);
        }
        if (line.credit < 0) {
            errors.push(`Line ${index + 1}: Credit amount cannot be negative`);
        }
        if (line.debit > 0 && line.credit > 0) {
            errors.push(`Line ${index + 1}: Cannot have both debit and credit`);
        }
        if (line.debit === 0 && line.credit === 0) {
            errors.push(`Line ${index + 1}: Must have either debit or credit`);
        }
    });

    // Check balance
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);

    if (difference > 0.01) {
        errors.push(`Unbalanced entry: Debit=${totalDebit}, Credit=${totalCredit}`);
    }

    return errors;
}
