/**
 * Warehouse Service
 * Manages warehouses and bin locations for inventory control
 * 
 * Supports multi-warehouse operations with detailed bin-level tracking.
 * Essential for accurate inventory management and location-based stock control.
 */
import { supabaseServer } from '../config/supabase';

export interface Warehouse {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    address?: string;
    city?: string;
    manager_name?: string;
    phone?: string;
    is_active?: boolean;
}

export interface Bin {
    id?: string;
    warehouse_id: string;
    code: string;
    name: string;
    aisle?: string;
    rack?: string;
    level?: string;
    is_active?: boolean;
}

// ==================== WAREHOUSES ====================

/**
 * Creates a new warehouse location.
 * 
 * Warehouses represent physical storage locations where inventory is kept.
 * Each warehouse can contain multiple bin locations for detailed tracking.
 * 
 * @param warehouse - Warehouse details to create
 * @param warehouse.company_id - UUID of the company
 * @param warehouse.code - Unique warehouse code (e.g., 'WH-01')
 * @param warehouse.name - Warehouse name (e.g., 'Main Warehouse')
 * @param warehouse.address - Physical address
 * @param warehouse.city - City location
 * @param warehouse.manager_name - Warehouse manager name
 * @param warehouse.phone - Contact phone number
 * @param userId - UUID of user creating the warehouse
 * 
 * @throws {Error} If warehouse code is not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created warehouse
 * 
 * @example
 * ```typescript
 * const warehouse = await createWarehouse({
 *   company_id: companyId,
 *   code: 'WH-MAIN',
 *   name: 'Main Warehouse',
 *   address: '123 Industrial St',
 *   city: 'Jakarta',
 *   manager_name: 'John Doe',
 *   phone: '+62-21-1234567'
 * }, userId);
 * ```
 * 
 * @see {@link createBin} for adding bin locations
 * @see {@link getAllWarehouses} for retrieving warehouses
 */
export async function createWarehouse(warehouse: Warehouse, userId: string): Promise<Warehouse> {
    const { data, error } = await supabaseServer
        .from('warehouses')
        .insert({ ...warehouse, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a warehouse by its unique ID.
 * 
 * @param warehouseId - UUID of the warehouse
 * @throws {Error} If warehouse not found
 * @returns Promise resolving to warehouse record
 * 
 * @example
 * ```typescript
 * const warehouse = await getWarehouseById(warehouseId);
 * console.log(`${warehouse.name} - ${warehouse.city}`);
 * ```
 */
export async function getWarehouseById(warehouseId: string): Promise<Warehouse> {
    const { data, error } = await supabaseServer
        .from('warehouses')
        .select('*')
        .eq('id', warehouseId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active warehouses for a company.
 * 
 * Returns warehouses ordered by code for consistent display.
 * Only active warehouses are returned. Use for dropdown selections,
 * warehouse selection in transactions, and reporting.
 * 
 * **Caching Recommended:** Warehouse data rarely changes, ideal for caching.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of warehouses
 * 
 * @example
 * ```typescript
 * // Get all warehouses
 * const warehouses = await getAllWarehouses(companyId);
 * 
 * // Populate dropdown
 * warehouses.forEach(w => {
 *   console.log(`${w.code} - ${w.name}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With caching
 * import { cache, CacheKeys } from './cache.service';
 * 
 * const warehouses = await cache.getOrSet(
 *   CacheKeys.warehouses(companyId),
 *   () => getAllWarehouses(companyId),
 *   3600  // Cache for 1 hour
 * );
 * ```
 */
export async function getAllWarehouses(companyId: string): Promise<Warehouse[]> {
    const { data, error } = await supabaseServer
        .from('warehouses')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

    if (error) throw error;
    return data;
}

/**
 * Updates warehouse details.
 * 
 * @param warehouseId - UUID of warehouse to update
 * @param updates - Partial warehouse object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated warehouse
 * 
 * @example
 * ```typescript
 * const updated = await updateWarehouse(warehouseId, {
 *   manager_name: 'Jane Smith',
 *   phone: '+62-21-9876543'
 * });
 * ```
 * 
 * @see {@link createWarehouse} for creating new warehouses
 */
export async function updateWarehouse(
    warehouseId: string,
    updates: Partial<Warehouse>
): Promise<Warehouse> {
    const { data, error } = await supabaseServer
        .from('warehouses')
        .update(updates)
        .eq('id', warehouseId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ==================== BINS ====================

/**
 * Creates a new bin location within a warehouse.
 * 
 * Bins provide detailed location tracking within warehouses. Each bin
 * can optionally specify aisle, rack, and level for precise location.
 * Used in inventory transactions to track exact storage location.
 * 
 * **Bin Naming Convention:**
 * - Use structured codes: AISLE-RACK-LEVEL (e.g., 'A1-R3-L2')
 * - Or simple sequential: BIN-001, BIN-002, etc.
 * - Ensure uniqueness within warehouse
 * 
 * @param bin - Bin location details
 * @param bin.warehouse_id - UUID of parent warehouse
 * @param bin.code - Unique bin code within warehouse
 * @param bin.name - Bin display name
 * @param bin.aisle - Optional aisle identifier (e.g., 'A1')
 * @param bin.rack - Optional rack identifier (e.g., 'R3')
 * @param bin.level - Optional level identifier (e.g., 'L2')
 * @param userId - UUID of user creating the bin
 * 
 * @throws {Error} If bin code not unique within warehouse
 * @throws {Error} If warehouse doesn't exist
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created bin
 * 
 * @example
 * ```typescript
 * // Simple bin
 * const bin = await createBin({
 *   warehouse_id: warehouseId,
 *   code: 'BIN-001',
 *   name: 'Bin 001'
 * }, userId);
 * ```
 * 
 * @example
 * ```typescript
 * // Detailed location
 * const bin = await createBin({
 *   warehouse_id: warehouseId,
 *   code: 'A1-R3-L2',
 *   name: 'Aisle 1, Rack 3, Level 2',
 *   aisle: 'A1',
 *   rack: 'R3',
 *   level: 'L2'
 * }, userId);
 * ```
 * 
 * @see {@link getBinsByWarehouse} for listing bins
 * @see {@link getDefaultBin} for auto-selecting bins
 */
export async function createBin(bin: Bin, userId: string): Promise<Bin> {
    const { data, error } = await supabaseServer
        .from('bins')
        .insert({ ...bin, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a bin by its unique ID with warehouse details.
 * 
 * Includes parent warehouse information via relationship join.
 * Useful for displaying full location path in UI.
 * 
 * @param binId - UUID of the bin
 * @throws {Error} If bin not found
 * @returns Promise resolving to bin with warehouse details
 * 
 * @example
 * ```typescript
 * const bin = await getBinById(binId);
 * console.log(`${bin.warehouse.name} - ${bin.name}`);
 * // Output: "Main Warehouse - Bin A1-R3-L2"
 * ```
 */
export async function getBinById(binId: string): Promise<Bin> {
    const { data, error } = await supabaseServer
        .from('bins')
        .select('*, warehouse:warehouses(*)')
        .eq('id', binId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active bins for a warehouse.
 * 
 * Returns bins ordered by code for consistent display. Use this
 * for bin selection dropdowns when creating inventory transactions.
 * 
 * @param warehouseId - UUID of the warehouse
 * @returns Promise resolving to array of bins
 * 
 * @example
 * ```typescript
 * // Get bins for warehouse
 * const bins = await getBinsByWarehouse(warehouseId);
 * 
 * // Populate bin selection dropdown
 * bins.forEach(bin => {
 *   console.log(`${bin.code} - ${bin.name}`);
 * });
 * ```
 * 
 * @see {@link getDefaultBin} for auto-selecting a bin
 */
export async function getBinsByWarehouse(warehouseId: string): Promise<Bin[]> {
    const { data, error } = await supabaseServer
        .from('bins')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .eq('is_active', true)
        .order('code');

    if (error) throw error;
    return data;
}

/**
 * Updates bin details.
 * 
 * @param binId - UUID of bin to update
 * @param updates - Partial bin object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated bin
 * 
 * @example
 * ```typescript
 * const updated = await updateBin(binId, {
 *   name: 'Updated Bin Name',
 *   level: 'L3'
 * });
 * ```
 */
export async function updateBin(binId: string, updates: Partial<Bin>): Promise<Bin> {
    const { data, error } = await supabaseServer
        .from('bins')
        .update(updates)
        .eq('id', binId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves the default bin for a warehouse.
 * 
 * Returns the first active bin (by code) for a warehouse. Useful for
 * auto-populating bin selection in transactions when user doesn't
 * specify a bin. Common in simple warehouse setups with one bin per warehouse.
 * 
 * **Use Case:** Single-bin warehouses or default location selection
 * 
 * @param warehouseId - UUID of the warehouse
 * @returns Promise resolving to default bin or null if no bins exist
 * 
 * @example
 * ```typescript
 * // Auto-select bin for simple warehouse
 * const defaultBin = await getDefaultBin(warehouseId);
 * 
 * if (defaultBin) {
 *   // Use default bin for transaction
 *   await receiveRawMaterial({
 *     ...params,
 *     bin_id: defaultBin.id
 *   });
 * } else {
 *   throw new Error('Please create at least one bin');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Multi-warehouse with auto-select
 * const warehouses = await getAllWarehouses(companyId);
 * 
 * for (const warehouse of warehouses) {
 *   const bin = await getDefaultBin(warehouse.id);
 *   console.log(`${warehouse.name}: ${bin?.code || 'No bins'}`);
 * }
 * ```
 * 
 * @see {@link getBinsByWarehouse} for all bins
 * @see {@link createBin} for creating bins
 */
export async function getDefaultBin(warehouseId: string): Promise<Bin | null> {
    const { data, error } = await supabaseServer
        .from('bins')
        .select('*')
        .eq('warehouse_id', warehouseId)
        .eq('is_active', true)
        .order('code')
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}
