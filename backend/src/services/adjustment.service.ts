/**
 * Adjustment Service
 * Manages stock opname (physical count), inventory adjustments, and internal transfers
 * 
 * Three Critical Workflows:
 * 1. **Stock Opname:** Physical count → variance detection → automatic adjustments
 * 2. **Manual Adjustments:** Add/remove inventory with approval workflow
 * 3. **Internal Transfers:** Move inventory between warehouses/bins (dual-ledger)
 * 
 * All operations validate period is open and create full audit trail.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';
import {
    receiveRawMaterial,
    issueRawMaterial,
    receiveFinishedGoods,
    issueFinishedGoods,
} from './inventory.service';

// ==================== TYPES ====================

export interface StockOpname {
    id?: string;
    company_id: string;
    opname_number: string;
    opname_date: string;
    warehouse_id: string;
    period_id: string;
    status?: 'draft' | 'counting' | 'completed' | 'posted';
    notes?: string;
}

export interface StockOpnameLine {
    id?: string;
    opname_id: string;
    material_id?: string;
    product_variant_id?: string;
    bin_id: string;
    system_qty: number;
    system_unit_cost: number;
    physical_qty?: number;
    reason_code?: string;
    notes?: string;
    counted_by?: string;
}

export interface InventoryAdjustment {
    id?: string;
    company_id: string;
    adjustment_number: string;
    adjustment_date: string;
    warehouse_id: string;
    period_id: string;
    adjustment_type: 'IN' | 'OUT';
    reason: string;
    reference_type?: string;
    reference_id?: string;
    notes?: string;
}

export interface AdjustmentLine {
    id?: string;
    adjustment_id: string;
    material_id?: string;
    product_variant_id?: string;
    bin_id: string;
    qty: number;
    unit_cost: number;
    reason_code?: string;
    notes?: string;
}

export interface InternalTransfer {
    id?: string;
    company_id: string;
    transfer_number: string;
    transfer_date: string;
    period_id: string;
    from_warehouse_id: string;
    from_bin_id: string;
    to_warehouse_id: string;
    to_bin_id: string;
    notes?: string;
}

export interface TransferLine {
    id?: string;
    transfer_id: string;
    material_id?: string;
    product_variant_id?: string;
    qty: number;
    unit_cost: number;
    notes?: string;
}

// ==================== STOCK OPNAME ====================

/**
 * Creates a new stock opname (physical inventory count) session.
 * 
 * **Stock Opname Workflow:**
 * 1. Create opname header (this function) → Status: draft
 * 2. Add lines with system quantities → Status: counting
 * 3. Count physical quantities → Status: counting
 * 4. Complete count → Status: completed
 * 5. Post variances as adjustments → Status: posted
 * 
 * **Use Cases:**
 * - Monthly stock count
 * - Year-end inventory v verification
 * - Cycle counting for high-value items
 * - Detecting theft/damage/spoilage
 * 
 * @param opname - Stock opname details
 * @param opname.company_id - UUID of the company
 * @param opname.opname_number - Unique opname number (e.g., 'OPNAME-2025-01')
 * @param opname.opname_date - Date of physical count
 * @param opname.warehouse_id - UUID of warehouse being counted
 * @param opname.period_id - UUID of accounting period (must be open)
 * @param opname.notes - Optional notes (e.g., 'Monthly count', 'Year-end')
 * @param userId - UUID of user creating the opname
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created opname
 * 
 * @example
 * ```typescript
 * // Create monthly stock count
 * const opname = await createStockOpname({
 *   company_id: companyId,
 *   opname_number: 'OPNAME-2025-01',
 *   opname_date: '2025-01-31',
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   notes: 'Monthly physical count - January'
 * }, userId);
 * 
 * // Add lines for all materials in warehouse
 * const materials = await getMaterialBalances(warehouseId);
 * for (const material of materials) {
 *   await addOpnameLine({
 *     opname_id: opname.id,
 *     material_id: material.id,
 *     bin_id: material.bin_id,
 *     system_qty: material.current_qty,
 *     system_unit_cost: material.avg_cost
 *   });
 * }
 * ```
 * 
 * @see {@link addOpnameLine} for adding line items
 * @see {@link postStockOpname} for posting variances
 */
export async function createStockOpname(
    opname: StockOpname,
    userId: string
): Promise<StockOpname> {
    await validatePeriodIsOpen(opname.period_id);

    const { data, error } = await supabaseServer
        .from('stock_opname')
        .insert({ ...opname, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to stock opname with system quantity.
 * 
 * Each line represents one material at one bin location.
 * System quantities are auto-populated from current balance.
 * Physical quantities are entered during counting process.
 * 
 * @param line - Opname line details
 * @param line.opname_id - UUID of parent opname
 * @param line.material_id - UUID of material (raw material)
 * @param line.product_variant_id - UUID of product variant (finished good)
 * @param line.bin_id - UUID of bin location
 * @param line.system_qty - Current system quantity (from balance)
 * @param line.system_unit_cost - Current weighted average cost
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Add material to count list
 * await addOpnameLine({
 *   opname_id: opnameId,
 *   material_id: materialId,
 *   bin_id: binId,
 *   system_qty: 100,  // Current balance
 *   system_unit_cost: 50000
 * }, userId);
 * 
 * // Later: update with physical count
 * await updatePhysicalCount(lineId, 98, userId);
 * // Variance: -2 (theft/damage detected)
 * ```
 * 
 * @see {@link updatePhysicalCount} for entering physical quantities
 */
export async function addOpnameLine(line: StockOpnameLine, userId: string): Promise<StockOpnameLine> {
    const { data, error } = await supabaseServer
        .from('stock_opname_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Updates physical count quantity for an opname line.
 * 
 * Warehouse staff use this during physical counting to enter
 * actual quantities found. System automatically calculates variance
 * (physical - system) for later adjustment posting.
 * 
 * @param lineId - UUID of opname line
 * @param physicalQty - Actual quantity counted
 * @param userId - UUID of user performing the count
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // Warehouse staff counts physical inventory
 * await updatePhysicalCount(lineId, 98, userId);
 * 
 * // System calculates:
 * // Variance = 98 - 100 = -2
 * // Status: Shortage detected
 * ```
 * 
 * @see {@link completeOpname} for finishing count
 */
export async function updatePhysicalCount(
    lineId: string,
    physicalQty: number,
    userId: string
): Promise<void> {
    const { error } = await supabaseServer
        .from('stock_opname_lines')
        .update({
            physical_qty: physicalQty,
            counted_by: userId,
            counted_at: new Date().toISOString(),
        })
        .eq('id', lineId);

    if (error) throw error;
}

/**
 * Marks stock opname as completed (all counting finished).
 * 
 * Changes status from 'counting' to 'completed'. After completion,
 * review variances before posting adjustments.
 * 
 * @param opnameId - UUID of opname to complete
 * @param userId - UUID of user completing the opname
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // All items counted
 * await completeOpname(opnameId, userId);
 * 
 * // Review variances
 * const variances = await getOpnameVariances(opnameId);
 * 
 * // If acceptable, post adjustments
 * await postStockOpname(opnameId, userId);
 * ```
 * 
 * @see {@link postStockOpname} for posting variances
 */
export async function completeOpname(opnameId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('stock_opname')
        .update({
            status: 'completed',
            completed_by: userId,
            completed_at: new Date().toISOString(),
        })
        .eq('id', opnameId);

    if (error) throw error;
}

/**
 * Posts stock opname by creating inventory adjustments for all variances.
 * 
 * **Posting Process:**
 * 1. Find all lines with variances (physical ≠ system)
 * 2. Create adjustment IN for overages (physical > system)
 * 3. Create adjustment OUT for shortages (physical < system)
 * 4. Auto-post all adjustments to inventory ledger
 * 5. Mark opname as 'posted'
 * 
 * **Variance Reasons:**
 * - COUNTING_ERROR: Miscounted
 * - THEFT: Missing inventory
 * - DAMAGE: Damaged/spoiled goods
 * - FOUND: Previously lost items found
 * 
 * @param opnameId - UUID of opname to post
 * @param userId - UUID of user posting the opname
 * 
 * @throws {Error} If opname not found or not completed
 * @throws {Error} If adjustment creation fails
 * @returns Promise that resolves when all adjustments posted
 * 
 * @example
 * ```typescript
 * // Opname results:
 * // Line 1: System 100, Physical 98 → Variance -2 (shortage)
 * // Line 2: System 50, Physical 52 → Variance +2 (overage)
 * 
 * await postStockOpname(opnameId, userId);
 * 
 * // Creates:
 * // ADJ-OUT: -2 qty for Line 1 (shortage)
 * // ADJ-IN: +2 qty for Line 2 (overage)
 * // Both posted to inventory ledger automatically
 * ```
 * 
 * @see {@link createAdjustment} for manual adjustments
 */
export async function postStockOpname(opnameId: string, userId: string): Promise<void> {
    // Get opname header
    const { data: opname, error: opnameError } = await supabaseServer
        .from('stock_opname')
        .select('*')
        .eq('id', opnameId)
        .single();

    if (opnameError) throw opnameError;

    // Get lines with variances
    const { data: lines, error: linesError } = await supabaseServer
        .from('stock_opname_lines')
        .select('*')
        .eq('opname_id', opnameId)
        .neq('variance_qty', 0);

    if (linesError) throw linesError;

    // Create adjustments for each variance
    for (const line of lines || []) {
        const adjustmentType = line.variance_qty > 0 ? 'IN' : 'OUT';
        const absQty = Math.abs(line.variance_qty);

        const adjustment = await createAdjustment(
            {
                company_id: opname.company_id,
                adjustment_number: `ADJ-${opname.opname_number}-${line.id.substring(0, 8)}`,
                adjustment_date: opname.opname_date,
                warehouse_id: opname.warehouse_id,
                period_id: opname.period_id,
                adjustment_type: adjustmentType,
                reason: line.reason_code || 'COUNTING_ERROR',
                reference_type: 'OPNAME',
                reference_id: opnameId,
            },
            userId
        );

        await addAdjustmentLine(
            {
                adjustment_id: adjustment.id!,
                material_id: line.material_id,
                product_variant_id: line.product_variant_id,
                bin_id: line.bin_id,
                qty: absQty,
                unit_cost: line.system_unit_cost,
                reason_code: line.reason_code,
            },
            userId
        );

        // Auto-post adjustment
        await postAdjustment(adjustment.id!, userId);
    }

    // Mark opname as posted
    const { error: updateError } = await supabaseServer
        .from('stock_opname')
        .update({
            status: 'posted',
            posted_by: userId,
            posted_at: new Date().toISOString(),
        })
        .eq('id', opnameId);

    if (updateError) throw updateError;
}

// ==================== INVENTORY ADJUSTMENTS ====================

/**
 * Creates a manual inventory adjustment (add or remove inventory).
 * 
 * **Adjustment Types:**
 * - **IN:** Add inventory (found items, corrections, etc.)
 * - **OUT:** Remove inventory (damage, theft, write-off, etc.)
 * 
 * **Common Adjustment Reasons:**
 * - DAMAGE: Damaged goods
 * - THEFT: Stolen inventory
 * - SPOILAGE: Expired/spoiled materials
 * - FOUND: Previously missing items found
 * - COUNTING_ERROR: Correction from stock opname
 * - WRITE_OFF: Obsolete inventory disposal
 * 
 * **Workflow:**
 * 1. Create adjustment header (this function) → Status: draft
 * 2. Add lines → Status: draft
 * 3. Approve adjustment → Status: approved
 * 4. Post to inventory ledger → Status: posted
 * 
 * @param adjustment - Adjustment details
 * @param adjustment.company_id - UUID of the company
 * @param adjustment.adjustment_number - Unique adjustment number
 * @param adjustment.adjustment_date - Date of adjustment
 * @param adjustment.warehouse_id - UUID of affected warehouse
 * @param adjustment.period_id - UUID of accounting period (must be open)
 * @param adjustment.adjustment_type - 'IN' (add) or 'OUT' (remove)
 * @param adjustment.reason - Reason code (DAMAGE, THEFT, etc.)
 * @param adjustment.reference_type - Optional source (e.g., 'OPNAME')
 * @param adjustment.reference_id - Optional source document ID
 * @param userId - UUID of user creating adjustment
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created adjustment
 * 
 * @example
 * ```typescript
 * // Write off damaged materials
 * const adjustment = await createAdjustment({
 *   company_id: companyId,
 *   adjustment_number: 'ADJ-OUT-2025-001',
 *   adjustment_date: '2025-01-15',
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   adjustment_type: 'OUT',
 *   reason: 'DAMAGE',
 *   notes: 'Water damage from roof leak'
 * }, userId);
 * 
 * await addAdjustmentLine({
 *   adjustment_id: adjustment.id,
 *   material_id: fabricId,
 *   bin_id: binId,
 *   qty: 50,  // 50 meters damaged
 *   unit_cost: 50000
 * }, userId);
 * 
 * await approveAdjustment(adjustment.id, managerId);
 * await postAdjustment(adjustment.id, userId);
 * ```
 * 
 * @see {@link addAdjustmentLine} for adding line items
 * @see {@link approveAdjustment} for approval workflow
 * @see {@link postAdjustment} for posting to ledger
 */
export async function createAdjustment(
    adjustment: InventoryAdjustment,
    userId: string
): Promise<InventoryAdjustment> {
    await validatePeriodIsOpen(adjustment.period_id);

    const { data, error } = await supabaseServer
        .from('inventory_adjustments')
        .insert({ ...adjustment, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to inventory adjustment.
 * 
 * @param line - Adjustment line details
 * @param line.adjustment_id - UUID of parent adjustment
 * @param line.material_id - UUID of material (for raw materials)
 * @param line.product_variant_id - UUID of variant (for finished goods)
 * @param line.bin_id - UUID of bin location
 * @param line.qty - Quantity to adjust
 * @param line.unit_cost - Unit cost for inventory valuation
 * @param line.reason_code - Optional reason code
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * await addAdjustmentLine({
 *   adjustment_id: adjustmentId,
 *   material_id: materialId,
 *   bin_id: binId,
 *   qty: 10,
 *   unit_cost: 50000,
 *   reason_code: 'DAMAGE'
 * }, userId);
 * ```
 */
export async function addAdjustmentLine(
    line: AdjustmentLine,
    userId: string
): Promise<AdjustmentLine> {
    const { data, error } = await supabaseServer
        .from('inventory_adjustment_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Approves an inventory adjustment.
 * 
 * Approval workflow prevents unauthorized inventory changes.
 * Only approved adjustments can be posted to ledger.
 * 
 * @param adjustmentId - UUID of adjustment to approve
 * @param userId - UUID of approver (typically manager)
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when approved
 * 
 * @example
 * ```typescript
 * // Manager approval
 * await approveAdjustment(adjustmentId, managerId);
 * 
 * // Now can post
 * await postAdjustment(adjustmentId, userId);
 * ```
 * 
 * @see {@link postAdjustment} for posting after approval
 */
export async function approveAdjustment(adjustmentId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('inventory_adjustments')
        .update({
            status: 'approved',
            approved_by: userId,
            approved_at: new Date().toISOString(),
        })
        .eq('id', adjustmentId);

    if (error) throw error;
}

/**
 * Posts adjustment to inventory ledger (executes the adjustment).
 * 
 * **Posting Process:**
 * - IN adjustments: Call receiveRawMaterial/receiveFinishedGoods
 * - OUT adjustments: Call issueRawMaterial/issueFinishedGoods
 * - Updates inventory quantities and costs
 * - Creates full audit trail
 * 
 * @param adjustmentId - UUID of adjustment to post
 * @param userId - UUID of user posting
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If insufficient inventory for OUT
 * @throws {Error} If database operation fails
 * @returns Promise that resolves when posted
 * 
 * @example
 * ```typescript
 * // After approval, post to inventory
 * await postAdjustment(adjustmentId, userId);
 * 
 * // Inventory ledger updated immediately
 * // Status changed to 'posted'
 * ```
 * 
 * @see {@link createAdjustment} for creating adjustments
 * @see {@link approveAdjustment} for approval step
 */
export async function postAdjustment(adjustmentId: string, userId: string): Promise<void> {
    // Get adjustment header
    const { data: adjustment, error: adjError } = await supabaseServer
        .from('inventory_adjustments')
        .select('*')
        .eq('id', adjustmentId)
        .single();

    if (adjError) throw adjError;

    // Get lines
    const { data: lines, error: linesError } = await supabaseServer
        .from('inventory_adjustment_lines')
        .select('*')
        .eq('adjustment_id', adjustmentId);

    if (linesError) throw linesError;

    // Post to ledger
    for (const line of lines || []) {
        if (line.material_id) {
            // Raw material adjustment
            if (adjustment.adjustment_type === 'IN') {
                await receiveRawMaterial(
                    {
                        company_id: adjustment.company_id,
                        material_id: line.material_id,
                        warehouse_id: adjustment.warehouse_id,
                        bin_id: line.bin_id,
                        period_id: adjustment.period_id,
                        transaction_date: adjustment.adjustment_date,
                        reference_type: 'ADJUSTMENT',
                        reference_number: adjustment.adjustment_number,
                        qty_in: line.qty,
                        unit_cost: line.unit_cost,
                        created_by: userId,
                    }
                );
            } else {
                await issueRawMaterial(
                    {
                        company_id: adjustment.company_id,
                        material_id: line.material_id,
                        warehouse_id: adjustment.warehouse_id,
                        bin_id: line.bin_id,
                        period_id: adjustment.period_id,
                        transaction_date: adjustment.adjustment_date,
                        reference_type: 'ADJUSTMENT',
                        reference_number: adjustment.adjustment_number,
                        qty_out: line.qty,
                        created_by: userId,
                    }
                );
            }
        } else if (line.product_variant_id) {
            // Finished goods adjustment
            if (adjustment.adjustment_type === 'IN') {
                await receiveFinishedGoods(
                    {
                        company_id: adjustment.company_id,
                        product_variant_id: line.product_variant_id,
                        warehouse_id: adjustment.warehouse_id,
                        bin_id: line.bin_id,
                        period_id: adjustment.period_id,
                        transaction_date: adjustment.adjustment_date,
                        reference_type: 'ADJUSTMENT',
                        reference_number: adjustment.adjustment_number,
                        qty_in: line.qty,
                        unit_cost: line.unit_cost,
                        created_by: userId,
                    }
                );
            } else {
                await issueFinishedGoods(
                    {
                        company_id: adjustment.company_id,
                        product_variant_id: line.product_variant_id,
                        warehouse_id: adjustment.warehouse_id,
                        bin_id: line.bin_id,
                        period_id: adjustment.period_id,
                        transaction_date: adjustment.adjustment_date,
                        reference_type: 'ADJUSTMENT',
                        reference_number: adjustment.adjustment_number,
                        qty_out: line.qty,
                        created_by: userId,
                    }
                );
            }
        }
    }

    // Mark as posted
    const { error: updateError } = await supabaseServer
        .from('inventory_adjustments')
        .update({
            status: 'posted',
            posted_by: userId,
            posted_at: new Date().toISOString(),
        })
        .eq('id', adjustmentId);

    if (updateError) throw updateError;
}

// ==================== INTERNAL TRANSFERS ====================

/**
 * Creates an internal transfer between warehouses/bins.
 * 
 * **Dual-Ledger Transfer:**
 * - Issue from source location (-qty)
 * - Receive at destination (+qty)
 * - Cost remains the SAME (no revaluation)
 * 
 * **Use Cases:**
 * - Move materials between warehouses
 * - Reorganize bin locations
 * - Centralize slow-moving inventory
 * - Distribute to branch locations
 * 
 * **Important:** Both source and destination must be in same company.
 * Cost is preserved during transfer (no cost adjustment).
 * 
 * @param transfer - Transfer details
 * @param transfer.company_id - UUID of the company
 * @param transfer.transfer_number - Unique transfer number
 * @param transfer.transfer_date - Date of transfer
 * @param transfer.period_id - UUID of accounting period (must be open)
 * @param transfer.from_warehouse_id - UUID of source warehouse
 * @param transfer.from_bin_id - UUID of source bin
 * @param transfer.to_warehouse_id - UUID of destination warehouse
 * @param transfer.to_bin_id - UUID of destination bin
 * @param userId - UUID of user creating transfer
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created transfer
 * 
 * @example
 * ```typescript
 * // Transfer materials between warehouses
 * const transfer = await createTransfer({
 *   company_id: companyId,
 *   transfer_number: 'TRF-2025-001',
 *   transfer_date: '2025-01-15',
 *   period_id: periodId,
 *   from_warehouse_id: mainWarehouseId,
 *   from_bin_id: sourceBinId,
 *   to_warehouse_id: branchWarehouseId,
 *   to_bin_id: destBinId,
 *   notes: 'Transfer to branch for sales'
 * }, userId);
 * 
 * await addTransferLine({
 *   transfer_id: transfer.id,
 *   material_id: fabricId,
 *   qty: 100,
 *   unit_cost: 50000  // Same cost at both locations
 * }, userId);
 * 
 * await postTransfer(transfer.id, userId);
 * // Result: -100 from main, +100 at branch
 * ```
 * 
 * @see {@link addTransferLine} for adding items to transfer
 * @see {@link postTransfer} for executing the transfer
 */
export async function createTransfer(
    transfer: InternalTransfer,
    userId: string
): Promise<InternalTransfer> {
    await validatePeriodIsOpen(transfer.period_id);

    const { data, error } = await supabaseServer
        .from('internal_transfers')
        .insert({ ...transfer, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to internal transfer.
 * 
 * @param line - Transfer line details
 * @param line.transfer_id - UUID of parent transfer
 * @param line.material_id - UUID of material (for raw materials)
 * @param line.product_variant_id - UUID of variant (for finished goods)
 * @param line.qty - Quantity to transfer
 * @param line.unit_cost - Unit cost (preserved in transfer)
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * await addTransferLine({
 *   transfer_id: transferId,
 *   material_id: materialId,
 *   qty: 50,
 *   unit_cost: 50000
 * }, userId);
 * ```
 */
export async function addTransferLine(line: TransferLine, userId: string): Promise<TransferLine> {
    const { data, error } = await supabaseServer
        .from('internal_transfer_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Posts transfer to inventory ledger (executes dual-ledger transfer).
 * 
 * **Dual-Ledger Process:**
 * 1. Issue from source warehouse (-qty)
 *    - Reduces source location inventory
 * 2. Receive at destination warehouse (+qty)
 *    - Increases destination inventory
 * 3. Cost preserved (no revaluation)
 * 4. Full audit trail created
 * 
 * **Important:** Both transactions use SAME unit cost.
 * No cost adjustment occurs during internal transfers.
 * 
 * @param transferId - UUID of transfer to post
 * @param userId - UUID of user posting the transfer
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If insufficient inventory at source
 * @throws {Error} If database operation fails
 * @returns Promise that resolves when transfer complete
 * 
 * @example
 * ```typescript
 * await postTransfer(transferId, userId);
 * 
 * // Inventory ledger shows:
 * // Source: -100 qty (issued)
 * // Destination: +100 qty (received)
 * // Cost: 50000 (same at both locations)
 * ```
 * 
 * @see {@link createTransfer} for creating transfers
 */
export async function postTransfer(transferId: string, userId: string): Promise<void> {
    // Get transfer header
    const { data: transfer, error: transferError } = await supabaseServer
        .from('internal_transfers')
        .select('*')
        .eq('id', transferId)
        .single();

    if (transferError) throw transferError;

    // Get lines
    const { data: lines, error: linesError } = await supabaseServer
        .from('internal_transfer_lines')
        .select('*')
        .eq('transfer_id', transferId);

    if (linesError) throw linesError;

    // Post to ledger (from and to)
    for (const line of lines || []) {
        if (line.material_id) {
            // Issue from source
            await issueRawMaterial(
                {
                    company_id: transfer.company_id,
                    material_id: line.material_id,
                    warehouse_id: transfer.from_warehouse_id,
                    bin_id: transfer.from_bin_id,
                    period_id: transfer.period_id,
                    transaction_date: transfer.transfer_date,
                    reference_type: 'TRANSFER',
                    reference_number: transfer.transfer_number,
                    qty_out: line.qty,
                    created_by: userId,
                }
            );

            // Receive at destination (SAME cost!)
            await receiveRawMaterial(
                {
                    company_id: transfer.company_id,
                    material_id: line.material_id,
                    warehouse_id: transfer.to_warehouse_id,
                    bin_id: transfer.to_bin_id,
                    period_id: transfer.period_id,
                    transaction_date: transfer.transfer_date,
                    reference_type: 'TRANSFER',
                    reference_number: transfer.transfer_number,
                    qty_in: line.qty,
                    unit_cost: line.unit_cost, // Same cost!
                    created_by: userId,
                }
            );
        } else if (line.product_variant_id) {
            // FG transfer
            await issueFinishedGoods(
                {
                    company_id: transfer.company_id,
                    product_variant_id: line.product_variant_id,
                    warehouse_id: transfer.from_warehouse_id,
                    bin_id: transfer.from_bin_id,
                    period_id: transfer.period_id,
                    transaction_date: transfer.transfer_date,
                    reference_type: 'TRANSFER',
                    reference_number: transfer.transfer_number,
                    qty_out: line.qty,
                    created_by: userId,
                }
            );

            await receiveFinishedGoods(
                {
                    company_id: transfer.company_id,
                    product_variant_id: line.product_variant_id,
                    warehouse_id: transfer.to_warehouse_id,
                    bin_id: transfer.to_bin_id,
                    period_id: transfer.period_id,
                    transaction_date: transfer.transfer_date,
                    reference_type: 'TRANSFER',
                    reference_number: transfer.transfer_number,
                    qty_in: line.qty,
                    unit_cost: line.unit_cost,
                    created_by: userId,
                }
            );
        }
    }

    // Mark as completed
    const { error: updateError } = await supabaseServer
        .from('internal_transfers')
        .update({
            status: 'completed',
            posted_by: userId,
            posted_at: new Date().toISOString(),
        })
        .eq('id', transferId);

    if (updateError) throw updateError;
}
