/**
 * Material Service
 * Manages raw materials and material categories
 * 
 * Materials are purchased items used in production (fabric, thread, buttons, etc).
 * Organized by categories with reorder level tracking for inventory management.
 */
import { supabaseServer } from '../config/supabase';

export interface MaterialCategory {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
}

export interface Material {
    id?: string;
    company_id: string;
    category_id?: string;
    code: string;
    name: string;
    description?: string;
    unit_of_measure: string;
    supplier_code?: string;
    reorder_level?: number;
    standard_cost?: number;
    status: 'active' | 'inactive' | 'discontinued';
}

// ==================== CATEGORIES ====================

/**
 * Creates a new material category for organizational purposes.
 * 
 * Categories help organize materials into logical groups
 * (e.g., 'Fabrics', 'Threads', 'Accessories', 'Packaging').
 * Used for filtering, reporting, and material classification.
 * 
 * @param category - Category details
 * @param category.company_id - UUID of the company
 * @param category.code - Unique category code (e.g., 'FAB', 'THR')
 * @param category.name - Category name (e.g., 'Fabrics')
 * @param category.description - Optional description
 * @param userId - UUID of user creating the category
 * 
 * @throws {Error} If category code not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created category
 * 
 * @example
 * ```typescript
 * const fabricCategory = await createMaterialCategory({
 *   company_id: companyId,
 *   code: 'FAB',
 *   name: 'Fabrics',
 *   description: 'All fabric materials'
 * }, userId);
 * ```
 * 
 * @see {@link getAllMaterialCategories} for listing categories
 * @see {@link createMaterial} for adding materials to categories
 */
export async function createMaterialCategory(
    category: MaterialCategory,
    userId: string
): Promise<MaterialCategory> {
    const { data, error } = await supabaseServer
        .from('material_categories')
        .insert({ ...category, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active material categories for a company.
 * 
 * Returns categories ordered by code. Use for dropdown selections,
 * material filtering, and reporting. Categories rarely change,
 * making them ideal candidates for caching.
 * 
 * **Caching Recommended:** TTL 3600s (1 hour)
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of categories
 * 
 * @example
 * ```typescript
 * // Simple retrieval
 * const categories = await getAllMaterialCategories(companyId);
 * 
 * // Populate category dropdown
 * categories.forEach(cat => {
 *   console.log(`${cat.code} - ${cat.name}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With caching
 * import { cache } from './cache.service';
 * 
 * const categories = await cache.getOrSet(
 *   `material_categories:${companyId}`,
 *   () => getAllMaterialCategories(companyId),
 *   3600
 * );
 * ```
 */
export async function getAllMaterialCategories(companyId: string): Promise<MaterialCategory[]> {
    const { data, error } = await supabaseServer
        .from('material_categories')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

    if (error) throw error;
    return data;
}

// ==================== MATERIALS ====================

/**
 * Creates a new raw material.
 * 
 * Materials are purchased items used in production. Each material tracks:
 * - Unit of measure (e.g., 'meters', 'kg', 'pieces')
 * - Reorder level for automatic purchase suggestions
 * - Standard cost for costing purposes
 * - Status lifecycle (active → inactive → discontinued)
 * 
 * @param material - Material details
 * @param material.company_id - UUID of the company
 * @param material.category_id - Optional UUID of material category
 * @param material.code - Unique material code (e.g., 'FAB-001')
 * @param material.name - Material name (e.g., 'Cotton Fabric - Blue')
 * @param material.unit_of_measure - UOM (e.g., 'meters', 'kg', 'pcs')
 * @param material.supplier_code - Optional supplier's code for this material
 * @param material.reorder_level - Optional qty threshold for reordering
 * @param material.standard_cost - Optional standard/expected cost per unit
 * @param material.status - Material status (default: 'active')
 * @param userId - UUID of user creating the material
 * 
 * @throws {Error} If material code not unique
 * @throws {Error} If category doesn't exist
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created material
 * 
 * @example
 * ```typescript
 * // Create fabric material
 * const fabric = await createMaterial({
 *   company_id: companyId,
 *   category_id: fabricCategoryId,
 *   code: 'FAB-COTTON-BLUE',
 *   name: 'Cotton Fabric - Blue',
 *   unit_of_measure: 'meters',
 *   supplier_code: 'SUP-123',
 *   reorder_level: 100,
 *   standard_cost: 50000,
 *   status: 'active'
 * }, userId);
 * ```
 * 
 * @example
 * ```typescript
 * // Create accessory material
 * const button = await createMaterial({
 *   company_id: companyId,
 *   code: 'BTN-PLASTIC-WHITE',
 *   name: 'Plastic Button - White',
 *   unit_of_measure: 'pieces',
 *   reorder_level: 1000,
 *   standard_cost: 500,
 *   status: 'active'
 * }, userId);
 * ```
 * 
 * @see {@link getAllMaterials} for listing materials
 * @see {@link getMaterialsBelowReorderLevel} for reorder alerts
 */
export async function createMaterial(material: Material, userId: string): Promise<Material> {
    const { data, error } = await supabaseServer
        .from('materials')
        .insert({ ...material, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a material by its unique ID.
 * 
 * Includes category details via relationship join when available.
 * 
 * @param materialId - UUID of the material
 * @throws {Error} If material not found
 * @returns Promise resolving to material record
 * 
 * @example
 * ```typescript
 * const material = await getMaterialById(materialId);
 * console.log(`${material.code} - ${material.name}`);
 * console.log(`Category: ${material.category?.name || 'Uncategorized'}`);
 * ```
 */
export async function getMaterialById(materialId: string): Promise<Material> {
    const { data, error } = await supabaseServer
        .from('materials')
        .select('*, category:material_categories(*)')
        .eq('id', materialId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a material by its unique code.
 * 
 * Material codes are often used in external systems, CSV imports,
 * and barcoding. This provides quick lookup by code.
 * 
 * @param companyId - UUID of the company
 * @param materialCode - Unique material code
 * 
 * @throws {Error} If material not found
 * @returns Promise resolving to material record
 * 
 * @example
 * ```typescript
 * // Lookup by code (e.g., from barcode scan)
 * const material = await getMaterialByCode(companyId, 'FAB-COTTON-BLUE');
 * 
 * if (material.status === 'discontinued') {
 *   alert('This material is discontinued!');
 * }
 * ```
 */
export async function getMaterialByCode(
    companyId: string,
    materialCode: string
): Promise<Material> {
    const { data, error } = await supabaseServer
        .from('materials')
        .select('*, category:material_categories(*)')
        .eq('company_id', companyId)
        .eq('code', materialCode)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all materials for a company with optional filtering.
 * 
 * Returns materials with category details. Large companies may have
 * hundreds or thousands of materials - consider caching or pagination.
 * 
 * **Performance Tip:** Cache this for dropdown selections (TTL: 1800s)
 * 
 * @param companyId - UUID of the company
 * @param activeOnly - If true, returns only active materials (default: true)
 * 
 * @returns Promise resolving to array of materials
 * 
 * @example
 * ```typescript
 * // Get active materials only
 * const materials = await getAllMaterials(companyId);
 * 
 * // Get all materials (including inactive)
 * const allMaterials = await getAllMaterials(companyId, false);
 * ```
 * 
 * @see {@link getMaterialsByCategory} for filtering by category
 * @see {@link getMaterialsBelowReorderLevel} for reorder alerts
 */
export async function getAllMaterials(
    companyId: string,
    activeOnly: boolean = true
): Promise<Material[]> {
    let query = supabaseServer
        .from('materials')
        .select('*, category:material_categories(*)')
        .eq('company_id', companyId)
        .order('code');

    if (activeOnly) {
        query = query.eq('status', 'active');
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

/**
 * Retrieves materials filtered by category.
 * 
 * Use this to show materials in a specific category, e.g., when
 * user selects a category from dropdown and wants to see materials.
 * 
 * @param categoryId - UUID of the material category
 * @param activeOnly - If true, returns only active materials (default: true)
 * 
 * @returns Promise resolving to array of materials
 * 
 * @example
 * ```typescript
 * // Get all fabrics
 * const fabrics = await getMaterialsByCategory(fabricCategoryId);
 * 
 * // Build material selection by category
 * const categories = await getAllMaterialCategories(companyId);
 * 
 * for (const category of categories) {
 *   const materials = await getMaterialsByCategory(category.id);
 *   console.log(`\n${category.name}:`);
 *   materials.forEach(m => console.log(`  - ${m.code}: ${m.name}`));
 * }
 * ```
 */
export async function getMaterialsByCategory(
    categoryId: string,
    activeOnly: boolean = true
): Promise<Material[]> {
    let query = supabaseServer
        .from('materials')
        .select('*')
        .eq('category_id', categoryId)
        .order('code');

    if (activeOnly) {
        query = query.eq('status', 'active');
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

/**
 * Updates material details.
 * 
 * Common use cases:
 * - Update standard cost
 * - Adjust reorder level
 * - Change status (discontinue material)
 * - Update description
 * 
 * @param materialId - UUID of material to update
 * @param updates - Partial material object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated material
 * 
 * @example
 * ```typescript
 * // Update cost and reorder level
 * const updated = await updateMaterial(materialId, {
 *   standard_cost: 55000,  // Price increase
 *   reorder_level: 150     // Adjusted threshold
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Discontinue material
 * const discontinued = await updateMaterial(materialId, {
 *   status: 'discontinued'
 * });
 * ```
 */
export async function updateMaterial(
    materialId: string,
    updates: Partial<Material>
): Promise<Material> {
    const { data, error } = await supabaseServer
        .from('materials')
        .update(updates)
        .eq('id', materialId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves materials below their reorder level for purchase planning.
 * 
 * Compares current inventory balance against reorder_level threshold.
 * Materials below threshold should be reordered. This query joins with
 * the materialized view `raw_material_balance_mv` for current quantities.
 * 
 * **Use Cases:**
 * - Daily reorder alerts
 * - Automatic purchase requisition generation
 * - Inventory dashboard warnings
 * - Procurement planning
 * 
 * @param companyId - UUID of the company
 * @param warehouseId - Optional filter by warehouse
 * 
 * @returns Promise resolving to materials needing reorder
 * @returns material.current_qty - Current quantity on hand
 * @returns material.reorder_level - Threshold quantity
 * @returns material.qty_needed - Suggested order quantity (reorder_level - current_qty)
 * 
 * @example
 * ```typescript
 * // Get all materials needing reorder
 * const lowStockMaterials = await getMaterialsBelowReorderLevel(companyId);
 * 
 * console.log('Materials to Reorder:');
 * lowStockMaterials.forEach(m => {
 *   console.log(`${m.code}: Current ${m.current_qty}, Reorder at ${m.reorder_level}`);
 *   console.log(`  Suggested order: ${m.qty_needed} ${m.unit_of_measure}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Auto-generate purchase requisitions
 * const lowStock = await getMaterialsBelowReorderLevel(companyId);
 * 
 * for (const material of lowStock) {
 *   await createPurchaseRequisition({
 *     material_id: material.id,
 *     qty_requested: material.qty_needed,
 *     reason: 'Below reorder level'
 *   });
 * }
 * ```
 * 
 * @see {@link getAllMaterials} for all materials
 * @see {@link updateMaterial} for adjusting reorder levels
 */
export async function getMaterialsBelowReorderLevel(
    companyId: string,
    warehouseId?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('raw_material_balance_mv')
        .select(`
      *,
      material:materials!inner(
        code,
        name,
        unit_of_measure,
        reorder_level,
        category:material_categories(name)
      )
    `)
        .eq('company_id', companyId)
        .not('material.reorder_level', 'is', null);

    if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter where current_qty < reorder_level
    const belowReorder = (data || []).filter((item: any) => {
        const currentQty = parseFloat(item.current_qty || 0);
        const reorderLevel = parseFloat(item.material.reorder_level || 0);
        return currentQty < reorderLevel;
    });

    // Calculate qty needed
    return belowReorder.map((item: any) => ({
        ...item,
        qty_needed: item.material.reorder_level - item.current_qty,
    }));
}
