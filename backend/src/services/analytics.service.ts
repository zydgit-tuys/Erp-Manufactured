import { supabaseServer } from '../config/supabase';

// ==================== ANALYTICS SERVICE (Module M8) ====================

/**
 * Triggers a refresh of all analytics Materialized Views.
 * Call this periodically (e.g., nightly cron) or on-demand by Admin.
 */
export async function refreshAnalyticsData(): Promise<void> {
    const { error } = await supabaseServer.rpc('refresh_analytics_mvs');
    if (error) throw error;
}

/**
 * Retrieves current inventory valuation snapshot.
 * Data is consistent as of last refresh.
 */
export async function getInventoryValuation(companyId: string) {
    const { data, error } = await supabaseServer
        .from('mv_inventory_valuation')
        .select('*')
        .eq('company_id', companyId);

    if (error) throw error;
    return data || [];
}

/**
 * Retrieves sales performance trends over a date range.
 * Aggregates POS and Distributor sales.
 */
export async function getSalesPerformance(
    companyId: string,
    startDate: string,
    endDate: string
) {
    const { data, error } = await supabaseServer
        .from('mv_sales_performance')
        .select('*')
        .eq('company_id', companyId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * Retrieves financial summary (Revenue vs Expense) per period.
 * Useful for high-level dashboard cards.
 */
export async function getFinancialSummary(companyId: string) {
    const { data, error } = await supabaseServer
        .from('mv_financial_summary')
        .select('*')
        .eq('company_id', companyId)
        .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
}
