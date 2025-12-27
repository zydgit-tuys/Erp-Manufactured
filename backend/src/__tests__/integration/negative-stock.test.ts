/**
 * Integration Tests: Negative Stock Prevention
 * Tests the core ERP requirement: no negative inventory
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import { receiveRawMaterial, issueRawMaterial, getRawMaterialBalance } from '../../services/inventory.service';
import {
    createTestCompany,
    createTestPeriod,
    createTestWarehouse,
    createTestMaterial,
    cleanupTestData
} from '../../utils/test-helpers';

describe('Negative Stock Prevention', () => {
    let testCompanyId: string;
    let testPeriodId: string;
    let testWarehouseId: string;
    let testMaterialId: string;
    let testBinId: string;

    beforeAll(async () => {
        // Setup test data
        const company = await createTestCompany();
        testCompanyId = company.id;

        const period = await createTestPeriod(testCompanyId, 'open');
        testPeriodId = period.id;

        const warehouse = await createTestWarehouse(testCompanyId);
        testWarehouseId = warehouse.id;

        const material = await createTestMaterial(testCompanyId);
        testMaterialId = material.id;

        // Create a bin
        const { data: bin } = await supabaseServer
            .from('bins')
            .insert({
                warehouse_id: testWarehouseId,
                code: `BIN${Date.now()}`,
                name: 'Test Bin',
            })
            .select()
            .single();
        testBinId = bin!.id;
    });

    afterAll(async () => {
        // Cleanup
        await cleanupTestData(testCompanyId);
        await supabaseServer.from('bins').delete().eq('id', testBinId);
        await supabaseServer.from('materials').delete().eq('id', testMaterialId);
        await supabaseServer.from('warehouses').delete().eq('id', testWarehouseId);
        await supabaseServer.from('accounting_periods').delete().eq('id', testPeriodId);
        await supabaseServer.from('companies').delete().eq('id', testCompanyId);
    });

    it('should allow transaction within stock limits', async () => {
        // Receive 100 units
        await receiveRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-15',
            reference_type: 'PURCHASE',
            reference_number: 'PO-001',
            qty_in: 100,
            unit_cost: 100,
            created_by: 'test-user',
        });

        // Issue 50 units (should succeed)
        const issue = await issueRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-16',
            reference_type: 'PRODUCTION',
            reference_number: 'PROD-001',
            qty_out: 50,
            created_by: 'test-user',
        });

        expect(issue).toBeDefined();
        expect(issue.qty_out).toBe(50);

        // Verify balance
        const balance = await getRawMaterialBalance(
            testCompanyId,
            testMaterialId,
            testWarehouseId,
            testBinId
        );
        expect(balance?.current_qty).toBe(50);
    });

    it('should reject oversell in single transaction', async () => {
        // Try to issue more than available (should fail)
        await expect(
            issueRawMaterial({
                company_id: testCompanyId,
                material_id: testMaterialId,
                warehouse_id: testWarehouseId,
                bin_id: testBinId,
                period_id: testPeriodId,
                transaction_date: '2025-01-17',
                reference_type: 'PRODUCTION',
                reference_number: 'PROD-002',
                qty_out: 100, // Only 50 available
                created_by: 'test-user',
            })
        ).rejects.toThrow(/Insufficient stock/);
    });

    it('should handle concurrent oversell scenario (race condition)', async () => {
        // Get current balance
        const balance = await getRawMaterialBalance(
            testCompanyId,
            testMaterialId,
            testWarehouseId,
            testBinId
        );
        const available = balance?.current_qty || 0;

        // Try to issue same quantity concurrently (one should fail)
        const transaction1 = issueRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-18',
            reference_type: 'PRODUCTION',
            reference_number: 'PROD-003',
            qty_out: available,
            created_by: 'test-user-1',
        });

        const transaction2 = issueRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-18',
            reference_type: 'PRODUCTION',
            reference_number: 'PROD-004',
            qty_out: available,
            created_by: 'test-user-2',
        });

        // One should succeed, one should fail
        const results = await Promise.allSettled([transaction1, transaction2]);
        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        expect(successes.length).toBe(1);
        expect(failures.length).toBe(1);
    });

    it('should maintain accurate balance calculations', async () => {
        // Clear and reset
        await cleanupTestData(testCompanyId);

        // Receive 100
        await receiveRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-20',
            reference_type: 'PURCHASE',
            reference_number: 'PO-002',
            qty_in: 100,
            unit_cost: 100,
            created_by: 'test-user',
        });

        // Issue 30
        await issueRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-21',
            reference_type: 'PRODUCTION',
            reference_number: 'PROD-005',
            qty_out: 30,
            created_by: 'test-user',
        });

        // Receive 20 more
        await receiveRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: testPeriodId,
            transaction_date: '2025-01-22',
            reference_type: 'PURCHASE',
            reference_number: 'PO-003',
            qty_in: 20,
            unit_cost: 100,
            created_by: 'test-user',
        });

        const balance = await getRawMaterialBalance(
            testCompanyId,
            testMaterialId,
            testWarehouseId,
            testBinId
        );

        // Should be 100 - 30 + 20 = 90
        expect(balance?.current_qty).toBe(90);
    });
});
