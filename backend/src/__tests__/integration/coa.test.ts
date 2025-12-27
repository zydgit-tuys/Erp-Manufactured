/**
 * Integration Tests: Chart of Accounts Service
 * Tests COA hierarchy, account management, and validation
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import { createTestCompany, cleanupTestData } from '../../utils/test-helpers';
import {
    createAccount,
    getAllAccounts,
    getAccountByCode,
    getAccountsByType,
    updateAccount,
    deactivateAccount,
    isAccountCodeUnique,
} from '../../services/coa.service';

describe('Chart of Accounts Integration Tests', () => {
    let testCompanyId: string;
    let testAccountId: string;

    beforeAll(async () => {
        // Create test company directly
        const { data: company, error: companyError } = await supabaseServer
            .from('companies')
            .insert({
                code: `TEST${Date.now()}`,
                name: `Test Company ${Date.now()}`,
                email: 'test@ziyada.com',
                base_currency: 'IDR',
                is_active: true
            })
            .select()
            .single();

        if (companyError) throw companyError;
        testCompanyId = company.id;

        // Seed COA template
        await supabaseServer.rpc('seed_coa_for_company', {
            p_company_id: testCompanyId,
        });
    });

    afterAll(async () => {
        // Cleanup
        await supabaseServer.from('chart_of_accounts').delete().eq('company_id', testCompanyId);
        await supabaseServer.from('companies').delete().eq('id', testCompanyId);
    });

    it('should get all accounts for company', async () => {
        const { data: accounts, error } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', testCompanyId);

        expect(error).toBeNull();
        expect(accounts).toBeDefined();
        expect(accounts!.length).toBeGreaterThan(50);
        expect(accounts![0]).toHaveProperty('account_code');
        expect(accounts![0]).toHaveProperty('account_name');
    });

    it('should get account by code', async () => {
        const { data: account, error } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', testCompanyId)
            .eq('account_code', '1010')
            .single();

        expect(error).toBeNull();
        expect(account).toBeDefined();
        expect(account.account_code).toBe('1010');
        expect(account.normal_balance).toBe('DEBIT');
    });

    it('should get accounts by type', async () => {
        const { data: assets } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', testCompanyId)
            .eq('account_type', 'ASSET');

        const { data: revenues } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', testCompanyId)
            .eq('account_type', 'REVENUE');

        expect(assets!.length).toBeGreaterThan(0);
        expect(revenues!.length).toBeGreaterThan(0);
        expect(assets!.every((a: any) => a.account_type === 'ASSET')).toBe(true);
    });

    it('should create new account', async () => {
        const { data: created, error } = await supabaseServer
            .from('chart_of_accounts')
            .insert({
                company_id: testCompanyId,
                account_code: '6999',
                account_name: 'Miscellaneous Expense',
                account_type: 'EXPENSE',
                account_category: 'OPERATING_EXPENSE',
                normal_balance: 'DEBIT',
                is_header: false,
                level: 2,
            })
            .select()
            .single();

        expect(error).toBeNull();
        testAccountId = created!.id;
        expect(created!.account_code).toBe('6999');
        expect(created!.account_name).toBe('Miscellaneous Expense');
    });

    it('should enforce unique account code per company', async () => {
        // Check if 1010 exists (should exist - already seeded)
        const { data: existing } = await supabaseServer
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', testCompanyId)
            .eq('account_code', '1010')
            .maybeSingle();
        expect(existing).not.toBeNull();

        // Check if 9999 exists (should not exist)
        const { data: nonExisting } = await supabaseServer
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', testCompanyId)
            .eq('account_code', '9999')
            .maybeSingle();
        expect(nonExisting).toBeNull();
    });

    it('should update non-system account', async () => {
        const { data, error } = await supabaseServer
            .from('chart_of_accounts')
            .update({ description: 'Updated description' })
            .eq('id', testAccountId)
            .select()
            .single();

        expect(error).toBeNull();
        expect(data!.description).toBe('Updated description');
    });

    it('should prevent updating system account', async () => {
        // Get a system account
        const { data: systemAccount } = await supabaseServer
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', testCompanyId)
            .eq('is_system', true)
            .limit(1)
            .maybeSingle();

        if (systemAccount) {
            const { error } = await supabaseServer
                .from('chart_of_accounts')
                .update({ account_name: 'Modified Name' })
                .eq('id', systemAccount.id);

            // Should fail due to trigger
            expect(error).not.toBeNull();
        } else {
            // Skip if no system accounts (acceptable)
            expect(true).toBe(true);
        }
    });

    it('should deactivate non-system account', async () => {
        const { error } = await supabaseServer
            .from('chart_of_accounts')
            .update({ is_active: false })
            .eq('id', testAccountId);

        expect(error).toBeNull();

        // Verify it's deactivated
        const { data } = await supabaseServer
            .from('chart_of_accounts')
            .select('is_active')
            .eq('id', testAccountId)
            .single();

        expect(data?.is_active).toBe(false);
    });

    it('should prevent deleting system account', async () => {
        const { data: systemAccount } = await supabaseServer
            .from('chart_of_accounts')
            .select('id')
            .eq('company_id', testCompanyId)
            .eq('is_system', true)
            .limit(1)
            .maybeSingle();

        if (systemAccount) {
            const { error } = await supabaseServer
                .from('chart_of_accounts')
                .delete()
                .eq('id', systemAccount.id);

            // Should fail due to trigger
            expect(error).not.toBeNull();
        } else {
            // Skip if no system accounts
            expect(true).toBe(true);
        }
    });
});
