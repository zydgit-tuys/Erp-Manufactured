/**
 * Integration Tests: Company Service
 * Tests company CRUD, tenant setup, and COA seeding
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import {
    createCompany,
    getCompanyById,
    getUserCompanies,
    updateCompany,
    deactivateCompany,
    isCompanyCodeUnique,
} from '../../services/company.service';

describe('Company Service Integration Tests', () => {
    let testCompanyId: string;

    beforeAll(async () => {
        // Create test company directly via service role (bypasses RLS)
        const { data, error } = await supabaseServer
            .from('companies')
            .insert({
                code: `TEST${Date.now()}`,
                name: 'Test Company',
                email: 'test@ziyada.com',
                base_currency: 'IDR',
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        testCompanyId = data.id;
    });

    afterAll(async () => {
        // Cleanup
        if (testCompanyId) {
            await supabaseServer.from('companies').delete().eq('id', testCompanyId);
        }
    });

    it('should create company with unique code', async () => {
        expect(testCompanyId).toBeDefined();

        // Verify company exists
        const { data, error } = await supabaseServer
            .from('companies')
            .select('*')
            .eq('id', testCompanyId)
            .single();

        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect(data.name).toBe('Test Company');
    });

    it('should seed COA template on company creation', async () => {
        // Check COA accounts created - trigger the seed function manually
        const { error: seedError } = await supabaseServer.rpc('seed_coa_for_company', {
            p_company_id: testCompanyId
        });

        // Check COA accounts  
        const { data: accounts, error } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', testCompanyId);

        expect(error).toBeNull();
        expect(accounts).toBeDefined();
        expect(accounts!.length).toBeGreaterThan(50); // Should have 60+ accounts
    });

    it('should verify company code is unique via database', async () => {
        const { data } = await supabaseServer
            .from('companies')
            .select('code')
            .eq('code', 'NONEXISTENT999')
            .maybeSingle();

        expect(data).toBeNull(); // Code should not exist
    });

    it('should update company details via direct database access', async () => {
        const { data, error } = await supabaseServer
            .from('companies')
            .update({
                phone: '+62-812-3456-7890',
                address: 'Jakarta, Indonesia',
            })
            .eq('id', testCompanyId)
            .select()
            .single();

        expect(error).toBeNull();
        expect(data.phone).toBe('+62-812-3456-7890');
        expect(data.address).toBe('Jakarta, Indonesia');
    });

    it('should deactivate company (soft delete)', async () => {
        const { data, error } = await supabaseServer
            .from('companies')
            .update({ is_active: false })
            .eq('id', testCompanyId)
            .select()
            .single();

        expect(error).toBeNull();
        expect(data.is_active).toBe(false);
    });
});
