// Account Mapping Helper
// Retrieves system account mappings for auto journaling

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * System account mapping codes
 */
export const ACCOUNT_MAPPINGS = {
    // Inventory Accounts
    INVENTORY_RAW_MATERIALS: 'INVENTORY_RAW_MATERIALS',
    INVENTORY_WIP: 'INVENTORY_WIP',
    INVENTORY_FINISHED_GOODS: 'INVENTORY_FINISHED_GOODS',

    // Payables
    ACCOUNTS_PAYABLE_ACCRUED: 'ACCOUNTS_PAYABLE_ACCRUED',
    ACCOUNTS_PAYABLE: 'ACCOUNTS_PAYABLE',

    // Receivables
    ACCOUNTS_RECEIVABLE: 'ACCOUNTS_RECEIVABLE',

    // Revenue & Expenses
    SALES_REVENUE: 'SALES_REVENUE',
    COST_OF_GOODS_SOLD: 'COST_OF_GOODS_SOLD',

    // Variances
    INVENTORY_VARIANCE: 'INVENTORY_VARIANCE',
    PURCHASE_PRICE_VARIANCE: 'PURCHASE_PRICE_VARIANCE',

    // Cash & Bank
    CASH_IN_HAND: 'CASH_IN_HAND',
    BANK_ACCOUNT: 'BANK_ACCOUNT',
} as const;

export type AccountMappingCode = keyof typeof ACCOUNT_MAPPINGS;

/**
 * Get system account ID for a mapping code
 * Throws error if mapping not found
 */
export async function getSystemAccount(
    supabase: SupabaseClient,
    company_id: string,
    mapping_code: AccountMappingCode
): Promise<string> {
    const { data, error } = await supabase
        .from('system_account_mappings')
        .select('account_id')
        .eq('company_id', company_id)
        .eq('mapping_code', mapping_code)
        .single();

    if (error || !data) {
        throw new Error(
            `Account mapping not found: ${mapping_code}. Please configure in Settings.`
        );
    }

    return data.account_id;
}

/**
 * Get multiple system accounts at once
 * More efficient than multiple individual calls
 */
export async function getSystemAccounts(
    supabase: SupabaseClient,
    company_id: string,
    mapping_codes: AccountMappingCode[]
): Promise<Record<AccountMappingCode, string>> {
    const { data, error } = await supabase
        .from('system_account_mappings')
        .select('mapping_code, account_id')
        .eq('company_id', company_id)
        .in('mapping_code', mapping_codes);

    if (error) {
        throw error;
    }

    if (!data || data.length !== mapping_codes.length) {
        const found = data?.map(d => d.mapping_code) || [];
        const missing = mapping_codes.filter(code => !found.includes(code));
        throw new Error(
            `Missing account mappings: ${missing.join(', ')}. Please configure in Settings.`
        );
    }

    const result: Record<string, string> = {};
    data.forEach(row => {
        result[row.mapping_code] = row.account_id;
    });

    return result as Record<AccountMappingCode, string>;
}

/**
 * Check if all required account mappings exist for a company
 */
export async function validateAccountMappings(
    supabase: SupabaseClient,
    company_id: string,
    required_mappings: AccountMappingCode[]
): Promise<{ valid: boolean; missing: AccountMappingCode[] }> {
    const { data, error } = await supabase
        .from('system_account_mappings')
        .select('mapping_code')
        .eq('company_id', company_id)
        .in('mapping_code', required_mappings);

    if (error) {
        throw error;
    }

    const found = data?.map(d => d.mapping_code as AccountMappingCode) || [];
    const missing = required_mappings.filter(code => !found.includes(code));

    return {
        valid: missing.length === 0,
        missing
    };
}
