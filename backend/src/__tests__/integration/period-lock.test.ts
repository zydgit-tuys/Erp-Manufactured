/**
 * Integration Tests: Period Lock Enforcement
 * Tests the ERP requirement: no transactions in closed periods
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabaseServer } from '../../config/supabase';
import { receiveRawMaterial } from '../../services/inventory.service';
import {
    createTestCompany,
    createTestPeriod,
    createTestWarehouse,
    createTestMaterial,
    cleanupTestData
} from '../../utils/test-helpers';

describe('Period Lock Enforcement', () => {
    let testCompanyId: string;
    let openPeriodId: string;
    let closedPeriodId: string;
    let testWarehouseId: string;
    let testMaterialId: string;
    let testBinId: string;

    beforeAll(async () => {
        const company = await createTestCompany();
        testCompanyId = company.id;

        // Create open period
        const openPeriod = await createTestPeriod(testCompanyId, 'open');
        openPeriodId = openPeriod.id;

        // Create closed period
        const closedPeriod = await createTestPeriod(testCompanyId, 'closed');
        closedPeriodId = closedPeriod.id;

        const warehouse = await createTestWarehouse(testCompanyId);
        testWarehouseId = warehouse.id;

        const material = await createTestMaterial(testCompanyId);
        testMaterialId = material.id;

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
        await cleanupTestData(testCompanyId);
        await supabaseServer.from('bins').delete().eq('id', testBinId);
        await supabaseServer.from('materials').delete().eq('id', testMaterialId);
        await supabaseServer.from('warehouses').delete().eq('id', testWarehouseId);
        await supabaseServer.from('accounting_periods').delete().eq('id', openPeriodId);
        await supabaseServer.from('accounting_periods').delete().eq('id', closedPeriodId);
        await supabaseServer.from('companies').delete().eq('id', testCompanyId);
    });

    it('should allow transactions in open period', async () => {
        const result = await receiveRawMaterial({
            company_id: testCompanyId,
            material_id: testMaterialId,
            warehouse_id: testWarehouseId,
            bin_id: testBinId,
            period_id: openPeriodId,
            transaction_date: '2025-01-15',
            reference_type: 'PURCHASE',
            reference_number: 'PO-OPEN-001',
            qty_in: 100,
            unit_cost: 100,
            created_by: 'test-user',
        });

        expect(result).toBeDefined();
        expect(result.qty_in).toBe(100);
    });

    it('should reject transactions in closed period', async () => {
        // This test depends on RLS policy or application-level check
        // For now, we'll test the service layer validation

        await expect(
            receiveRawMaterial({
                company_id: testCompanyId,
                material_id: testMaterialId,
                warehouse_id: testWarehouseId,
                bin_id: testBinId,
                period_id: closedPeriodId,
                transaction_date: '2025-01-15',
                reference_type: 'PURCHASE',
                reference_number: 'PO-CLOSED-001',
                qty_in: 100,
                unit_cost: 100,
                created_by: 'test-user',
            })
        ).rejects.toThrow();

        // Note: Full implementation requires period status check in service layer
    });

    it('should reject backdated transactions to closed period', async () => {
        // Attempt to post transaction with date in closed period
        await expect(
            receiveRawMaterial({
                company_id: testCompanyId,
                material_id: testMaterialId,
                warehouse_id: testWarehouseId,
                bin_id: testBinId,
                period_id: closedPeriodId,
                transaction_date: '2024-12-31', // Backdated
                reference_type: 'PURCHASE',
                reference_number: 'PO-BACKDATED',
                qty_in: 100,
                unit_cost: 100,
                created_by: 'test-user',
            })
        ).rejects.toThrow();
    });

    it('should enforce period close workflow', async () => {
        // Create a new period
        const { data: newPeriod } = await supabaseServer
            .from('accounting_periods')
            .insert({
                company_id: testCompanyId,
                name: `Closable Period ${Date.now()}`,
                start_date: '2025-02-01',
                end_date: '2025-02-28',
                status: 'open',
            })
            .select()
            .single();

        expect(newPeriod!.status).toBe('open');

        // Close the period
        const { data: closedPeriod } = await supabaseServer
            .from('accounting_periods')
            .update({ status: 'closed' })
            .eq('id', newPeriod!.id)
            .select()
            .single();

        expect(closedPeriod!.status).toBe('closed');

        // Try to post transaction to closed period (should fail)
        await expect(
            receiveRawMaterial({
                company_id: testCompanyId,
                material_id: testMaterialId,
                warehouse_id: testWarehouseId,
                bin_id: testBinId,
                period_id: newPeriod!.id,
                transaction_date: '2025-02-15',
                reference_type: 'PURCHASE',
                reference_number: 'PO-AFTER-CLOSE',
                qty_in: 100,
                unit_cost: 100,
                created_by: 'test-user',
            })
        ).rejects.toThrow();

        // Cleanup
        await supabaseServer.from('accounting_periods').delete().eq('id', newPeriod!.id);
    });
});
