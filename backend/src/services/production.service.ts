/**
 * Production Service
 * Complete Manufacturing Operations from Design to Delivery
 * 
 * **Manufacturing Workflow (Fashion/Konveksi):**
 * 1. **BOM (Bill of Materials):** Recipe for making products
 * 2. **Production Order:** Plan to make qty of products
 * 3. **Work Orders:** Execute production in stages (CUT → SEW → FINISH)
 * 4. **Backflushing:** Auto-issue materials based on actual production
 * 5. **Costing:** Calculate actual production costs (material + labor + overhead)
 * 
 * **Three Production Stages (Fashion Industry):**
 * - **CUT:** Cutting fabric patterns
 * - **SEW:** Sewing/assembly
 * - **FINISH:** Final touches (buttonholes, quality check, packaging)
 * 
 * All operations integrate with inventory and accounting systems.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

// ==================== TYPES ====================

export interface BOMHeader {
    id?: string;
    company_id: string;
    product_id: string;
    version: string;
    effective_from: string;
    effective_to?: string;
    is_active?: boolean;
    base_qty?: number;
    yield_percentage?: number;
    notes?: string;
}

export interface BOMLine {
    id?: string;
    bom_id: string;
    line_number: number;
    material_id?: string;
    component_product_id?: string;
    qty_per: number;
    uom?: string;
    scrap_percentage?: number;
    stage?: 'CUT' | 'SEW' | 'FINISH';
    notes?: string;
}

export interface ProductionOrder {
    id?: string;
    company_id: string;
    po_number: string;
    po_date: string;
    product_id: string;
    bom_id: string;
    warehouse_id: string;
    period_id: string;
    qty_planned: number;
    start_date?: string;
    due_date?: string;
    priority?: number;
    standard_cost?: number;
    notes?: string;
}

export interface WorkOrder {
    id?: string;
    company_id: string;
    wo_number: string;
    production_order_id: string;
    stage: 'CUT' | 'SEW' | 'FINISH';
    qty_started: number;
    operator_id?: string;
    notes?: string;
}

export interface TimeEntry {
    id?: string;
    work_order_id: string;
    operator_id: string;
    start_time: string;
    end_time?: string;
    labor_rate?: number;
    notes?: string;
}

// ==================== BOM OPERATIONS ====================

/**
 * Creates a Bill of Materials (BOM) - the recipe for making a product.
 * 
 * **BOM Purpose:**
 * - Specifies materials needed to make 1 unit of product
 * - Supports versioning (V1, V2, V3) for design changes
 * - Effective date range for time-based validity
 * - Yield percentage for scrap/waste calculation
 * 
 * **Example (T-Shirt):**
 * - Product: "Basic T-Shirt"
 * - Base Qty: 1 piece
 * - Materials:
 *   - 0.8 meters fabric
 *   - 1 piece collar
 *   - 1 spool thread
 * 
 * @param bom - BOM header details
 * @param bom.company_id - UUID of the company
 * @param bom.product_id - UUID of product this BOM makes
 * @param bom.version - Version identifier (e.g., 'V1', 'V2')
 * @param bom.effective_from - Start date for this BOM version
 * @param bom.effective_to - Optional end date (null = current version)
 * @param bom.base_qty - Base quantity (typically 1)
 * @param bom.yield_percentage - Expected yield % (e.g., 95%)
 * @param userId - UUID of user creating BOM
 * 
 * @throws {Error} If product not found
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created BOM
 * 
 * @example
 * ```typescript
 * // Create BOM for T-Shirt
 * const bom = await createBOM({
 *   company_id: companyId,
 *   product_id: tshirtId,
 *   version: 'V1',
 *   effective_from: '2025-01-01',
 *   base_qty: 1,
 *   yield_percentage: 95,  // 5% scrap expected
 *   notes: 'Basic T-shirt with round collar'
 * }, userId);
 * 
 * // Add materials
 * await addBOMLine({
 *   bom_id: bom.id,
 *   line_number: 1,
 *   material_id: fabricId,
 *   qty_per: 0.8,  // 0.8 meters per shirt
 *   uom: 'meters',
 *   scrap_percentage: 5,
 *   stage: 'CUT'
 * }, userId);
 * 
 * await addBOMLine({
 *   bom_id: bom.id,
 *   line_number: 2,
 *   material_id: threadId,
 *   qty_per: 1,
 *   uom: 'spool',
 *   stage: 'SEW'
 * }, userId);
 * ```
 * 
 * @see {@link addBOMLine} for adding material lines
 * @see {@link createProductionOrder} for using BOM
 */
export async function createBOM(bom: BOMHeader, userId: string): Promise<BOMHeader> {
    const { data, error } = await supabaseServer
        .from('bom_headers')
        .insert({ ...bom, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a material or component to BOM.
 * 
 * **Line Types:**
 * - Material: Raw material (fabric, thread, buttons)
 * - Component: Sub-assembly (collar, pocket, zipper)
 * 
 * **Stages (Fashion Manufacturing):**
 * - CUT: Materials used in cutting stage
 * - SEW: Materials used in sewing stage
 * - FINISH: Materials used in finishing stage
 * 
 * @param line - BOM line details
 * @param line.bom_id - UUID of parent BOM
 * @param line.line_number - Sequential line number
 * @param line.material_id - UUID of material (for direct materials)
 * @param line.component_product_id - UUID of component (for sub-assemblies)
 * @param line.qty_per - Quantity needed per base_qty of finished product
 * @param line.uom - Unit of measure (meters, pieces, kg, etc.)
 * @param line.scrap_percentage - Expected scrap % for this item
 * @param line.stage - Production stage (CUT/SEW/FINISH)
 * @param userId - UUID of user adding line
 * 
 * @throws {Error} If material/component not found
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Direct material
 * await addBOMLine({
 *   bom_id: bomId,
 *   line_number: 1,
 *   material_id: fabricId,
 *   qty_per: 0.8,
 *   uom: 'meters',
 *   scrap_percentage: 5,
 *   stage: 'CUT',
 *   notes: 'Cut with 5% allowance for pattern matching'
 * }, userId);
 * 
 * // Component (sub-assembly)
 * await addBOMLine({
 *   bom_id: bomId,
 *   line_number: 2,
 *   component_product_id: collarComponentId,
 *   qty_per: 1,
 *   uom: 'piece',
 *   stage: 'SEW'
 * }, userId);
 * ```
 * 
 * @see {@link createBOM} for creating BOM
 */
export async function addBOMLine(line: BOMLine, userId: string): Promise<BOMLine> {
    const { data, error } = await supabaseServer
        .from('bom_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves BOM with all material lines and product details.
 * 
 * Includes nested material and component details for display.
 * 
 * @param bomId - UUID of the BOM
 * @throws {Error} If BOM not found
 * @returns Promise resolving to BOM with lines
 * 
 * @example
 * ```typescript
 * const bom = await getBOM(bomId);
 * 
 * console.log(`BOM for: ${bom.product.name} (${bom.version})`);
 * console.log(`Effective: ${bom.effective_from} to ${bom.effective_to || 'current'}`);
 * 
 * bom.lines.forEach(line => {
 *   console.log(`  ${line.material?.name}: ${line.qty_per} ${line.uom} (${line.stage})`);
 * });
 * ```
 */
export async function getBOM(bomId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('bom_headers')
        .select(`
      *,
      product:products(*),
      lines:bom_lines(*, material:materials(*), component_product:products(*))
    `)
        .eq('id', bomId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves the currently active BOM for a product.
 * 
 * Returns the BOM where:
 * - is_active = true
 * - effective_from <= today
 * - effective_to >= today (or null)
 * 
 * @param productId - UUID of the product
 * @throws {Error} If no active BOM found
 * @returns Promise resolving to active BOM
 * 
 * @example
 * ```typescript
 * // Get current BOM for production planning
 * const activeBOM = await getActiveBOMForProduct(productId);
 * 
 * // Use this BOM for new production orders
 * await createProductionOrder({
 *   product_id: productId,
 *   bom_id: activeBOM.id,
 *   qty_planned: 100
 * });
 * ```
 * 
 * @see {@link createProductionOrder} for using BOM
 */
export async function getActiveBOMForProduct(productId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('bom_headers')
        .select(`
      *,
      lines:bom_lines(*, material:materials(*))
    `)
        .eq('product_id', productId)
        .eq('is_active', true)
        .gte('effective_to', new Date().toISOString().split('T')[0])
        .single();

    if (error) throw error;
    return data;
}

/**
 * Explodes BOM to calculate total material requirements (MRP).
 * 
 * **BOM Explosion:**
 * - Recursively expands multi-level BOMs
 * - Calculates material needs for planned quantity
 * - Includes scrap allowance
 * - Handles component BOMs (sub-assemblies)
 * 
 * **Example:**
 * - Product: T-Shirt (qty = 100)
 * - BOM: 0.8m fabric per shirt
 * - Scrap: 5%
 * - Result: Need 84m fabric (100 × 0.8 × 1.05)
 * 
 * @param productId - UUID of the product
 * @param qty - Quantity to produce
 * 
 * @returns Promise resolving to material requirements list
 * @returns material.material_id - UUID of required material
 * @returns material.total_qty_needed - Total quantity needed (with scrap)
 * @returns material.current_stock - Current available stock
 * @returns material.shortage - Quantity to purchase (if negative)
 * 
 * @example
 * ```typescript
 * // Plan to make 100 T-shirts
 * const requirements = await explodeBOM(tshirtId, 100);
 * 
 * console.log('Material Requirements:');
 * requirements.forEach(req => {
 *   console.log(`${req.material_name}:`);
 *   console.log(`  Need: ${req.total_qty_needed}`);
 *   console.log(`  Have: ${req.current_stock}`);
 *   if (req.shortage > 0) {
 *     console.log(`  ⚠️  Buy: ${req.shortage}`);
 *   }
 * });
 * ```
 * 
 * @see {@link calculateMRP} for detailed MRP calculation
 */
export async function explodeBOM(productId: string, qty: number): Promise<any[]> {
    const { data, error } = await supabaseServer.rpc('explode_bom', {
        p_product_id: productId,
        p_qty: qty,
    });

    if (error) throw error;
    return data || [];
}

/**
 * Deactivates a BOM version (makes it inactive).
 * 
 * Use when replacing with new version or discontinuing product.
 * Existing production orders can still use this BOM.
 * 
 * @param bomId - UUID of BOM to deactivate
 * @throws {Error} If update fails
 * @returns Promise that resolves when deactivated
 * 
 * @example
 * ```typescript
 * // Old BOM version
 * await deactivateBOM(oldBOMId);
 * 
 * // Create new version
 * const newBOM = await createBOM({
 *   product_id: productId,
 *   version: 'V2',
 *   effective_from: '2025-02-01'
 * }, userId);
 * ```
 * 
 * @see {@link createBOM} for creating new version
 */
export async function deactivateBOM(bomId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('bom_headers')
        .update({ is_active: false })
        .eq('id', bomId);

    if (error) throw error;
}

// ==================== PRODUCTION ORDERS ====================

/**
 * Creates a production order to manufacture products.
 * 
 * **Production Order Workflow:**
 * 1. Create PO (this function) → Creates material reservations
 * 2. Release PO → Validates materials available
 * 3. Create work orders for each stage
 * 4. Execute production
 * 5. Complete & close PO
 * 
 * **Auto-Creates:**
 * - Material reservations (based on BOM explosion)
 * - Expected cost calculation
 * 
 * @param po - Production order details
 * @param po.company_id - UUID of the company
 * @param po.po_number - Unique PO number (e.g., 'PROD-2025-001')
 * @param po.po_date - PO creation date
 * @param po.product_id - UUID of product to manufacture
 * @param po.bom_id - UUID of BOM to use
 * @param po.warehouse_id - UUID of warehouse for finished goods
 * @param po.period_id - UUID of accounting period (must be open)
 * @param po.qty_planned - Quantity to produce
 * @param po.start_date - Planned start date
 * @param po.due_date - Expected completion date
 * @param po.standard_cost - Optional standard cost per unit
 * @param userId - UUID of user creating PO
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If BOM not active
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created production order
 * 
 * @example
 * ```typescript
 * // Plan to make 100 T-shirts
 * const productionOrder = await createProductionOrder({
 *   company_id: companyId,
 *   po_number: 'PROD-2025-001',
 *   po_date: '2025-01-15',
 *   product_id: tshirtId,
 *   bom_id: bomId,
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   qty_planned: 100,
 *   start_date: '2025-01-20',
 *   due_date: '2025-01-27',
 *   notes: 'Rush order for customer'
 * }, userId);
 * 
 * // Auto-created: Material reservations for 80m fabric, etc.
 * 
 * // Check material availability
 * const mrp = await calculateMRP(productionOrder.id);
 * 
 * // Release for production
 * await releaseProductionOrder(productionOrder.id, userId);
 * ```
 * 
 * @see {@link releaseProductionOrder} for releasing to production
 * @see {@link calculateMRP} for checking material availability
 */
export async function createProductionOrder(
    po: ProductionOrder,
    userId: string
): Promise<ProductionOrder> {
    await validatePeriodIsOpen(po.period_id);

    const { data, error } = await supabaseServer
        .from('production_orders')
        .insert({ ...po, created_by: userId })
        .select()
        .single();

    if (error) throw error;

    // Auto-create material reservations
    await supabaseServer.rpc('create_production_reservations', {
        p_production_order_id: data.id,
    });

    return data;
}

/**
 * Retrieves production order with all details.
 * 
 * Includes product, BOM, warehouse, material reservations, and work orders.
 * 
 * @param poId - UUID of the production order
 * @throws {Error} If production order not found
 * @returns Promise resolving to production order with details
 * 
 * @example
 * ```typescript
 * const po = await getProductionOrder(poId);
 * 
 * console.log(`Production: ${po.po_number}`);
 * console.log(`Product: ${po.product.name}`);
 * console.log(`Qty Planned: ${po.qty_planned}`);
 * console.log(`Status: ${po.status}`);
 * 
 * console.log('\nMaterial Reservations:');
 * po.reservations.forEach(res => {
 *   console.log(`  ${res.material.name}: ${res.qty_reserved}`);
 * });
 * 
 * console.log('\nWork Orders:');
 * po.work_orders.forEach(wo => {
 *   console.log(`  ${wo.stage}: ${wo.qty_completed}/${wo.qty_started}`);
 * });
 * ```
 */
export async function getProductionOrder(poId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('production_orders')
        .select(`
      *,
      product:products(*),
      bom:bom_headers(*),
      warehouse:warehouses(*),
      reservations:production_reservations(*, material:materials(*)),
      work_orders:work_orders(*)
    `)
        .eq('id', poId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Calculates Material Requirements Planning (MRP) for production order.
 * 
 * **MRP Calculation:**
 * 1. Explode BOM for planned quantity
 * 2. Compare with current inventory
 * 3. Identify shortages
 * 4. Suggest purchase quantities
 * 
 * @param poId - UUID of production order
 * @returns Promise resolving to MRP results
 * 
 * @example
 * ```typescript
 * const mrp = await calculateMRP(poId);
 * 
 * console.log('Material Requirements:');
 * mrp.forEach(item => {
 *   console.log(`${item.material_name}:`);
 *   console.log(`  Required: ${item.qty_required}`);
 *   console.log(`  Available: ${item.qty_available}`);
 *   if (item.shortage > 0) {
 *     console.log(`  ⚠️  Shortage: ${item.shortage}`);
 *     console.log(`  → Create PO for ${item.shortage} ${item.uom}`);
 *   }
 * });
 * ```
 * 
 * @see {@link explodeBOM} for BOM explosion
 */
export async function calculateMRP(poId: string): Promise<any[]> {
    const { data, error } = await supabaseServer.rpc('calculate_mrp', {
        p_production_order_id: poId,
    });

    if (error) throw error;
    return data || [];
}

/**
 * Releases production order for execution (validates materials available).
 * 
 * **Release Validation:**
 * 1. Checks all materials are available
 * 2. Validates reservations can be fulfilled
 * 3. Changes status: planned → released
 * 4. Ready for work order creation
 * 
 * @param poId - UUID of production order to release
 * @param userId - UUID of user releasing
 * 
 * @throws {Error} If materials not available
 * @throws {Error} If production order already released
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when released
 * 
 * @example
 * ```typescript
 * // Check MRP first
 * const mrp = await calculateMRP(poId);
 * const hasShortage = mrp.some(item => item.shortage > 0);
 * 
 * if (hasShortage) {
 *   console.log('Cannot release - material shortages exist');
 *   // Create purchase orders for shortages
 * } else {
 *   // All materials available
 *   await releaseProductionOrder(poId, userId);
 *   console.log('Released for production');
 *   
 *   // Create work orders
 *   await createWorkOrder({
 *     production_order_id: poId,
 *     stage: 'CUT',
 *     qty_started: 100
 *   }, userId);
 * }
 * ```
 * 
 * @see {@link calculateMRP} for checking availability
 * @see {@link createWorkOrder} for next step
 */
export async function releaseProductionOrder(poId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('release_production_order', {
        p_production_order_id: poId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves all production orders with optional status filter.
 * 
 * @param companyId - UUID of the company
 * @param status - Optional status filter (planned/released/in_progress/closed)
 * 
 * @returns Promise resolving to array of production orders
 * 
 * @example
 * ```typescript
 * // Get all in-progress production
 * const inProgress = await getAllProductionOrders(companyId, 'in_progress');
 * 
 * // Get all production orders
 * const all = await getAllProductionOrders(companyId);
 * ```
 */
export async function getAllProductionOrders(
    companyId: string,
    status?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('production_order_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('po_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Closes production order (all production complete).
 * 
 * Final step after all work orders completed and finished goods received.
 * 
 * @param poId - UUID of production order to close
 * @param userId - UUID of user closing
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when closed
 * 
 * @example
 * ```typescript
 * // All work orders completed
 * await closeProductionOrder(poId, userId);
 * // Status: in_progress → closed
 * ```
 */
export async function closeProductionOrder(poId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('production_orders')
        .update({
            status: 'closed',
            completion_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', poId);

    if (error) throw error;
}

// ==================== WORK ORDERS ====================

/**
 * Creates a work order for a production stage.
 * 
 * **Work Order Purpose:**
 * - Tracks execution of one production stage
 * - Records labor time
 * - Backflushes materials
 * - Tracks WIP (Work in Progress)
 * 
 * **Fashion Stages:**
 * - CUT: Cutting department
 * - SEW: Sewing line
 * - FINISH: Quality control & packing
 * 
 * @param wo - Work order details
 * @param wo.company_id - UUID of the company
 * @param wo.wo_number - Unique work order number
 * @param wo.production_order_id - UUID of parent production order
 * @param wo.stage - Production stage (CUT/SEW/FINISH)
 * @param wo.qty_started - Quantity starting this stage
 * @param wo.operator_id - Optional UUID of assigned operator
 * @param userId - UUID of user creating WO
 * 
 * @throws {Error} If production order not released
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created work order
 * 
 * @example
 * ```typescript
 * // Production order released, create work orders
 * 
 * // Stage 1: Cutting
 * const cutWO = await createWorkOrder({
 *   company_id: companyId,
 *   wo_number: 'WO-CUT-001',
 *   production_order_id: poId,
 *   stage: 'CUT',
 *   qty_started: 100,
 *   operator_id: cutOperatorId
 * }, userId);
 * 
 * // Start cutting
 * await startWorkOrder(cutWO.id, userId);
 * 
 * // Complete cutting
 * await completeWorkOrder(cutWO.id, 95, 5, userId);
 * // 95 good pieces, 5 rejected
 * 
 * // Stage 2: Sewing
 * const sewWO = await createWorkOrder({
 *   ...
 *   stage: 'SEW',
 *   qty_started: 95  // From cutting output
 * });
 * ```
 * 
 * @see {@link startWorkOrder} for starting WO
 * @see {@link completeWorkOrder} for completion
 */
export async function createWorkOrder(wo: WorkOrder, userId: string): Promise<WorkOrder> {
    const { data, error } = await supabaseServer
        .from('work_orders')
        .insert({ ...wo, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Starts work order and begins time tracking.
 * 
 * Changes status from draft to in_progress.
 * Records start time for labor costing.
 * 
 * @param woId - UUID of work order to start
 * @param userId - UUID of operator starting WO
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when started
 * 
 * @example
 * ```typescript
 * // Operator starts cutting
 * await startWorkOrder(woId, operatorId);
 * 
 * // Also create time entry
 * await startTimeEntry({
 *   work_order_id: woId,
 *   operator_id: operatorId,
 *   start_time: new Date().toISOString(),
 *   labor_rate: 50000  // Per hour
 * });
 * ```
 * 
 * @see {@link startTimeEntry} for labor tracking
 */
export async function startWorkOrder(woId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('work_orders')
        .update({
            status: 'in_progress',
            start_datetime: new Date().toISOString(),
            operator_id: userId,
        })
        .eq('id', woId);

    if (error) throw error;
}

/**
 * Completes work order with actual output (backflushes materials, records WIP).
 * 
 * **Completion Process (via Database RPC):**
 * 1. Validates work order in progress
 * 2. Records actual quantities (completed + rejected)
 * 3. **Backflushing:** Issues materials based on BOM × actual qty
 * 4. Records WIP (Work in Progress) inventory
 * 5. Updates labor costs from time entries
 * 6. Marks work order complete
 * 
 * **Material Backflushing:**
 * - Auto-issues materials for this stage
 * - Based on: BOM qty_per × qty_completed
 * - Example: 95 shirts × 0.8m fabric = 76m issued
 * 
 * @param woId - UUID of work order to complete
 * @param qtyCompleted - Quantity successfully completed (good pieces)
 * @param qtyRejected - Quantity rejected (defects/scrapped)
 * @param userId - UUID of user completing WO
 * 
 * @throws {Error} If work order not in progress
 * @throws {Error} If materials not available for backflush
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when completed
 * 
 * @example
 * ```typescript
 * // Cutting stage complete
 * await completeWorkOrder(
 *   cutWOId,
 *   95,   // Good pieces
 *   5,    // Rejected (cutting errors)
 *   userId
 * );
 * 
 * // System automatically:
 * // 1. Issues 76m fabric (95 × 0.8m)
 * // 2. Issues 95 pieces thread
 * // 3. Records 95 units in "CUT" WIP
 * // 4. Calculates labor cost from time entries
 * // 5. Status: in_progress → completed
 * ```
 * 
 * @see {@link createWorkOrder} for creating WO
 * @see {@link getProductionCost} for cost analysis
 */
export async function completeWorkOrder(
    woId: string,
    qtyCompleted: number,
    qtyRejected: number,
    userId: string
): Promise<void> {
    const { error } = await supabaseServer.rpc('complete_work_order', {
        p_work_order_id: woId,
        p_qty_completed: qtyCompleted,
        p_qty_rejected: qtyRejected,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves work order with time entries.
 * 
 * @param woId - UUID of the work order
 * @throws {Error} If work order not found
 * @returns Promise resolving to work order with time entries
 * 
 * @example
 * ```typescript
 * const wo = await getWorkOrder(woId);
 * 
 * console.log(`WO: ${wo.wo_number} - ${wo.stage}`);
 * console.log(`Started: ${wo.qty_started}`);
 * console.log(`Completed: ${wo.qty_completed}`);
 * console.log(`Rejected: ${wo.qty_rejected}`);
 * 
 * console.log('\nLabor Time:');
 * wo.time_entries.forEach(entry => {
 *   const hours = (new Date(entry.end_time) - new Date(entry.start_time)) / 3600000;
 *   console.log(`  ${entry.operator.name}: ${hours.toFixed(2)} hours`);
 * });
 * ```
 */
export async function getWorkOrder(woId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('work_orders')
        .select(`
      *,
      production_order:production_orders(*, product:products(*)),
      time_entries:work_order_time_entries(*)
    `)
        .eq('id', woId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves work order summary for company.
 * 
 * Shows all work orders with status and progress.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to work order summary
 * 
 * @example
 * ```typescript
 * const summary = await getWorkOrderSummary(companyId);
 * 
 * console.log('Work Orders:');
 * summary.forEach(wo => {
 *   console.log(`${wo.wo_number} - ${wo.stage}`);
 *   console.log(`  Status: ${wo.status}`);
 *   console.log(`  Progress: ${wo.qty_completed}/${wo.qty_started}`);
 * });
 * ```
 */
export async function getWorkOrderSummary(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('work_order_summary_vw')
        .select('*')
        .eq('company_id', companyId)
        .order('wo_number', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ==================== TIME TRACKING ====================

/**
 * Starts a time entry for labor cost tracking.
 * 
 * Operators clock in when starting work on a work order.
 * Records start time and labor rate for costing.
 * 
 * @param entry - Time entry details
 * @param entry.work_order_id - UUID of work order
 * @param entry.operator_id - UUID of operator
 * @param entry.start_time - Clock-in time (ISO string)
 * @param entry.labor_rate - Labor rate per hour
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created time entry
 * 
 * @example
 * ```typescript
 * // Operator clocks in
 * const timeEntry = await startTimeEntry({
 *   work_order_id: woId,
 *   operator_id: operatorId,
 *   start_time: new Date().toISOString(),
 *   labor_rate: 50000,  // 50k per hour
 *   notes: 'Sewing line 1'
 * });
 * 
 * // Later: clock out
 * await endTimeEntry(timeEntry.id);
 * ```
 * 
 * @see {@link endTimeEntry} for clocking out
 */
export async function startTimeEntry(entry: TimeEntry): Promise<TimeEntry> {
    const { data, error } = await supabaseServer
        .from('work_order_time_entries')
        .insert(entry)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Ends a time entry (operator clocks out).
 * 
 * Calculates total hours worked for labor costing.
 * Labor cost = (end_time - start_time) × labor_rate
 * 
 * @param entryId - UUID of time entry to end
 * @throws {Error} If update fails
 * @returns Promise that resolves when ended
 * 
 * @example
 * ```typescript
 * // 4 hours later
 * await endTimeEntry(timeEntryId);
 * 
 * // Automatic calculation:
 * // Hours: 4
 * // Rate: 50000/hour
 * // Labor Cost: 200000
 * ```
 * 
 * @see {@link startTimeEntry} for starting
 */
export async function endTimeEntry(entryId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('work_order_time_entries')
        .update({ end_time: new Date().toISOString() })
        .eq('id', entryId);

    if (error) throw error;
}

// ==================== COSTING & REPORTING ====================

/**
 * Retrieves detailed production cost breakdown for a production order.
 * 
 * **Cost Components:**
 * - **Material Cost:** Actual materials consumed (backflushed)
 * - **Labor Cost:** Time entries × labor rates
 * - **Overhead:** Allocated factory overhead
 * - **Total Cost:** Sum of all components
 * - **Unit Cost:** Total cost / qty produced
 * 
 * @param poId - UUID of production order
 * @returns Promise resolving to production cost detail
 * 
 * @example
 * ```typescript
 * const cost = await getProductionCost(poId);
 * 
 * console.log(`Production Order: ${cost.po_number}`);
 * console.log(`Product: ${cost.product_name}`);
 * console.log(`Quantity: ${cost.qty_produced}`);
 * console.log('\nCost Breakdown:');
 * console.log(`  Material: ${cost.material_cost.toLocaleString()}`);
 * console.log(`  Labor:    ${cost.labor_cost.toLocaleString()}`);
 * console.log(`  Overhead: ${cost.overhead_cost.toLocaleString()}`);
 * console.log(`  ─────────────────────────`);
 * console.log(`  Total:    ${cost.total_cost.toLocaleString()}`);
 * console.log(`\nUnit Cost: ${cost.unit_cost.toLocaleString()}`);
 * 
 * // Compare to standard
 * if (cost.unit_cost > cost.standard_cost) {
 *   const variance = cost.unit_cost - cost.standard_cost;
 *   console.log(`⚠️  Over standard by: ${variance.toLocaleString()}`);
 * }
 * ```
 * 
 * @see {@link getProductionCostSummary} for all production costs
 */
export async function getProductionCost(poId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('production_cost_detail_vw')
        .select('*')
        .eq('production_order_id', poId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves production cost summary for all production orders.
 * 
 * Shows cost analysis across all production to identify trends,
 * compare actual vs standard, and track profit margins.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to production cost summary
 * 
 * @example
 * ```typescript
 * const costs = await getProductionCostSummary(companyId);
 * 
 * console.log('Production Cost Analysis:');
 * costs.forEach(po => {
 *   console.log(`\n${po.po_number} - ${po.product_name}`);
 *   console.log(`  Qty: ${po.qty_produced}`);
 *   console.log(`  Unit Cost: ${po.unit_cost.toLocaleString()}`);
 *   console.log(`  Total: ${po.total_cost.toLocaleString()}`);
 *   
 *   const variance = po.unit_cost - po.standard_cost;
 *   if (variance > 0) {
 *     console.log(`  ⚠️  Variance: +${variance.toLocaleString()}`);
 *   }
 * });
 * 
 * // Calculate average unit cost
 * const avgCost = costs.reduce((sum, po) => sum + po.unit_cost, 0) / costs.length;
 * console.log(`\nAverage Unit Cost: ${avgCost.toLocaleString()}`);
 * ```
 */
export async function getProductionCostSummary(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('production_cost_detail_vw')
        .select('*')
        .eq('company_id', companyId)
        .order('po_number', { ascending: false });

    if (error) throw error;
    return data || [];
}
