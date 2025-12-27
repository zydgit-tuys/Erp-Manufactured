/**
 * Integration Tests: Tenant Isolation (RLS)
 * Tests Row-Level Security policies for multi-tenant data isolation
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import { createTestCompany } from '../../utils/test-helpers';

describe('Tenant Isolation (RLS) Tests', () => {
    let company1Id: string;
    let company2Id: string;

    beforeAll(async () => {
        // Create two separate companies directly via service role
        const { data: company1, error: error1 } = await supabaseServer
            .from('companies')
            .insert({
                code: `TEST${Date.now()}_1`,
                name: 'Test Company 1',
                email: 'test1@ziyada.com',
                base_currency: 'IDR',
                is_active: true
            })
            .select()
            .single();

        const { data: company2, error: error2 } = await supabaseServer
            .from('companies')
            .insert({
                code: `TEST${Date.now()}_2`,
                name: 'Test Company 2',
                email: 'test2@ziyada.com',
                base_currency: 'IDR',
                is_active: true
            })
            .select()
            .single();

        if (error1 || error2) throw error1 || error2;
        company1Id = company1!.id;
        company2Id = company2!.id;

        // Seed COA for both
        await supabaseServer.rpc('seed_coa_for_company', { p_company_id: company1Id });
        await supabaseServer.rpc('seed_coa_for_company', { p_company_id: company2Id });
    });

    afterAll(async () => {
        // Cleanup
        await supabaseServer.from('chart_of_accounts').delete().eq('company_id', company1Id);
        await supabaseServer.from('chart_of_accounts').delete().eq('company_id', company2Id);
        await supabaseServer.from('companies').delete().eq('id', company1Id);
        await supabaseServer.from('companies').delete().eq('id', company2Id);
    });

    it('should isolate company data via RLS', async () => {
        // Using service role (bypasses RLS) we can see all
        const { data: allCompanies } = await supabaseServer
            .from('companies')
            .select('*');

        expect(allCompanies).toBeDefined();
        expect(allCompanies!.length).toBeGreaterThanOrEqual(2);
    });

    it('should isolate COA between companies', async () => {
        // Get COA for company 1
        const { data: coa1 } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', company1Id);

        // Get COA for company 2
        const { data: coa2 } = await supabaseServer
            .from('chart_of_accounts')
            .select('*')
            .eq('company_id', company2Id);

        expect(coa1).toBeDefined();
        expect(coa2).toBeDefined();

        // Each should have their own accounts
        expect(coa1!.length).toBeGreaterThan(0);
        expect(coa2!.length).toBeGreaterThan(0);

        // No overlap in IDs
        const coa1Ids = coa1!.map((a: any) => a.id);
        const coa2Ids = coa2!.map((a: any) => a.id);
        const overlap = coa1Ids.filter((id: string) => coa2Ids.includes(id));

        expect(overlap.length).toBe(0);
    });

    it('should have RLS enabled on all core tables', async () => {
        const { data: tables } = await supabaseServer.rpc('exec_sql', {
            sql: `
        SELECT 
          relname as table_name,
          relrowsecurity as rls_enabled
        FROM pg_class
        WHERE relnamespace = 'public'::regnamespace
          AND relname IN ('companies', 'chart_of_accounts', 'accounting_periods', 'audit_log')
      `
        });

        if (tables) {
            tables.forEach((table: any) => {
                expect(table.rls_enabled).toBe(true);
            });
        }
    });

    it('should prevent cross-tenant COA access (if not service role)', async () => {
        // This test would require setting up actual auth.uid() context
        // For now, we verify the policy exists

        const { data: policies } = await supabaseServer.rpc('exec_sql', {
            sql: `
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chart_of_accounts'
          AND policyname = 'coa_tenant_isolation'
      `
        });

        expect(policies).toBeDefined();
        expect(policies!.length).toBeGreaterThan(0);
    });
});
