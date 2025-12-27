/**
 * Period Validation Service
 * Validates accounting period status before transactions
 */
import { supabaseServer } from '../config/supabase';

export interface AccountingPeriod {
    id: string;
    company_id: string;
    name: string;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed';
}

/**
 * Validates that an accounting period is open for posting transactions.
 * 
 * This is a critical validation function used by ALL transaction services to ensure
 * transactions are only posted to open accounting periods. Prevents backdating to
 * closed periods and maintains period-end control integrity.
 * 
 * @param periodId - UUID of the accounting period to validate
 * @throws {Error} If period is not found
 * @throws {Error} If period status is not 'open' (e.g., 'closed')
 * @returns Promise that resolves when validation succeeds, rejects with error otherwise
 * 
 * @example
 * ```typescript
 * // In transaction service
 * await validatePeriodIsOpen(params.period_id);
 * // Proceed with transaction posting...
 * ```
 * 
 * @see {@link closePeriod} for closing accounting periods
 * @see {@link reopenPeriod} for reopening closed periods
 */
export async function validatePeriodIsOpen(periodId: string): Promise<void> {
    const { data: period, error } = await supabaseServer
        .from('accounting_periods')
        .select('id, status, name')
        .eq('id', periodId)
        .single();

    if (error) {
        throw new Error(`Period not found: ${error.message}`);
    }

    if (period.status !== 'open') {
        throw new Error(`Cannot post to closed period: ${period.name}`);
    }
}

/**
 * Get open period for a company
 */
export async function getOpenPeriod(companyId: string): Promise<AccountingPeriod | null> {
    const { data, error } = await supabaseServer
        .from('accounting_periods')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Validate transaction date falls within period
 */
export async function validateTransactionDateInPeriod(
    periodId: string,
    transactionDate: string
): Promise<void> {
    const { data: period, error } = await supabaseServer
        .from('accounting_periods')
        .select('start_date, end_date, name')
        .eq('id', periodId)
        .single();

    if (error) {
        throw new Error(`Period not found: ${error.message}`);
    }

    const txDate = new Date(transactionDate);
    const startDate = new Date(period.start_date);
    const endDate = new Date(period.end_date);

    if (txDate < startDate || txDate > endDate) {
        throw new Error(
            `Transaction date ${transactionDate} is outside period ${period.name} (${period.start_date} to ${period.end_date})`
        );
    }
}

/**
 * Close accounting period
 */
export async function closePeriod(periodId: string, userId: string): Promise<void> {
    // Validate period can be closed
    await validatePeriodIsOpen(periodId);

    const { error } = await supabaseServer
        .from('accounting_periods')
        .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: userId,
        })
        .eq('id', periodId);

    if (error) throw error;
}

/**
 * Reopen accounting period
 */
export async function reopenPeriod(periodId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('accounting_periods')
        .update({
            status: 'open',
            reopened_at: new Date().toISOString(),
            reopened_by: userId,
        })
        .eq('id', periodId);

    if (error) throw error;
}
