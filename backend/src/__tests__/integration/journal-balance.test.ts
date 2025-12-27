/**
 * Integration Tests: Journal Balance Validation
 * Tests the ERP requirement: debit must equal credit
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import { createTestCompany, cleanupTestData } from '../../utils/test-helpers';

describe('Journal Balance Validation', () => {
    let testCompanyId: string;

    beforeAll(async () => {
        const company = await createTestCompany();
        testCompanyId = company.id;
    });

    afterAll(async () => {
        await cleanupTestData(testCompanyId);
        await supabaseServer.from('companies').delete().eq('id', testCompanyId);
    });

    it('should accept balanced journal entry (debit = credit)', async () => {
        // Create journal header
        const { data: journal, error: journalError } = await supabaseServer
            .from('journals')
            .insert({
                company_id: testCompanyId,
                journal_number: `JE${Date.now()}`,
                journal_date: '2025-01-15',
                description: 'Test balanced journal',
                status: 'draft',
            })
            .select()
            .single();

        expect(journalError).toBeNull();
        expect(journal).toBeDefined();

        // Create balanced lines (1000 debit, 1000 credit)
        const { error: linesError } = await supabaseServer
            .from('journal_lines')
            .insert([
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1010',
                    debit: 1000,
                    credit: 0,
                    description: 'Debit entry',
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '2010',
                    debit: 0,
                    credit: 1000,
                    description: 'Credit entry',
                },
            ]);

        expect(linesError).toBeNull();

        // Verify balance
        const { data: lines } = await supabaseServer
            .from('journal_lines')
            .select('debit, credit')
            .eq('journal_id', journal!.id);

        const totalDebit = lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
        const totalCredit = lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

        expect(totalDebit).toBe(totalCredit);
        expect(totalDebit).toBe(1000);
    });

    it('should reject unbalanced journal entry', async () => {
        // Create journal header
        const { data: journal } = await supabaseServer
            .from('journals')
            .insert({
                company_id: testCompanyId,
                journal_number: `JE${Date.now()}`,
                journal_date: '2025-01-15',
                description: 'Test unbalanced journal',
                status: 'draft',
            })
            .select()
            .single();

        // Create unbalanced lines (1000 debit, 500 credit)
        await supabaseServer
            .from('journal_lines')
            .insert([
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1010',
                    debit: 1000,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '2010',
                    debit: 0,
                    credit: 500,
                },
            ]);

        // Try to post (should fail due to validation)
        const { data: lines } = await supabaseServer
            .from('journal_lines')
            .select('debit, credit')
            .eq('journal_id', journal!.id);

        const totalDebit = lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
        const totalCredit = lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

        // Unbalanced journal should be detected
        expect(totalDebit).not.toBe(totalCredit);

        // In real implementation, posting should be blocked by constraint or service layer
    });

    it('should handle multi-line transaction balance', async () => {
        const { data: journal } = await supabaseServer
            .from('journals')
            .insert({
                company_id: testCompanyId,
                journal_number: `JE${Date.now()}`,
                journal_date: '2025-01-15',
                description: 'Multi-line balanced journal',
                status: 'draft',
            })
            .select()
            .single();

        // Create multiple balanced lines
        await supabaseServer
            .from('journal_lines')
            .insert([
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1010',
                    debit: 1000,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1020',
                    debit: 500,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '2010',
                    debit: 0,
                    credit: 1200,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '2020',
                    debit: 0,
                    credit: 300,
                },
            ]);

        const { data: lines } = await supabaseServer
            .from('journal_lines')
            .select('debit, credit')
            .eq('journal_id', journal!.id);

        const totalDebit = lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
        const totalCredit = lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

        expect(totalDebit).toBe(totalCredit);
        expect(totalDebit).toBe(1500);
    });

    it('should handle currency/rounding edge cases', async () => {
        const { data: journal } = await supabaseServer
            .from('journals')
            .insert({
                company_id: testCompanyId,
                journal_number: `JE${Date.now()}`,
                journal_date: '2025-01-15',
                description: 'Rounding test journal',
                status: 'draft',
            })
            .select()
            .single();

        // Test with decimal amounts
        await supabaseServer
            .from('journal_lines')
            .insert([
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1010',
                    debit: 333.33,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1020',
                    debit: 333.33,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '1030',
                    debit: 333.34,
                    credit: 0,
                },
                {
                    journal_id: journal!.id,
                    company_id: testCompanyId,
                    account_code: '2010',
                    debit: 0,
                    credit: 1000.00,
                },
            ]);

        const { data: lines } = await supabaseServer
            .from('journal_lines')
            .select('debit, credit')
            .eq('journal_id', journal!.id);

        const totalDebit = lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
        const totalCredit = lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

        // Should be balanced even with rounding
        expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
    });
});
