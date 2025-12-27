/**
 * Inventory Service - Backend
 * Handles inventory operations using Supabase
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

export interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
}

/**
 * Raw Material Ledger Functions
 */

export interface RawMaterialReceiveParams {
    company_id: string;
    material_id: string;
    warehouse_id: string;
    bin_id: string;
    period_id: string;
    transaction_date: string;
    reference_type: string;
    reference_number: string;
    qty_in: number;
    unit_cost: number;
    created_by: string;
}

/**
 * Receives raw materials into inventory with automatic ledger posting.
 * 
 * This function creates a raw material receipt transaction, validates the accounting
 * period is open, and posts the transaction to the raw_material_ledger table.
 * Used for purchase order receipts and other material inflows.
 * 
 * @param params - Raw material receipt parameters
 * @param params.company_id - UUID of the company
 * @param params.material_id - UUID of the material being received
 * @param params.warehouse_id - UUID of the destination warehouse
 * @param params.bin_id - UUID of the specific bin location
 * @param params.period_id - UUID of the accounting period (must be open)
 * @param params.transaction_date - Date of the receipt transaction
 * @param params.reference_type - Type of source document (e.g., 'PURCHASE', 'TRANSFER')
 * @param params.reference_number - Source document number for audit trail
 * @param params.qty_in - Quantity being received (must be positive)
 * @param params.unit_cost - Unit cost of the material
 * @param params.created_by - UUID of the user creating the transaction
 * 
 * @throws {Error} If accounting period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to the created ledger entry
 * 
 * @example
 * ```typescript
 * const receipt = await receiveRawMaterial({
 *   company_id: companyId,
 *   material_id: materialId,
 *   warehouse_id: warehouseId,
 *   bin_id: binId,
 *   period_id: periodId,
 *   transaction_date: '2025-01-15',
 *   reference_type: 'PURCHASE',
 *   reference_number: 'PO-001',
 *   qty_in: 100,
 *   unit_cost: 50.00,
 *   created_by: userId
 * });
 * ```
 * 
 * @see {@link issueRawMaterial} for issuing materials from inventory
 * @see {@link getRawMaterialBalance} for checking current balance
 */
export async function receiveRawMaterial(params: RawMaterialReceiveParams) {
    // Validate period is open
    await validatePeriodIsOpen(params.period_id);

    const { data, error } = await supabaseServer
        .from('raw_material_ledger')
        .insert({
            company_id: params.company_id,
            material_id: params.material_id,
            warehouse_id: params.warehouse_id,
            bin_id: params.bin_id,
            period_id: params.period_id,
            transaction_date: params.transaction_date,
            transaction_type: 'RECEIVE',
            reference_type: params.reference_type,
            reference_number: params.reference_number,
            qty_in: params.qty_in,
            qty_out: 0,
            unit_cost: params.unit_cost,
            created_by: params.created_by,
            is_posted: true,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export interface RawMaterialIssueParams {
    company_id: string;
    material_id: string;
    warehouse_id: string;
    bin_id: string;
    period_id: string;
    transaction_date: string;
    reference_type: string;
    reference_number: string;
    qty_out: number;
    created_by: string;
}

/**
 * Issues raw materials from inventory with automatic cost calculation.
 * 
 * This function creates a raw material issue transaction for production or other
 * consumption. The unit cost is automatically calculated from the current weighted
 * average cost in the balance. Validates period is open and stock availability.
 * 
 * @param params - Raw material issue parameters
 * @param params.company_id - UUID of the company
 * @param params.material_id - UUID of the material being issued
 * @param params.warehouse_id - UUID of the source warehouse
 * @param params.bin_id - UUID of the specific bin location
 * @param params.period_id - UUID of the accounting period (must be open)
 * @param params.transaction_date - Date of the issue transaction
 * @param params.reference_type - Type of consuming document (e.g., 'PRODUCTION', 'TRANSFER')
 * @param params.reference_number - Consuming document number
 * @param params.qty_out - Quantity being issued (must be positive)
 * @param params.created_by - UUID of the user creating the transaction
 * 
 * @throws {Error} If accounting period is closed
 * @throws {Error} If insufficient stock available (negative stock prevention)
 * @throws {Error} If database insert fails
 * @returns Promise resolving to the created ledger entry
 * 
 * @example
 * ```typescript
 * const issue = await issueRawMaterial({
 *   company_id: companyId,
 *   material_id: materialId,
 *   warehouse_id: warehouseId,
 *   bin_id: binId,
 *   period_id: periodId,
 *   transaction_date: '2025-01-20',
 *   reference_type: 'PRODUCTION',
 *   reference_number: 'PROD-001',
 *   qty_out: 50,
 *   created_by: userId
 * });
 * ```
 * 
 * @see {@link receiveRawMaterial} for receiving materials into inventory
 * @see {@link getRawMaterialBalance} for checking available stock
 */
export async function issueRawMaterial(params: RawMaterialIssueParams) {
    // Validate period is open
    await validatePeriodIsOpen(params.period_id);

    // Get current balance to determine unit cost
    const balance = await getRawMaterialBalance(
        params.company_id,
        params.material_id,
        params.warehouse_id,
        params.bin_id
    );

    const { data, error } = await supabaseServer
        .from('raw_material_ledger')
        .insert({
            company_id: params.company_id,
            material_id: params.material_id,
            warehouse_id: params.warehouse_id,
            bin_id: params.bin_id,
            period_id: params.period_id,
            transaction_date: params.transaction_date,
            transaction_type: 'ISSUE',
            reference_type: params.reference_type,
            reference_number: params.reference_number,
            qty_in: 0,
            qty_out: params.qty_out,
            unit_cost: balance?.avg_unit_cost || 0,
            created_by: params.created_by,
            is_posted: true,
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves the current balance for a specific raw material at a specific location.
 * 
 * Queries the materialized view `raw_material_balance_mv` which provides real-time
 * aggregated balance including current quantity, weighted average cost, and total value.
 * Used for stock availability checks and cost calculations.
 * 
 * @param companyId - UUID of the company
 * @param materialId - UUID of the material
 * @param warehouseId - UUID of the warehouse
 * @param binId - UUID of the bin location
 * 
 * @returns Promise resolving to balance record or null if no transactions exist
 * @returns balance.current_qty - Current quantity on hand
 * @returns balance.avg_unit_cost - Weighted average unit cost
 * @returns balance.total_value - Total inventory value (qty × avg cost)
 * 
 * @example
 * ```typescript
 * const balance = await getRawMaterialBalance(
 *   companyId,
 *   materialId,
 *   warehouseId,
 *   binId
 * );
 * 
 * if (balance && balance.current_qty >= requiredQty) {
 *   // Proceed with issue
 * }
 * ```
 * 
 * @see {@link issueRawMaterial} which uses this for cost calculation
 */
export async function getRawMaterialBalance(
    companyId: string,
    materialId: string,
    warehouseId: string,
    binId: string
) {
    const { data, error } = await supabaseServer
        .from('raw_material_balance_mv')
        .select('*')
        .eq('company_id', companyId)
        .eq('material_id', materialId)
        .eq('warehouse_id', warehouseId)
        .eq('bin_id', binId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Legacy Inventory Functions (for backward compatibility)
 */

export async function getAllInventory() {
    const { data, error } = await supabaseServer
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getInventoryById(id: string) {
    const { data, error } = await supabaseServer
        .from('inventory')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createInventoryItem(item: Omit<InventoryItem, 'id'>, periodId?: string) {
    if (periodId) {
        await validatePeriodIsOpen(periodId);
    }

    const { data, error } = await supabaseServer
        .from('inventory')
        .insert(item)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    const { data, error } = await supabaseServer
        .from('inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteInventoryItem(id: string) {
    const { error } = await supabaseServer
        .from('inventory')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return { success: true };
}
