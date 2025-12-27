/**
 * Sales Service
 * Multi-channel sales operations: POS, Sales Orders, Marketplace
 * 
 * Handles point-of-sale transactions with instant inventory deduction,
 * sales analytics, and multi-payment method support.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

// ==================== TYPES ====================

export interface SalesPOS {
    id?: string;
    company_id: string;
    pos_number: string;
    sale_date: string;
    customer_id?: string;
    warehouse_id: string;
    period_id: string;
    discount_amount?: number;
    tax_amount?: number;
    payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD';
    payment_reference?: string;
    amount_tendered?: number;
    notes?: string;
}

export interface POSLine {
    id?: string;
    pos_id: string;
    line_number: number;
    product_variant_id: string;
    qty: number;
    unit_price: number;
    discount_percentage?: number;
}

// ==================== SALES POS ====================

/**
 * Creates a new point-of-sale transaction in draft status.
 * 
 * The POS transaction is created in draft status and must be posted
 * to issue inventory and create journal entries. Validates the accounting
 * period is open before creation.
 * 
 * **Workflow:**
 * 1. Create POS header (this function)
 * 2. Add POS lines with {@link addPOSLine}
 * 3. Post to inventory with {@link postPOSSale}
 * 
 * @param pos - POS transaction details
 * @param pos.company_id - UUID of the company
 * @param pos.pos_number - Unique POS number (e.g., 'POS-2025-001')
 * @param pos.sale_date - Date of the sale
 * @param pos.customer_id - Optional customer UUID (for registered customers)
 * @param pos.warehouse_id - UUID of the warehouse issuing inventory
 * @param pos.period_id - UUID of the accounting period (must be open)
 * @param pos.payment_method - One of: CASH, BANK_TRANSFER, CHECK, GIRO, CREDIT_CARD
 * @param pos.discount_amount - Optional total discount
 * @param pos.tax_amount - Optional sales tax
 * @param pos.amount_tendered - Optional cash tendered (for change calculation)
 * @param userId - UUID of the cashier/user
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created POS record
 * 
 * @example
 * ```typescript
 * // Create cash sale
 * const pos = await createPOSSale({
 *   company_id: companyId,
 *   pos_number: 'POS-2025-001',
 *   sale_date: '2025-01-15',
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   payment_method: 'CASH',
 *   amount_tendered: 1500
 * }, userId);
 * 
 * // Add items
 * await addPOSLine({ pos_id: pos.id, ... });
 * 
 * // Post to inventory
 * await postPOSSale(pos.id, userId);
 * ```
 * 
 * @see {@link addPOSLine} for adding line items
 * @see {@link postPOSSale} for posting to inventory
 */
export async function createPOSSale(pos: SalesPOS, userId: string): Promise<SalesPOS> {
    await validatePeriodIsOpen(pos.period_id);

    const { data, error } = await supabaseServer
        .from('sales_pos')
        .insert({ ...pos, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to a POS transaction.
 * 
 * Each line represents one product variant with quantity and price.
 * Discounts can be applied at the line level as a percentage.
 * 
 * @param line - POS line item details
 * @param line.pos_id - UUID of the parent POS transaction
 * @param line.line_number - Sequential line number (1, 2, 3...)
 * @param line.product_variant_id - UUID of the product variant (SKU)
 * @param line.qty - Quantity sold
 * @param line.unit_price - Price per unit
 * @param line.discount_percentage - Optional line-level discount (0-100)
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Add product line with discount
 * await addPOSLine({
 *   pos_id: posId,
 *   line_number: 1,
 *   product_variant_id: variantId,
 *   qty: 2,
 *   unit_price: 100,
 *   discount_percentage: 10  // 10% off
 * });
 * // Line total: 2 × 100 × (1 - 0.10) = 180
 * ```
 * 
 * @see {@link createPOSSale} for creating the parent POS
 */
export async function addPOSLine(line: POSLine): Promise<POSLine> {
    const { data, error } = await supabaseServer
        .from('sales_pos_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Posts a POS sale to inventory and general ledger.
 * 
 * **This function calls the database RPC `post_pos_sale` which:**
 * 1. Issues finished goods inventory (reduces quantity)
 * 2. Creates journal entries:
 *    - DR Cash/Bank (or AR)
 *    - CR Sales Revenue
 *    - DR Cost of Goods Sold
 *    - CR Finished Goods Inventory
 * 3. Updates POS status to 'posted'
 * 
 * **Important:** This is a blocking operation. Inventory is immediately deducted.
 * 
 * @param posId - UUID of the POS transaction to post
 * @param userId - UUID of user posting the transaction
 * 
 * @throws {Error} If insufficient inventory
 * @throws {Error} If period is closed
 * @throws {Error} If database RPC fails
 * @returns Promise that resolves when posting complete
 * 
 * @example
 * ```typescript
 * try {
 *   await postPOSSale(posId, userId);
 *   console.log('Sale completed - inventory deducted');
 * } catch (error) {
 *   if (error.message.includes('Insufficient stock')) {
 *     alert('Product out of stock!');
 *   }
 * }
 * ```
 * 
 * @see {@link createPOSSale} for creating sales
 * @see {@link voidPOSSale} for cancelling posted sales
 */
export async function postPOSSale(posId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('post_pos_sale', {
        p_pos_id: posId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves a POS sale with all related details (customer, warehouse, lines, products).
 * 
 * Uses Supabase's relationship syntax to eagerly load nested data in one query.
 * 
 * @param posId - UUID of the POS sale
 * @throws {Error} If POS not found
 * @returns Promise resolving to POS with nested relationships
 * 
 * @example
 * ```typescript
 * const pos = await getPOSSale(posId);
 * 
 * console.log(pos.customer.name);
 * console.log(pos.warehouse.name);
 * pos.lines.forEach(line => {
 *   console.log(line.variant.sku, line.qty, line.unit_price);
 * });
 * ```
 */
export async function getPOSSale(posId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('sales_pos')
        .select(`
      *,
      customer:customers(*),
      warehouse:warehouses(*),
      lines:sales_pos_lines(*, variant:product_variants(*, product:products(*)))
    `)
        .eq('id', posId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves daily POS sales summary from materialized view.
 * 
 * The `daily_pos_sales_vw` materialized view aggregates sales by date,
 * providing pre-calculated totals for fast reporting. Refresh the view
 * periodically for up-to-date data.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * 
 * @returns Promise resolving to daily sales summaries
 * @returns summary.sale_date - Date of sales
 * @returns summary.transaction_count - Number of transactions
 * @returns summary.total_amount - Total sales amount
 * 
 * @example
 * ```typescript
 * // Get last 7 days of sales
 * const summary = await getDailyPOSSales(
 *   companyId,
 *   '2025-01-10',
 *   '2025-01-17'
 * );
 * 
 * summary.forEach(day => {
 *   console.log(`${day.sale_date}: ${day.transaction_count} sales, $${day.total_amount}`);
 * });
 * ```
 * 
 * @see {@link getSalesSummary} for period totals
 */
export async function getDailyPOSSales(
    companyId: string,
    startDate: string,
    endDate: string
): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('daily_pos_sales_vw')
        .select('*')
        .eq('company_id', companyId)
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Retrieves all POS sales with optional date filtering.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Optional start date filter (YYYY-MM-DD)
 * @param endDate - Optional end date filter (YYYY-MM-DD)
 * 
 * @returns Promise resolving to array of POS sales
 * 
 * @example
 * ```typescript
 * // Get all sales this month
 * const sales = await getAllPOSSales(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 * ```
 */
export async function getAllPOSSales(
    companyId: string,
    startDate?: string,
    endDate?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('sales_pos')
        .select('*, customer:customers(name), warehouse:warehouses(name)')
        .eq('company_id', companyId);

    if (startDate) {
        query = query.gte('sale_date', startDate);
    }

    if (endDate) {
        query = query.lte('sale_date', endDate);
    }

    const { data, error } = await query.order('sale_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Voids a POS sale by updating status to cancelled.
 * 
 * **Important:** This does NOT reverse inventory. For posted sales,
 * manual inventory adjustments may be required.
 * 
 * @param posId - UUID of the POS sale to void
 * @param reason - Reason for voiding
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when void complete
 * 
 * @example
 * ```typescript
 * await voidPOSSale(posId, 'Customer returned all items');
 * ```
 */
export async function voidPOSSale(posId: string, reason: string): Promise<void> {
    const { error } = await supabaseServer
        .from('sales_pos')
        .update({
            status: 'cancelled',
            notes: `VOIDED: ${reason}`,
        })
        .eq('id', posId);

    if (error) throw error;
}

// ==================== SALES REPORTING ====================

/**
 * Analyzes top-selling products by revenue within a date range.
 * 
 * Aggregates sales_pos_lines by product variant, calculating total
 * quantity and revenue for each. Sorts by revenue descending.
 * 
 * **Client-side aggregation** to support complex calculations.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param limit - Number of top products to return (default: 10)
 * 
 * @returns Promise resolving to array of top products
 * @returns product.product_variant_id - UUID of product variant
 * @returns product.sku - Product SKU
 * @returns product.product_name - Product name
 * @returns product.total_qty - Total quantity sold
 * @returns product.total_revenue - Total revenue generated
 * 
 * @example
 * ```typescript
 * const topProducts = await getTopSellingProducts(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31',
 *   5  // Top 5
 * );
 * 
 * topProducts.forEach((p, i) => {
 *   console.log(`${i+1}. ${p.product_name}: ${p.total_qty} units, $${p.total_revenue}`);
 * });
 * ```
 * 
 * @see {@link getSalesByPaymentMethod} for payment analysis
 */
export async function getTopSellingProducts(
    companyId: string,
    startDate: string,
    endDate: string,
    limit: number = 10
): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('sales_pos_lines')
        .select(`
      product_variant_id,
      variant:product_variants(sku, product:products(name)),
      qty,
      line_total,
      pos:sales_pos!inner(company_id, sale_date, status)
    `)
        .eq('pos.company_id', companyId)
        .eq('pos.status', 'posted')
        .gte('pos.sale_date', startDate)
        .lte('pos.sale_date', endDate);

    if (error) throw error;

    // Aggregate by product variant
    const aggregated = (data || []).reduce((acc: any, line: any) => {
        const key = line.product_variant_id;
        if (!acc[key]) {
            acc[key] = {
                product_variant_id: line.product_variant_id,
                sku: line.variant?.sku,
                product_name: line.variant?.product?.name,
                total_qty: 0,
                total_revenue: 0,
            };
        }
        acc[key].total_qty += parseFloat(line.qty);
        acc[key].total_revenue += parseFloat(line.line_total);
        return acc;
    }, {});

    return Object.values(aggregated)
        .sort((a: any, b: any) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
}

/**
 * Analyzes sales by payment method within a date range.
 * 
 * Groups sales by payment method and calculates transaction count
 * and total amount for each method.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * 
 * @returns Promise resolving to payment method breakdown
 * @returns method.payment_method - Payment method name
 * @returns method.count - Number of transactions
 * @returns method.total_amount - Total amount collected
 * 
 * @example
 * ```typescript
 * const byPayment = await getSalesByPaymentMethod(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 * 
 * byPayment.forEach(m => {
 *   console.log(`${m.payment_method}: ${m.count} transactions, $${m.total_amount}`);
 * });
 * // Output:
 * // CASH: 120 transactions, $15,000
 * // CREDIT_CARD: 45 transactions, $12,500
 * // BANK_TRANSFER: 10 transactions, $8,000
 * ```
 * 
 * @see {@link getTopSellingProducts} for product analysis
 */
export async function getSalesByPaymentMethod(
    companyId: string,
    startDate: string,
    endDate: string
): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('sales_pos')
        .select('payment_method, total_amount')
        .eq('company_id', companyId)
        .eq('status', 'posted')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

    if (error) throw error;

    // Aggregate by payment method
    const aggregated = (data || []).reduce((acc: any, sale: any) => {
        const method = sale.payment_method;
        if (!acc[method]) {
            acc[method] = {
                payment_method: method,
                count: 0,
                total_amount: 0,
            };
        }
        acc[method].count += 1;
        acc[method].total_amount += parseFloat(sale.total_amount || 0);
        return acc;
    }, {});

    return Object.values(aggregated);
}

/**
 * Calculates sales summary for a period.
 * 
 * Aggregates all posted sales within the date range to provide
 * totals for transactions, revenue, discounts, and tax.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * 
 * @returns Promise resolving to sales summary
 * @returns summary.transaction_count - Total number of sales
 * @returns summary.total_revenue - Total revenue
 * @returns summary.total_discounts - Total discounts given
 * @returns summary.total_tax - Total tax collected
 * 
 * @example
 * ```typescript
 * const summary = await getSalesSummary(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 * 
 * console.log(`Total Sales: $${summary.total_revenue}`);
 * console.log(`Transactions: ${summary.transaction_count}`);
 * console.log(`Avg per transaction: $${summary.total_revenue / summary.transaction_count}`);
 * ```
 * 
 * @see {@link getDailyPOSSales} for daily breakdown
 */
export async function getSalesSummary(
    companyId: string,
    startDate: string,
    endDate: string
): Promise<any> {
    const { data, error } = await supabaseServer
        .from('sales_pos')
        .select('total_amount, discount_amount, tax_amount')
        .eq('company_id', companyId)
        .eq('status', 'posted')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate);

    if (error) throw error;

    const summary = (data || []).reduce(
        (acc, sale) => ({
            transaction_count: acc.transaction_count + 1,
            total_revenue: acc.total_revenue + parseFloat(sale.total_amount || 0),
            total_discounts: acc.total_discounts + parseFloat(sale.discount_amount || 0),
            total_tax: acc.total_tax + parseFloat(sale.tax_amount || 0),
        }),
        {
            transaction_count: 0,
            total_revenue: 0,
            total_discounts: 0,
            total_tax: 0,
        }
    );

    return summary;
}

// ==================== SALES POS RETURNS ====================

export interface POSReturn {
    id?: string;
    company_id: string;
    return_number: string;
    return_date: string;
    original_pos_id: string;
    customer_id?: string;
    warehouse_id: string;
    period_id: string;
    refund_method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD';
    refund_reference?: string;
    refund_amount?: number;
    return_reason?: string;
    notes?: string;
}

export interface POSReturnLine {
    id?: string;
    return_id: string;
    line_number: number;
    original_line_id?: string;
    product_variant_id: string;
    qty_returned: number;
    unit_price: number;
    return_reason?: string;
    condition: 'RESELLABLE' | 'DAMAGED' | 'DEFECTIVE';
    notes?: string;
}

/**
 * Creates a POS return/refund transaction for customer returns.
 * 
 * **Return Workflow:**
 * 1. Create return header (this function)
 * 2. Add return lines with {@link addReturnLine}
 * 3. Approve return with {@link approvePOSReturn}
 * 4. Post to inventory with {@link postPOSReturn}
 * 
 * **Return Reasons:**
 * - DEFECTIVE: Product is defective
 * - WRONG_SIZE: Customer ordered wrong size
 * - WRONG_COLOR: Customer ordered wrong color
 * - CUSTOMER_REQUEST: Other customer request
 * - DAMAGED: Product damaged in shipping
 * 
 * @param returnData - Return transaction details
 * @param returnData.company_id - UUID of the company
 * @param returnData.return_number - Unique return number (e.g., 'RET-2025-001')
 * @param returnData.return_date - Date of return
 * @param returnData.original_pos_id - UUID of original POS sale
 * @param returnData.warehouse_id - UUID of warehouse receiving returned goods
 * @param returnData.period_id - UUID of accounting period (must be open)
 * @param returnData.refund_method - Refund payment method
 * @param returnData.return_reason - Reason for return
 * @param userId - UUID of user creating the return
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If original POS not found
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created return
 * 
 * @example
 * ```typescript
 * // Customer returns defective items
 * const posReturn = await createPOSReturn({
 *   company_id: companyId,
 *   return_number: 'RET-2025-001',
 *   return_date: '2025-01-16',
 *   original_pos_id: originalPOSId,
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   refund_method: 'CASH',
 *   return_reason: 'DEFECTIVE',
 *   notes: 'Seam came apart after first wash'
 * }, userId);
 * 
 * // Add returned items
 * await addReturnLine({
 *   return_id: posReturn.id,
 *   line_number: 1,
 *   product_variant_id: variantId,
 *   qty_returned: 1,
 *   unit_price: 100,
 *   condition: 'DAMAGED'
 * });
 * 
 * // Approve and post
 * await approvePOSReturn(posReturn.id, managerId);
 * await postPOSReturn(posReturn.id, userId);
 * ```
 * 
 * @see {@link addReturnLine} for adding return items
 * @see {@link approvePOSReturn} for approval
 * @see {@link postPOSReturn} for posting
 */
export async function createPOSReturn(returnData: POSReturn, userId: string): Promise<POSReturn> {
    await validatePeriodIsOpen(returnData.period_id);

    const { data, error } = await supabaseServer
        .from('sales_pos_returns')
        .insert({ ...returnData, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to a POS return.
 * 
 * **Important:** Return quantity is validated against original sale quantity.
 * Cannot return more than was originally sold.
 * 
 * **Condition Types:**
 * - **RESELLABLE:** Item can be resold, will be added back to inventory
 * - **DAMAGED:** Item is damaged, will be written off as loss
 * - **DEFECTIVE:** Item is defective, will be written off as loss
 * 
 * @param line - Return line item details
 * @param line.return_id - UUID of parent return transaction
 * @param line.line_number - Sequential line number (1, 2, 3...)
 * @param line.original_line_id - Optional UUID of original POS line
 * @param line.product_variant_id - UUID of product variant being returned
 * @param line.qty_returned - Quantity being returned
 * @param line.unit_price - Price to refund (typically matches original price)
 * @param line.condition - Condition of returned item
 * @param line.return_reason - Reason for this specific item
 * 
 * @throws {Error} If return quantity exceeds original sale quantity
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created return line
 * 
 * @example
 * ```typescript
 * // Return resellable item (will go back to inventory)
 * await addReturnLine({
 *   return_id: returnId,
 *   line_number: 1,
 *   original_line_id: originalLineId,
 *   product_variant_id: variantId,
 *   qty_returned: 2,
 *   unit_price: 100,
 *   condition: 'RESELLABLE',
 *   return_reason: 'WRONG_SIZE'
 * });
 * 
 * // Return damaged item (will be written off)
 * await addReturnLine({
 *   return_id: returnId,
 *   line_number: 2,
 *   product_variant_id: variantId,
 *   qty_returned: 1,
 *   unit_price: 100,
 *   condition: 'DAMAGED',
 *   return_reason: 'DAMAGED',
 *   notes: 'Torn during shipping'
 * });
 * ```
 * 
 * @see {@link createPOSReturn} for creating return header
 */
export async function addReturnLine(line: POSReturnLine): Promise<POSReturnLine> {
    const { data, error } = await supabaseServer
        .from('sales_pos_return_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Approves a POS return for processing.
 * 
 * Approval workflow ensures manager authorization before refunding
 * customer and updating inventory. Only approved returns can be posted.
 * 
 * @param returnId - UUID of return to approve
 * @param userId - UUID of approver (typically manager)
 * 
 * @throws {Error} If return already approved
 * @throws {Error} If update fails
 * @returns Promise that resolves when approved
 * 
 * @example
 * ```typescript
 * // Manager reviews return
 * const returnDetails = await getPOSReturn(returnId);
 * 
 * if (returnDetails.total_amount > 1000) {
 *   console.log('Large return - verify reason');
 * }
 * 
 * // Approve
 * await approvePOSReturn(returnId, managerId);
 * 
 * // Now can post
 * await postPOSReturn(returnId, userId);
 * ```
 * 
 * @see {@link postPOSReturn} for posting after approval
 */
export async function approvePOSReturn(returnId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('sales_pos_returns')
        .update({
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: userId,
        })
        .eq('id', returnId);

    if (error) throw error;
}

/**
 * Posts a POS return to inventory and general ledger.
 * 
 * **This function calls the database RPC `post_pos_return` which:**
 * 1. Receives resellable items back into finished goods inventory
 * 2. Writes off damaged/defective items as loss
 * 3. Creates journal entries:
 *    - DR Sales Return (contra-revenue)
 *    - CR Cash/Bank (refund to customer)
 *    - DR Finished Goods Inventory (if resellable)
 *    - CR Cost of Goods Sold (reverse COGS)
 *    - DR Loss (if damaged)
 * 4. Updates return status to 'posted'
 * 
 * **Important:** Must be approved before posting.
 * 
 * @param returnId - UUID of return to post
 * @param userId - UUID of user posting the return
 * 
 * @throws {Error} If return not approved
 * @throws {Error} If period is closed
 * @throws {Error} If database RPC fails
 * @returns Promise that resolves when posting complete
 * 
 * @example
 * ```typescript
 * try {
 *   await postPOSReturn(returnId, userId);
 *   console.log('Return processed - inventory updated, refund issued');
 * } catch (error) {
 *   if (error.message.includes('not approved')) {
 *     alert('Return must be approved first');
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Complete return workflow
 * const returnTxn = await createPOSReturn({...}, userId);
 * 
 * await addReturnLine({
 *   return_id: returnTxn.id,
 *   qty_returned: 2,
 *   condition: 'RESELLABLE'
 * });
 * 
 * await approvePOSReturn(returnTxn.id, managerId);
 * await postPOSReturn(returnTxn.id, userId);
 * 
 * // Result:
 * // - Inventory +2 (back in stock)
 * // - Cash -200 (refunded)
 * // - Sales Return +200 (contra-revenue)
 * // - COGS -120 (reversed)
 * ```
 * 
 * @see {@link createPOSReturn} for creating returns
 * @see {@link approvePOSReturn} for approval step
 */
export async function postPOSReturn(returnId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('post_pos_return', {
        p_return_id: returnId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves a POS return with all details.
 * 
 * @param returnId - UUID of the return
 * @throws {Error} If return not found
 * @returns Promise resolving to return with nested relationships
 * 
 * @example
 * ```typescript
 * const posReturn = await getPOSReturn(returnId);
 * 
 * console.log(`Return ${posReturn.return_number}`);
 * console.log(`Original Sale: ${posReturn.original_pos.pos_number}`);
 * console.log(`Reason: ${posReturn.return_reason}`);
 * console.log(`Refund: $${posReturn.total_amount}`);
 * 
 * posReturn.lines.forEach(line => {
 *   console.log(`  ${line.variant.sku}: ${line.qty_returned} (${line.condition})`);
 * });
 * ```
 */
export async function getPOSReturn(returnId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('sales_pos_returns')
        .select(`
      *,
      original_pos:sales_pos(*),
      warehouse:warehouses(*),
      lines:sales_pos_return_lines(*, variant:product_variants(*, product:products(*)))
    `)
        .eq('id', returnId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves return summary by reason and date range.
 * 
 * Uses the `pos_return_summary_vw` view for aggregated return analytics.
 * Shows return counts, refund totals, and item conditions.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * 
 * @returns Promise resolving to return summary
 * @returns summary.return_reason - Reason for returns
 * @returns summary.return_count - Number of return transactions
 * @returns summary.total_refunded - Total amount refunded
 * @returns summary.resellable_items - Count of resellable items
 * @returns summary.damaged_items - Count of damaged/defective items
 * 
 * @example
 * ```typescript
 * const summary = await getReturnSummary(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 * 
 * console.log('Return Analysis:');
 * summary.forEach(r => {
 *   console.log(`${r.return_reason}:`);
 *   console.log(`  Count: ${r.return_count}`);
 *   console.log(`  Refunded: $${r.total_refunded}`);
 *   console.log(`  Resellable: ${r.resellable_items}`);
 *   console.log(`  Damaged: ${r.damaged_items}`);
 *   
 *   const damageRate = (r.damaged_items / (r.resellable_items + r.damaged_items) * 100).toFixed(1);
 *   console.log(`  Damage Rate: ${damageRate}%`);
 * });
 * ```
 */
export async function getReturnSummary(
    companyId: string,
    startDate: string,
    endDate: string
): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('pos_return_summary_vw')
        .select('*')
        .eq('company_id', companyId)
        .gte('return_date', startDate)
        .lte('return_date', endDate);

    if (error) throw error;
    return data || [];
}

/**
 * Calculates return rate (returns as % of sales).
 * 
 * Uses the `pos_return_rate_vw` view which compares daily returns
 * to daily sales. High return rates may indicate product quality issues.
 * 
 * @param companyId - UUID of the company
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * 
 * @returns Promise resolving to return rate data
 * @returns rate.txn_date - Transaction date
 * @returns rate.total_sales - Total sales amount
 * @returns rate.total_returns - Total return amount
 * @returns rate.return_rate_pct - Return rate as percentage
 * 
 * @example
 * ```typescript
 * const rates = await getReturnRate(
 *   companyId,
 *   '2025-01-01',
 *   '2025-01-31'
 * );
 * 
 * // Find high return rate days
 * const highRates = rates.filter(r => r.return_rate_pct > 10);
 * 
 * if (highRates.length > 0) {
 *   console.log('⚠️  High return rate days:');
 *   highRates.forEach(r => {
 *     console.log(`  ${r.txn_date}: ${r.return_rate_pct}%`);
 *   });
 * }
 * 
 * // Calculate average return rate
 * const avgRate = rates.reduce((sum, r) => sum + r.return_rate_pct, 0) / rates.length;
 * console.log(`Average return rate: ${avgRate.toFixed(2)}%`);
 * ```
 */
export async function getReturnRate(
    companyId: string,
    startDate: string,
    endDate: string
): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('pos_return_rate_vw')
        .select('*')
        .eq('company_id', companyId)
        .gte('txn_date', startDate)
        .lte('txn_date', endDate)
        .order('txn_date', { ascending: false });

    if (error) throw error;
    return data || [];
}
