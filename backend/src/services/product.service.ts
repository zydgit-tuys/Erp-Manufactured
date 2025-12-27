/**
 * Product Service
 * Manages products, variants (SKUs), sizes, and colors for fashion/konveksi business
 * 
 * Fashion Industry Model:
 * - Product (Style) → Multiple Variants (SKU) → Size × Color matrix
 * - Example: "Polo Shirt" → 20 variants (5 sizes × 4 colors)
 * 
 * Critical for:
 * - SKU-level inventory tracking
 * - Size/color matrix generation
 * - Multi-channel pricing (POS, wholesale, marketplace)
 */
import { supabaseServer } from '../config/supabase';

export interface Product {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    description?: string;
    category?: string;
    status: 'active' | 'inactive' | 'discontinued';
    is_active?: boolean;
}

export interface ProductVariant {
    id?: string;
    company_id: string;
    product_id: string;
    sku: string;
    size_id?: string;
    color_id?: string;
    barcode?: string;
    selling_price?: number;
    cost_price?: number;
    status: 'active' | 'inactive';
}

export interface Size {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    sort_order?: number;
}

export interface Color {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    hex_code?: string;
    sort_order?: number;
}

// ==================== PRODUCTS ====================

/**
 * Creates a new product (style).
 * 
 * Products are high-level styles that have multiple variants (SKUs).
 * In fashion business: Product = design/style, Variant = specific size+color combination.
 * 
 * **Example Product Structure:**
 * - Product: "Polo Shirt Classic"
 * - Variants: S-Red, S-Blue, M-Red, M-Blue, L-Red, L-Blue, etc.
 * 
 * @param product - Product details
 * @param product.company_id - UUID of the company
 * @param product.code - Unique product code (e.g., 'POLO-CLASSIC')
 * @param product.name - Product name (e.g., 'Polo Shirt Classic')
 * @param product.category - Product category (e.g., 'Shirts', 'Pants')
 * @param product.status - Product status (default: 'active')
 * @param userId - UUID of user creating the product
 * 
 * @throws {Error} If product code not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created product
 * 
 * @example
 * ```typescript
 * const product = await createProduct({
 *   company_id: companyId,
 *   code: 'POLO-CLASSIC',
 *   name: 'Polo Shirt Classic',
 *   description: 'Classic fit polo shirt with logo',
 *   category: 'Shirts',
 *   status: 'active'
 * }, userId);
 * 
 * // Next: Create variants for this product
 * await createProductWithVariants(product.id, sizeIds, colorIds);
 * ```
 * 
 * @see {@link createProductWithVariants} for bulk variant creation
 * @see {@link createProductVariant} for individual variant creation
 */
export async function createProduct(product: Product, userId: string): Promise<Product> {
    const { data, error } = await supabaseServer
        .from('products')
        .insert({ ...product, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a product by its unique ID with all variants.
 * 
 * Includes nested variant data showing size and color details.
 * Useful for product detail pages showing all available SKUs.
 * 
 * @param productId - UUID of the product
 * @throws {Error} If product not found
 * @returns Promise resolving to product with variants
 * 
 * @example
 * ```typescript
 * const product = await getProductById(productId);
 * 
 * console.log(`${product.name}: ${product.variants.length} SKUs`);
 * product.variants.forEach(v => {
 *   console.log(`  ${v.sku}: ${v.size.name}-${v.color.name} @ ${v.selling_price}`);
 * });
 * ```
 */
export async function getProductById(productId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('products')
        .select(`
      *,
      variants:product_variants(
        *,
        size:sizes(*),
        color:colors(*)
      )
    `)
        .eq('id', productId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active products for a company.
 * 
 * Returns products ordered by code. For large catalogs, consider
 * pagination or caching. Products are frequently accessed in dropdowns
 * and product selection screens.
 * 
 * **Caching Recommended:** Products change infrequently (TTL: 1800s)
 * 
 * @param companyId - UUID of the company
 * @param activeOnly - If true, returns only active products (default: true)
 * 
 * @returns Promise resolving to array of products
 * 
 * @example
 * ```typescript
 * // Get active products
 * const products = await getAllProducts(companyId);
 * 
 * // Product catalog dropdown
 * products.forEach(p => {
 *   console.log(`${p.code} - ${p.name}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // With caching for performance
 * import { cache, CacheKeys } from './cache.service';
 * 
 * const products = await cache.getOrSet(
 *   CacheKeys.products(companyId),
 *   () => getAllProducts(companyId),
 *   1800  // Cache for 30 minutes
 * );
 * ```
 */
export async function getAllProducts(
    companyId: string,
    activeOnly: boolean = true
): Promise<Product[]> {
    let query = supabaseServer
        .from('products')
        .select('*')
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
 * Retrieves products filtered by category.
 * 
 * @param companyId - UUID of the company
 * @param category - Category name to filter by
 * 
 * @returns Promise resolving to array of products
 * 
 * @example
 * ```typescript
 * const shirts = await getProductsByCategory(companyId, 'Shirts');
 * const pants = await getProductsByCategory(companyId, 'Pants');
 * ```
 */
export async function getProductsByCategory(
    companyId: string,
    category: string
): Promise<Product[]> {
    const { data, error } = await supabaseServer
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .eq('category', category)
        .eq('status', 'active')
        .order('code');

    if (error) throw error;
    return data;
}

/**
 * Updates product details.
 * 
 * @param productId - UUID of product to update
 * @param updates - Partial product object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated product
 * 
 * @example
 * ```typescript
 * // Discontinue product
 * const updated = await updateProduct(productId, {
 *   status: 'discontinued'
 * });
 * ```
 */
export async function updateProduct(productId: string, updates: Partial<Product>): Promise<Product> {
    const { data, error } = await supabaseServer
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ==================== VARIANTS (SKUs) ====================

/**
 * Creates a single product variant (SKU).
 * 
 * Variants represent specific size+color combinations. Each variant
 * has its own SKU, barcode, pricing, and inventory tracking.
 * 
 * **SKU Naming Convention:**
 * - Use structured codes: PRODUCT-SIZE-COLOR (e.g., 'POLO-M-RED')
 * - Or sequential: PRODUCT-001, PRODUCT-002, etc.
 * - Ensure uniqueness across all variants
 * 
 * @param variant - Variant details
 * @param variant.company_id - UUID of the company
 * @param variant.product_id - UUID of parent product
 * @param variant.sku - Unique SKU code
 * @param variant.size_id - UUID of the size
 * @param variant.color_id - UUID of the color
 * @param variant.barcode - Optional barcode for POS scanning
 * @param variant.selling_price - Retail price
 * @param variant.cost_price - Production/purchase cost
 * @param userId - UUID of user creating the variant
 * 
 * @throws {Error} If SKU not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created variant
 * 
 * @example
 * ```typescript
 * const variant = await createProductVariant({
 *   company_id: companyId,
 *   product_id: productId,
 *   sku: 'POLO-M-RED',
 *   size_id: mediumSizeId,
 *   color_id: redColorId,
 *   barcode: '1234567890123',
 *   selling_price: 150000,
 *   cost_price: 100000,
 *   status: 'active'
 * }, userId);
 * ```
 * 
 * @see {@link createProductWithVariants} for bulk creation
 */
export async function createProductVariant(
    variant: ProductVariant,
    userId: string
): Promise<ProductVariant> {
    const { data, error } = await supabaseServer
        .from('product_variants')
        .insert({ ...variant, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a variant by its unique ID with product, size, and color details.
 * 
 * @param variantId - UUID of the variant
 * @throws {Error} If variant not found
 * @returns Promise resolving to variant with related data
 * 
 * @example
 * ```typescript
 * const variant = await getVariantById(variantId);
 * console.log(`${variant.product.name} - ${variant.size.name} ${variant.color.name}`);
 * console.log(`SKU: ${variant.sku}, Price: ${variant.selling_price}`);
 * ```
 */
export async function getVariantById(variantId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('product_variants')
        .select(`
      *,
      product:products(*),
      size:sizes(*),
      color:colors(*)
    `)
        .eq('id', variantId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a variant by its SKU code.
 * 
 * SKU lookup is common in:
 * - POS barcode scanning
 * - Inventory transactions
 * - Marketplace integration
 * - CSV imports
 * 
 * @param companyId - UUID of the company
 * @param sku - Unique SKU code
 * 
 * @throws {Error} If variant not found
 * @returns Promise resolving to variant
 * 
 * @example
 * ```typescript
 * // POS barcode scan
 * const variant = await getVariantBySKU(companyId, scannedBarcode);
 * 
 * await addPOSLine({
 *   variant_id: variant.id,
 *   qty: 1,
 *   unit_price: variant.selling_price
 * });
 * ```
 */
export async function getVariantBySKU(companyId: string, sku: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('product_variants')
        .select(`
      *,
      product:products(*),
      size:sizes(*),
      color:colors(*)
    `)
        .eq('company_id', companyId)
        .eq('sku', sku)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all variants for a product.
 * 
 * Shows all size×color combinations available for a product.
 * Use for product detail pages showing availability matrix.
 * 
 * @param productId - UUID of the product
 * @returns Promise resolving to array of variants
 * 
 * @example
 * ```typescript
 * const variants = await getVariantsByProduct(productId);
 * 
 * // Display size/color matrix
 * const sizes = [...new Set(variants.map(v => v.size.name))];
 * const colors = [...new Set(variants.map(v => v.color.name))];
 * 
 * sizes.forEach(size => {
 *   colors.forEach(color => {
 *     const variant = variants.find(v => 
 *       v.size.name === size && v.color.name === color
 *     );
 *     console.log(`${size}-${color}: ${variant ? 'Available' : 'N/A'}`);
 *   });
 * });
 * ```
 */
export async function getVariantsByProduct(productId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('product_variants')
        .select(`
      *,
      size:sizes(*),
      color:colors(*)
    `)
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('sku');

    if (error) throw error;
    return data;
}

/**
 * Updates variant details.
 * 
 * Common updates: pricing changes, status updates, barcode assignment.
 * 
 * @param variantId - UUID of variant to update
 * @param updates - Partial variant object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated variant
 * 
 * @example
 * ```typescript
 * // Update pricing
 * await updateVariant(variantId, {
 *   selling_price: 175000,  // Price increase
 *   cost_price: 110000
 * });
 * ```
 */
export async function updateVariant(
    variantId: string,
    updates: Partial<ProductVariant>
): Promise<ProductVariant> {
    const { data, error } = await supabaseServer
        .from('product_variants')
        .update(updates)
        .eq('id', variantId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Creates all size×color variants for a product in bulk.
 * 
 * **Fashion Industry Standard:**
 * Automatically generates all possible size×color combinations.
 * Essential for fashion/konveksi where products come in multiple sizes and colors.
 * 
 * **Example:** 5 sizes × 4 colors = 20 variants created automatically
 * 
 * **SKU Generation:**
 * - Format: PRODUCT-SIZE-COLOR
 * - Example: POLO-M-RED, POLO-L-BLUE, etc.
 * 
 * @param companyId - UUID of the company
 * @param productId - UUID of the product
 * @param sizeIds - Array of size UUIDs
 * @param colorIds - Array of color UUIDs
 * @param basePrice - Optional base selling price for all variants
 * @param baseCost - Optional base cost price for all variants
 * @param userId - UUID of user creating the variants
 * 
 * @throws {Error} If variant creation fails
 * @returns Promise resolving to batch processing result
 * 
 * @example
 * ```typescript
 * // Get sizes and colors
 * const sizes = await getAllSizes(companyId);  // S, M, L, XL, XXL
 * const colors = await getAllColors(companyId); // Red, Blue, Black, White
 * 
 * // Create all combinations
 * const result = await createProductWithVariants(
 *   companyId,
 *   productId,
 *   sizes.map(s => s.id),
 *   colors.map(c => c.id),
 *   150000,  // Base price
 *   100000,  // Base cost
 *   userId
 * );
 * 
 * console.log(`Created ${result.successCount} variants`);
 * // Output: Created 20 variants (5 sizes × 4 colors)
 * ```
 * 
 * @example
 * ```typescript
 * // Limited color palette for specific product
 * const neutralColors = colors.filter(c => 
 *   ['Black', 'White', 'Gray'].includes(c.name)
 * );
 * 
 * const result = await createProductWithVariants(
 *   companyId,
 *   productId,
 *   sizeIds,
 *   neutralColors.map(c => c.id),
 *   200000,
 *   150000,
 *   userId
 * );
 * ```
 * 
 * @see {@link bulkCreateVariants} in batch.service for implementation
 * @see {@link getAllSizes} for retrieving sizes
 * @see {@link getAllColors} for retrieving colors
 */
export async function createProductWithVariants(
    companyId: string,
    productId: string,
    sizeIds: string[],
    colorIds: string[],
    basePrice?: number,
    baseCost?: number,
    userId?: string
): Promise<any> {
    const product = await getProductById(productId);
    const variants = [];

    // Generate all size×color combinations
    for (const sizeId of sizeIds) {
        for (const colorId of colorIds) {
            // Get size and color details for SKU generation
            const { data: size } = await supabaseServer
                .from('sizes')
                .select('code')
                .eq('id', sizeId)
                .single();

            const { data: color } = await supabaseServer
                .from('colors')
                .select('code')
                .eq('id', colorId)
                .single();

            variants.push({
                company_id: companyId,
                product_id: productId,
                sku: `${product.code}-${size!.code}-${color!.code}`,
                size_id: sizeId,
                color_id: colorId,
                selling_price: basePrice,
                cost_price: baseCost,
                status: 'active',
                created_by: userId,
            });
        }
    }

    // Batch insert (use batch service for better error handling)
    const { data, error } = await supabaseServer
        .from('product_variants')
        .insert(variants)
        .select();

    if (error) throw error;

    return {
        successful: data,
        successCount: data.length,
        failureCount: 0,
        failed: [],
    };
}

// ==================== SIZES ====================

/**
 * Creates a new size option.
 * 
 * Sizes are reusable across all products. Standard sizes for fashion:
 * XS, S, M, L, XL, XXL, XXXL (or numerical: 38, 40, 42, etc.)
 * 
 * @param size - Size details
 * @param size.company_id - UUID of the company
 * @param size.code - Size code (e.g., 'M', '42')
 * @param size.name - Size display name (e.g., 'Medium', 'Size 42')
 * @param size.sort_order - Optional display order (S=1, M=2, L=3, etc.)
 * @param userId - UUID of user creating the size
 * 
 * @throws {Error} If size code not unique
 * @returns Promise resolving to created size
 * 
 * @example
 * ```typescript
 * // Create standard sizes
 * const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
 * 
 * for (let i = 0; i < sizes.length; i++) {
 *   await createSize({
 *     company_id: companyId,
 *     code: sizes[i],
 *     name: sizes[i],
 *     sort_order: i + 1
 *   }, userId);
 * }
 * ```
 */
export async function createSize(size: Size, userId: string): Promise<Size> {
    const { data, error } = await supabaseServer
        .from('sizes')
        .insert({ ...size, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all sizes for a company, ordered by sort_order.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of sizes
 * 
 * @example
 * ```typescript
 * const sizes = await getAllSizes(companyId);
 * // Returns: [XS, S, M, L, XL, XXL] in order
 * ```
 */
export async function getAllSizes(companyId: string): Promise<Size[]> {
    const { data, error } = await supabaseServer
        .from('sizes')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order');

    if (error) throw error;
    return data;
}

// ==================== COLORS ====================

/**
 * Creates a new color option.
 * 
 * Colors are reusable across all products. Can include hex codes
 * for UI display purposes.
 * 
 * @param color - Color details
 * @param color.company_id - UUID of the company
 * @param color.code - Color code (e.g., 'RED', 'BLU')
 * @param color.name - Color display name (e.g., 'Red', 'Navy Blue')
 * @param color.hex_code - Optional hex color code (e.g., '#FF0000')
 * @param color.sort_order - Optional display order
 * @param userId - UUID of user creating the color
 * 
 * @throws {Error} If color code not unique
 * @returns Promise resolving to created color
 * 
 * @example
 * ```typescript
 * // Create standard colors
 * const colors = [
 *   { code: 'BLK', name: 'Black', hex: '#000000' },
 *   { code: 'WHT', name: 'White', hex: '#FFFFFF' },
 *   { code: 'RED', name: 'Red', hex: '#FF0000' },
 *   { code: 'BLU', name: 'Blue', hex: '#0000FF' }
 * ];
 * 
 * for (const c of colors) {
 *   await createColor({
 *     company_id: companyId,
 *     code: c.code,
 *     name: c.name,
 *     hex_code: c.hex
 *   }, userId);
 * }
 * ```
 */
export async function createColor(color: Color, userId: string): Promise<Color> {
    const { data, error } = await supabaseServer
        .from('colors')
        .insert({ ...color, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all colors for a company, ordered by sort_order.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of colors
 * 
 * @example
 * ```typescript
 * const colors = await getAllColors(companyId);
 * 
 * // Display color swatches
 * colors.forEach(c => {
 *   console.log(`${c.name}: ${c.hex_code}`);
 * });
 * ```
 */
export async function getAllColors(companyId: string): Promise<Color[]> {
    const { data, error } = await supabaseServer
        .from('colors')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order');

    if (error) throw error;
    return data;
}
