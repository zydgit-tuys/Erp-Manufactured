import { supabaseServer } from '../config/supabase';

export interface TrialBalanceItem {
    account_id: string;
    account_code: string;
    account_name: string;
    account_type: string;
    total_debit: number;
    total_credit: number;
    net_balance: number;
}

export interface FinancialStatementItem {
    section: string;
    category: string;
    account_code: string;
    account_name: string;
    balance: number;
}

export interface PeriodClosingStep {
    step_name: string;
    status: 'pending' | 'started' | 'completed' | 'failed';
    message?: string;
}

// ==================== FINANCIAL REPORTS ====================

/**
 * Generates Trial Balance for a specific period.
 * 
 * @param companyId - Company UUID
 * @param periodId - Accounting Period UUID
 */
export async function getTrialBalance(
    companyId: string,
    periodId: string
): Promise<TrialBalanceItem[]> {
    const { data, error } = await supabaseServer.rpc('get_trial_balance', {
        p_company_id: companyId,
        p_period_id: periodId
    });

    if (error) throw error;
    return data || [];
}

/**
 * Generates Balance Sheet (Assets = Liabilities + Equity).
 * 
 * @param companyId - Company UUID
 * @param periodId - Accounting Period UUID (As of End Date)
 */
export async function getBalanceSheet(
    companyId: string,
    periodId: string
): Promise<FinancialStatementItem[]> {
    const { data, error } = await supabaseServer.rpc('get_balance_sheet', {
        p_company_id: companyId,
        p_period_id: periodId
    });

    if (error) throw error;
    return data || [];
}

/**
 * Generates Income Statement (Revenue - Expenses).
 * 
 * @param companyId - Company UUID
 * @param periodId - Accounting Period UUID (For the period range)
 */
export async function getIncomeStatement(
    companyId: string,
    periodId: string
): Promise<FinancialStatementItem[]> {
    const { data, error } = await supabaseServer.rpc('get_income_statement', {
        p_company_id: companyId,
        p_period_id: periodId
    });

    if (error) throw error;
    return data || [];
}

// ==================== PERIOD CLOSING ====================

/**
 * Closes an accounting period after validating system state.
 * 
 * **Validation Steps:**
 * 1. Check for unposted journal entries
 * 2. Check for hanging WIP (warning only)
 * 3. Verify Trial Balance is balanced
 * 
 * @param companyId - Company UUID
 * @param periodId - Period to close
 * @param userId - User performing close
 */
export async function closeAccountingPeriod(
    companyId: string,
    periodId: string,
    userId: string
): Promise<void> {
    // 1. Get period details
    const { data: period, error: pError } = await supabaseServer
        .from('accounting_periods')
        .select('*')
        .eq('id', periodId)
        .single();

    if (pError || !period) throw new Error('Period not found');
    if (period.status !== 'open') throw new Error('Period is not open');

    // 2. LOG: Start Closing
    await logClosingStep(companyId, periodId, 'init_closing', 'started', 'Period closing initiated', userId);

    try {
        // 3. CHECK: Unposted journals
        const { count: unpostedCount, error: jError } = await supabaseServer
            .from('journals')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .eq('period_id', periodId)
            .eq('status', 'draft');

        if (jError) throw jError;

        if (unpostedCount && unpostedCount > 0) {
            throw new Error(`Cannot close period: Found ${unpostedCount} unposted journal entries.`);
        }

        await logClosingStep(companyId, periodId, 'check_unposted', 'completed', 'No unposted entries found', userId);

        // 3b. CHECK: Active Production (Strict WIP Check)
        // Ensure no active production orders started in this period remain open.
        // This enforces "WIP Balance = 0" (or close to it) before closing.
        const { count: wipCount, error: wError } = await supabaseServer
            .from('production_orders')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', companyId)
            .lt('start_date', period.end_date) // Started before period end
            .in('status', ['planned', 'in_progress']); // Not completed

        if (wError) throw wError;

        if (wipCount && wipCount > 0) {
            throw new Error(`Cannot close period: Found ${wipCount} active Production Orders (WIP) started before period end. Please complete or cancel them.`);
        }
        await logClosingStep(companyId, periodId, 'check_wip', 'completed', 'No active WIP found', userId);

        // 4. CHECK: Trial Balance Balance
        // Sum of all net balances should be 0 (Debits = Credits)
        const tb = await getTrialBalance(companyId, periodId);
        const totalNet = tb.reduce((sum, item) => sum + item.net_balance, 0);

        // Allow small floating point error
        if (Math.abs(totalNet) > 0.01) {
            throw new Error(`Trial Balance is not balanced. Net difference: ${totalNet}`);
        }

        await logClosingStep(companyId, periodId, 'check_tb_balance', 'completed', 'Trial Balance is balanced', userId);

        // 5. UPDATE: Close Period
        const { error: updateError } = await supabaseServer
            .from('accounting_periods')
            .update({
                status: 'closed',
                closed_at: new Date().toISOString(),
                closed_by: userId
            })
            .eq('id', periodId);

        if (updateError) throw updateError;

        await logClosingStep(companyId, periodId, 'final_lock', 'completed', 'Period closed successfully', userId);

    } catch (error) {
        await logClosingStep(companyId, periodId, 'closing_failed', 'failed', (error as Error).message, userId);
        throw error;
    }
}

async function logClosingStep(
    companyId: string,
    periodId: string,
    step: string,
    status: string,
    message: string,
    userId: string
) {
    await supabaseServer
        .from('period_closing_logs')
        .upsert({
            company_id: companyId,
            period_id: periodId,
            step_name: step,
            status: status,
            message: message,
            created_by: userId
        }, { onConflict: 'period_id, step_name' });
}
