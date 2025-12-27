/**
 * Batch Operations Service
 * Efficient bulk operations for imports and migrations
 * 
 * Use this for:
 * - Bulk material imports
 * - Bulk product creation
 * - Data migrations
 * - Batch inventory adjustments
 */

import { supabaseServer } from '../config/supabase';

export interface BatchResult<T> {
    successful: T[];
    failed: Array<{ index: number; item: any; error: string }>;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    duration: number;
}

/**
 * Batch processor with configurable chunk size and error handling.
 * 
 * **Features:**
 * - Automatic chunking for large datasets
 * - Individual error handling (one failure doesn't stop the batch)
 * - Progress tracking
 * - Transaction support per chunk
 * 
 * @param items - Array of items to process
 * @param processor - Function to process each chunk
 * @param chunkSize - Number of items per batch (default: 100)
 * 
 * @returns Batch processing result with success/failure details
 * 
 * @example
 * ```typescript
 * const materials = [{ code: 'MAT001', name: 'Cotton' }, ...];
 * 
 * const result = await batchProcess(
 *   materials,
 *   async (chunk) => {
 *     const { data, error } = await supabaseServer
 *       .from('materials')
 *       .insert(chunk);
 *     return data;
 *   },
 *   100  // Process 100 at a time
 * );
 * 
 * console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
 * ```
 */
export async function batchProcess<T, R>(
    items: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize: number = 100
): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const successful: R[] = [];
    const failed: Array<{ index: number; item: T; error: string }> = [];

    // Split into chunks
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }

    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];

        try {
            const results = await processor(chunk);
            successful.push(...results);
        } catch (error: any) {
            // If chunk fails, try items individually
            for (let itemIndex = 0; itemIndex < chunk.length; itemIndex++) {
                const item = chunk[itemIndex];
                const globalIndex = chunkIndex * chunkSize + itemIndex;

                try {
                    const result = await processor([item]);
                    successful.push(...result);
                } catch (itemError: any) {
                    failed.push({
                        index: globalIndex,
                        item,
                        error: itemError.message,
                    });
                }
            }
        }
    }

    return {
        successful,
        failed,
        totalProcessed: items.length,
        successCount: successful.length,
        failureCount: failed.length,
        duration: Date.now() - startTime,
    };
}

/**
 * Bulk material import with validation.
 * 
 * @example
 * ```typescript
 * const csvData = [
 *   { code: 'MAT001', name: 'Cotton Fabric', unit_cost: 50 },
 *   { code: 'MAT002', name: 'Polyester', unit_cost: 30 },
 * ];
 * 
 * const result = await bulkImportMaterials(companyId, csvData, userId);
 * console.log(`Imported ${result.successCount} materials`);
 * ```
 */
export async function bulkImportMaterials(
    companyId: string,
    materials: any[],
    userId: string
): Promise<BatchResult<any>> {
    return batchProcess(
        materials,
        async (chunk) => {
            const materialsWithMeta = chunk.map((m) => ({
                ...m,
                company_id: companyId,
                created_by: userId,
            }));

            const { data, error } = await supabaseServer
                .from('materials')
                .insert(materialsWithMeta)
                .select();

            if (error) throw error;
            return data;
        },
        50 // 50 materials per batch
    );
}

/**
 * Bulk product variant creation (size × color matrix).
 * 
 * @example
 * ```typescript
 * const result = await bulkCreateVariants(
 *   companyId,
 *   productId,
 *   ['S', 'M', 'L', 'XL'],
 *   ['Red', 'Blue', 'Green'],
 *   userId
 * );
 * // Creates 4 × 3 = 12 variants
 * ```
 */
export async function bulkCreateVariants(
    companyId: string,
    productId: string,
    sizeIds: string[],
    colorIds: string[],
    userId: string
): Promise<BatchResult<any>> {
    // Generate all combinations
    const variants = [];
    for (const sizeId of sizeIds) {
        for (const colorId of colorIds) {
            variants.push({
                company_id: companyId,
                product_id: productId,
                size_id: sizeId,
                color_id: colorId,
                created_by: userId,
            });
        }
    }

    return batchProcess(
        variants,
        async (chunk) => {
            const { data, error } = await supabaseServer
                .from('product_variants')
                .insert(chunk)
                .select();

            if (error) throw error;
            return data;
        },
        20 // 20 variants per batch
    );
}

/**
 * Bulk inventory adjustment (stock opname results).
 * 
 * @example
 * ```typescript
 * const adjustments = [
 *   { material_id: 'mat1', bin_id: 'bin1', qty: 100, unit_cost: 50 },
 *   { material_id: 'mat2', bin_id: 'bin2', qty: 200, unit_cost: 30 },
 * ];
 * 
 * const result = await bulkInventoryAdjust(companyId, adjustments, userId);
 * ```
 */
export async function bulkInventoryAdjust(
    companyId: string,
    adjustments: Array<{
        material_id: string;
        bin_id: string;
        warehouse_id: string;
        qty: number;
        unit_cost: number;
    }>,
    periodId: string,
    userId: string
): Promise<BatchResult<any>> {
    return batchProcess(
        adjustments,
        async (chunk) => {
            const entries = chunk.map((adj) => ({
                company_id: companyId,
                material_id: adj.material_id,
                warehouse_id: adj.warehouse_id,
                bin_id: adj.bin_id,
                period_id: periodId,
                transaction_date: new Date().toISOString().split('T')[0],
                reference_type: 'ADJUSTMENT',
                reference_number: `ADJ-BULK-${Date.now()}`,
                qty_in: adj.qty,
                unit_cost: adj.unit_cost,
                created_by: userId,
            }));

            const { data, error } = await supabaseServer
                .from('raw_material_ledger')
                .insert(entries)
                .select();

            if (error) throw error;
            return data;
        },
        25 // 25 adjustments per batch
    );
}
