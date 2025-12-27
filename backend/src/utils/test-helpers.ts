/**
 * Test Utilities
 * Helper functions for integration tests
 */
import { supabaseServer } from '../config/supabase';

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(companyId: string) {
    // Delete in reverse dependency order
    await supabaseServer.from('journal_lines').delete().eq('company_id', companyId);
    await supabaseServer.from('journals').delete().eq('company_id', companyId);
    await supabaseServer.from('finished_goods_ledger').delete().eq('company_id', companyId);
    await supabaseServer.from('wip_ledger').delete().eq('company_id', companyId);
    await supabaseServer.from('raw_material_ledger').delete().eq('company_id', companyId);
    await supabaseServer.from('inventory_adjustment_lines').delete().eq('company_id', companyId);
    await supabaseServer.from('inventory_adjustments').delete().eq('company_id', companyId);
    await supabaseServer.from('internal_transfer_lines').delete().eq('company_id', companyId);
    await supabaseServer.from('internal_transfers').delete().eq('company_id', companyId);
}

/**
 * Create test company
 */
export async function createTestCompany() {
    const { data, error } = await supabaseServer
        .from('companies')
        .insert({
            name: `Test Company ${Date.now()}`,
            code: `TEST${Date.now()}`,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create test accounting period
 */
export async function createTestPeriod(companyId: string, status: 'open' | 'closed' = 'open') {
    const { data, error } = await supabaseServer
        .from('accounting_periods')
        .insert({
            company_id: companyId,
            name: `Test Period ${Date.now()}`,
            start_date: '2025-01-01',
            end_date: '2025-01-31',
            status,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create test warehouse
 */
export async function createTestWarehouse(companyId: string) {
    const { data, error } = await supabaseServer
        .from('warehouses')
        .insert({
            company_id: companyId,
            code: `WH${Date.now()}`,
            name: `Test Warehouse ${Date.now()}`,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create test material
 */
export async function createTestMaterial(companyId: string) {
    const { data, error } = await supabaseServer
        .from('materials')
        .insert({
            company_id: companyId,
            code: `MAT${Date.now()}`,
            name: `Test Material ${Date.now()}`,
            unit_price: 100,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Create test product
 */
export async function createTestProduct(companyId: string) {
    const { data, error } = await supabaseServer
        .from('products')
        .insert({
            company_id: companyId,
            code: `PROD${Date.now()}`,
            name: `Test Product ${Date.now()}`,
            unit_price: 500,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Wait for async operations
 */
export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
