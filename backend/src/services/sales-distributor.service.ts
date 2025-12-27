/**
 * Sales Distributor Service
 * Order-to-Cash (O2C) Workflow for Credit Sales
 * 
 * **Complete O2C Cycle:**
 * 1. Sales Order (SO) → Quote customer, credit check
 * 2. Delivery Note (DO) → Ship goods, issue inventory
 * 3. Sales Invoice → Bill customer, create AR
 * 4. AR Payment → Receive payment, settle AR
 * 
 * **vs POS Sales:**
 * - POS: Cash sale, instant delivery
 * - Distributor: Credit terms, delivery note, invoice separately
 * 
 * Handles distributor/wholesale sales with credit management,
 * delivery tracking, invoicing, and accounts receivable.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

// ==================== TYPES ====================

export interface SalesOrder {
    id?: string;
    company_id: string;
    so_number: string;
    so_date: string;
    customer_id: string;
    warehouse_id: string;
    period_id: string;
    discount_amount?: number;
    tax_amount?: number;
    payment_terms?: string;
    delivery_date?: string;
    delivery_address?: string;
    notes?: string;
}

export interface SOLine {
    id?: string;
    so_id: string;
    line_number: number;
    product_variant_id: string;
    qty_ordered: number;
    unit_price: number;
    discount_percentage?: number;
    notes?: string;
}

// ==================== SALES ORDERS ====================

/**
 * Creates a sales order for distributor/wholesale credit sales.
 * 
 * Sales orders represent customer commitments to purchase.
 * They include pricing, quantities, credit terms, and delivery details.
 * 
 * **Workflow:**
 * 1. Create SO (this function) → Draft status
 * 2. Add lines with {@link addSOLine}
 * 3. Approve with {@link approveSalesOrder} → Credit check
 * 4. Create delivery note → Ship goods
 * 5. Create invoice → Bill customer
 * 
 * **Credit Terms:**
 * - COD (Cash on Delivery): Payment on delivery
 * - Net 14: Payment due 14 days after invoice
 * - Net 30: Payment due 30 days (most common)
 * - Net 60: Payment due 60 days
 * 
 * @param so - Sales order details
 * @param so.company_id - UUID of the company
 * @param so.so_number - Unique SO number (e.g., 'SO-2025-001')
 * @param so.so_date - Order date
 * @param so.customer_id - UUID of customer
 * @param so.warehouse_id - UUID of warehouse for fulfillment
 * @param so.period_id - UUID of accounting period (must be open)
 * @param so.payment_terms - Payment terms (COD, Net 14, Net 30, Net 60)
 * @param so.delivery_date - Planned delivery date
 * @param so.delivery_address - Customer delivery address
 * @param userId - UUID of user creating SO
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created sales order
 * 
 * @example
 * ```typescript
 * // Create sales order for distributor
 * const so = await createSalesOrder({
 *   company_id: companyId,
 *   so_number: 'SO-2025-001',
 *   so_date: '2025-01-15',
 *   customer_id: distributorId,
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   payment_terms: 'Net 30',
 *   delivery_date: '2025-01-20',
 *   delivery_address: 'Jl. Distributor No. 123, Jakarta'
 * }, userId);
 * 
 * // Add items
 * await addSOLine({
 *   so_id: so.id,
 *   line_number: 1,
 *   product_variant_id: variantId,
 *   qty_ordered: 100,
 *   unit_price: 50000
 * });
 * 
 * // Approve (credit check happens here)
 * await approveSalesOrder(so.id, managerId);
 * ```
 * 
 * @see {@link addSOLine} for adding line items
 * @see {@link approveSalesOrder} for approval with credit check
 */
export async function createSalesOrder(so: SalesOrder, userId: string): Promise<SalesOrder> {
    await validatePeriodIsOpen(so.period_id);

    const { data, error } = await supabaseServer
        .from('sales_orders')
        .insert({ ...so, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to a sales order.
 * 
 * Each line represents one product variant with quantity and price.
 * Line-level discounts supported as percentage.
 * 
 * @param line - SO line item details
 * @param line.so_id - UUID of parent sales order
 * @param line.line_number - Sequential line number (1, 2, 3...)
 * @param line.product_variant_id - UUID of product variant (SKU)
 * @param line.qty_ordered - Quantity ordered
 * @param line.unit_price - Price per unit
 * @param line.discount_percentage - Optional line-level discount (0-100)
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Add product with volume discount
 * await addSOLine({
 *   so_id: soId,
 *   line_number: 1,
 *   product_variant_id: variantId,
 *   qty_ordered: 100,
 *   unit_price: 50000,
 *   discount_percentage: 10  // 10% bulk discount
 * });
 * // Line total: 100 × 50,000 × 0.9 = 4,500,000
 * ```
 * 
 * @see {@link createSalesOrder} for creating parent SO
 */
export async function addSOLine(line: SOLine): Promise<SOLine> {
    const { data, error } = await supabaseServer
        .from('sales_order_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Approves a sales order with automatic credit limit validation.
 * 
 * **Approval Process:**
 * 1. Validates SO is in draft status
 * 2. **Checks customer credit limit** (blocks if exceeded)
 * 3. Checks for credit hold
 * 4. Changes status to 'approved'
 * 5. Records approval timestamp and approver
 * 
 * **Credit Check:**
 * Calculates: Current AR + Pending SOs + This Order
 * Compares to customer's credit limit
 * 
 * @param soId - UUID of sales order to approve
 * @param userId - UUID of approver
 * @param overrideCredit - Optional: bypass credit check (requires authorization)
 * 
 * @throws {Error} If SO not in draft status
 * @throws {Error} If customer on credit hold
 * @throws {Error} If credit limit exceeded (unless override)
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when approved
 * 
 * @example
 * ```typescript
 * try {
 *   await approveSalesOrder(soId, managerId);
 *   console.log('✅ SO approved - credit check passed');
 * } catch (error) {
 *   if (error.message.includes('Credit limit exceeded')) {
 *     const creditInfo = await checkCreditLimit(customerId, soAmount);
 *     console.log(`❌ Credit exceeded:`);
 *     console.log(`   Limit: ${creditInfo.credit_limit}`);
 *     console.log(`   Current AR: ${creditInfo.current_ar_balance}`);
 *     console.log(`   This order: ${soAmount}`);
 *     console.log(`   Available: ${creditInfo.available_credit}`);
 *     
 *     // Manager can override
 *     const override = confirm('Override credit limit?');
 *     if (override) {
 *       await approveSalesOrder(soId, managerId, true);
 *     }
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Normal approval with credit check
 * await approveSalesOrder(soId, managerId);
 * 
 * // Override credit limit (requires senior approval)
 * await approveSalesOrder(soId, seniorManagerId, true);
 * ```
 * 
 * @see {@link checkCreditLimit} for pre-checking credit
 * @see {@link getCustomerCreditStatus} for credit status
 */
export async function approveSalesOrder(
    soId: string,
    userId: string,
    overrideCredit: boolean = false
): Promise<void> {
    const { error } = await supabaseServer.rpc('approve_sales_order', {
        p_so_id: soId,
        p_user_id: userId,
        p_override_credit: overrideCredit,
    });

    if (error) throw error;
}

/**
 * Retrieves a sales order with all related details.
 * 
 * @param soId - UUID of the sales order
 * @throws {Error} If SO not found
 * @returns Promise resolving to SO with nested relationships
 * 
 * @example
 * ```typescript
 * const so = await getSalesOrder(soId);
 * 
 * console.log(`SO: ${so.so_number}`);
 * console.log(`Customer: ${so.customer.name}`);
 * console.log(`Total: ${so.total_amount}`);
 * console.log(`Status: ${so.status}`);
 * console.log(`Payment Terms: ${so.payment_terms}`);
 * console.log(`Due: ${so.due_date}`);
 * 
 * console.log('\nLine Items:');
 * so.lines.forEach(line => {
 *   console.log(`  ${line.variant.sku}: ${line.qty_ordered} @ ${line.unit_price}`);
 *   console.log(`    Delivered: ${line.qty_delivered}/${line.qty_ordered}`);
 * });
 * ```
 */
export async function getSalesOrder(soId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('sales_orders')
        .select(`
      *,
      customer:customers(*),
      warehouse:warehouses(*),
      lines:sales_order_lines(*, variant:product_variants(*, product:products(*)))
    `)
        .eq('id', soId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all sales orders with optional status filter.
 * 
 * @param companyId - UUID of the company
 * @param status - Optional status filter (draft/approved/sent/in_delivery/completed/cancelled)
 * 
 * @returns Promise resolving to array of sales orders
 * 
 * @example
 * ```typescript
 * // Get all approved SOs pending delivery
 * const pendingDelivery = await getAllSalesOrders(companyId, 'approved');
 * 
 * // Get all SOs
 * const allSOs = await getAllSalesOrders(companyId);
 * ```
 */
export async function getAllSalesOrders(
    companyId: string,
    status?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('sales_order_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('so_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Updates a sales order line.
 * 
 * **Important:** Can only update lines on draft SOs.
 * Approved SOs are locked.
 * 
 * @param lineId - UUID of the line to update
 * @param updates - Fields to update
 * 
 * @throws {Error} If line not found
 * @throws {Error} If SO already approved
 * @throws {Error} If update fails
 * @returns Promise that resolves when updated
 * 
 * @example
 * ```typescript
 * // Customer changes quantity
 * await updateSOLine(lineId, {
 *   qty_ordered: 150,  // Changed from 100
 *   notes: 'Increased quantity per customer request'
 * });
 * ```
 */
export async function updateSOLine(lineId: string, updates: Partial<SOLine>): Promise<void> {
    const { error } = await supabaseServer
        .from('sales_order_lines')
        .update(updates)
        .eq('id', lineId);

    if (error) throw error;
}

/**
 * Cancels a sales order.
 * 
 * **Important:** Can only cancel draft or approved SOs.
 * Cannot cancel if delivery has started.
 * 
 * @param soId - UUID of SO to cancel
 * @param reason - Cancellation reason
 * 
 * @throws {Error} If SO cannot be cancelled
 * @throws {Error} If update fails
 * @returns Promise that resolves when cancelled
 * 
 * @example
 * ```typescript
 * await cancelSalesOrder(soId, 'Customer cancelled order - found better price elsewhere');
 * ```
 */
export async function cancelSalesOrder(soId: string, reason: string): Promise<void> {
    const { error } = await supabaseServer
        .from('sales_orders')
        .update({
            status: 'cancelled',
            notes: `CANCELLED: ${reason}`,
        })
        .eq('id', soId)
        .in('status', ['draft', 'approved']);  // Can only cancel these statuses

    if (error) throw error;
}

// ==================== CREDIT MANAGEMENT ====================

/**
 * Checks customer credit limit availability.
 * 
 * Calculates available credit by considering:
 * - Customer's credit limit
 * - Current AR balance (unpaid invoices)
 * - Pending sales orders (approved but not invoiced)
 * - Proposed new order amount
 * 
 * @param customerId - UUID of customer
 * @param orderAmount - Amount of new order to check
 * 
 * @returns Promise resolving to credit check results
 * @returns result.credit_limit - Customer's credit limit
 * @returns result.current_ar_balance - Current AR + pending SOs
 * @returns result.available_credit - Credit limit - current balance
 * @returns result.new_total - What balance would be after this order
 * @returns result.credit_exceeded - Boolean: would this order exceed limit?
 * @returns result.credit_hold - Is customer on credit hold?
 * 
 * @example
 * ```typescript
 * // Before creating large SO, check credit
 * const check = await checkCreditLimit(customerId, 5000000);
 * 
 * console.log(`Credit Limit: ${check.credit_limit.toLocaleString()}`);
 * console.log(`Current AR: ${check.current_ar_balance.toLocaleString()}`);
 * console.log(`Available: ${check.available_credit.toLocaleString()}`);
 * 
 * if (check.credit_hold) {
 *   alert('❌ Customer is on credit hold - cannot create SO');
 * } else if (check.credit_exceeded) {
 *   alert(`❌ Order would exceed credit limit by ${
 *     (check.new_total - check.credit_limit).toLocaleString()
 *   }`);
 * } else {
 *   const so = await createSalesOrder({...});
 *   console.log('✅ Credit check passed');
 * }
 * ```
 * 
 * @see {@link getCustomerCreditStatus} for overall credit status
 */
export async function checkCreditLimit(
    customerId: string,
    orderAmount: number
): Promise<any> {
    const { data, error } = await supabaseServer.rpc('check_customer_credit_limit', {
        p_customer_id: customerId,
        p_new_order_amount: orderAmount,
    });

    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
}

/**
 * Retrieves customer credit status with AR balance.
 * 
 * Shows comprehensive credit information from the
 * `customer_credit_status_vw` materialized view.
 * 
 * @param customerId - UUID of customer
 * @returns Promise resolving to credit status
 * @returns status.credit_limit - Credit limit amount
 * @returns status.current_ar_balance - Unpaid invoice amount
 * @returns status.pending_so_amount - Approved SOs not yet invoiced
 * @returns status.available_credit - Remaining credit
 * @returns status.credit_status - Status: Good/Near Limit/Exceeded/On Hold
 * 
 * @example
 * ```typescript
 * const status = await getCustomerCreditStatus(customerId);
 * 
 * console.log(`Customer: ${status.customer_name}`);
 * console.log(`Credit Limit: ${status.credit_limit.toLocaleString()}`);
 * console.log(`Current AR: ${status.current_ar_balance.toLocaleString()}`);
 * console.log(`Pending SOs: ${status.pending_so_amount.toLocaleString()}`);
 * console.log(`Available: ${status.available_credit.toLocaleString()}`);
 * console.log(`Status: ${status.credit_status}`);
 * 
 * if (status.credit_status === 'Near Limit') {
 *   console.log('⚠️  Customer approaching credit limit');
 * } else if (status.credit_status === 'Exceeded') {
 *   console.log('❌ Customer has exceeded credit limit');
 * } else if (status.credit_status === 'On Hold') {
 *   console.log('🛑 Customer is on credit hold');
 * }
 * ```
 */
export async function getCustomerCreditStatus(customerId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('customer_credit_status_vw')
        .select('*')
        .eq('customer_id', customerId)
        .single();

    if (error) throw error;
    return data;
}

// ==================== DELIVERY NOTES ====================

export interface DeliveryNote {
    id?: string;
    company_id: string;
    do_number: string;
    do_date: string;
    so_id?: string;
    customer_id: string;
    warehouse_id: string;
    period_id: string;
    delivery_address?: string;
    delivered_by?: string;
    vehicle_number?: string;
    notes?: string;
}

export interface DOLine {
    id?: string;
    do_id: string;
    line_number: number;
    so_line_id?: string;
    product_variant_id: string;
    qty_delivered: number;
    notes?: string;
}

/**
 * Creates a delivery note for shipping goods to customer.
 * 
 * **Delivery Note Purpose:**
 * - Proof of goods shipped
 * - Triggers inventory issuance
 * - Posts COGS (Cost of Goods Sold)
 * - Updates SO delivery status
 * 
 * **Workflow:**
 * 1. Create DO (this function) → Draft status
 * 2. Add lines with {@link addDOLine} or use {@link createDOFromSO}
 * 3. Confirm with {@link confirmDelivery} → Issues inventory, posts COGS
 * 4. DO status: draft → sent
 * 5. Customer confirms receipt → Status: received
 * 
 * @param deliveryNote - Delivery note details
 * @param deliveryNote.company_id - UUID of the company
 * @param deliveryNote.do_number - Unique DO number (e.g., 'DO-2025-001')
 * @param deliveryNote.do_date - Delivery date
 * @param deliveryNote.so_id - Optional UUID of originating sales order
 * @param deliveryNote.customer_id - UUID of customer
 * @param deliveryNote.warehouse_id - UUID of warehouse shipping from
 * @param deliveryNote.period_id - UUID of accounting period (must be open)
 * @param deliveryNote.delivery_address - Customer delivery address
 * @param deliveryNote.delivered_by - Driver/courier name
 * @param deliveryNote.vehicle_number - Vehicle number
 * @param userId - UUID of user creating DO
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created delivery note
 * 
 * @example
 * ```typescript
 * // Create delivery note from approved SO
 * const dn = await createDeliveryNote({
 *   company_id: companyId,
 *   do_number: 'DO-2025-001',
 *   do_date: '2025-01-20',
 *   so_id: soId,
 *   customer_id: customerId,
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   delivery_address: 'Jl. Customer No. 456',
 *   delivered_by: 'Ahmad (Driver)',
 *   vehicle_number: 'B 1234 XYZ'
 * }, userId);
 * 
 * // Add items to deliver
 * await addDOLine({
 *   do_id: dn.id,
 *   line_number: 1,
 *   so_line_id: soLineId,
 *   product_variant_id: variantId,
 *   qty_delivered: 100
 * });
 * 
 * // Confirm delivery (issues inventory)
 * await confirmDelivery(dn.id, userId);
 * ```
 * 
 * @see {@link addDOLine} for adding line items
 * @see {@link createDOFromSO} for auto-creating from SO
 * @see {@link confirmDelivery} for confirmation
 */
export async function createDeliveryNote(
    deliveryNote: DeliveryNote,
    userId: string
): Promise<DeliveryNote> {
    await validatePeriodIsOpen(deliveryNote.period_id);

    const { data, error } = await supabaseServer
        .from('delivery_notes')
        .insert({ ...deliveryNote, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to a delivery note.
 * 
 * Each line represents one product variant with quantity delivered.
 * Links to SO line for tracking partial deliveries.
 * 
 * @param line - DO line item details
 * @param line.do_id - UUID of parent delivery note
 * @param line.line_number - Sequential line number (1, 2, 3...)
 * @param line.so_line_id - Optional UUID of originating SO line
 * @param line.product_variant_id - UUID of product variant being delivered
 * @param line.qty_delivered - Quantity being delivered
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Partial delivery (50 out of 100 ordered)
 * await addDOLine({
 *   do_id: doId,
 *   line_number: 1,
 *   so_line_id: soLineId,
 *   product_variant_id: variantId,
 *   qty_delivered: 50,
 *   notes: 'Partial delivery - remaining 50 to follow'
 * });
 * ```
 * 
 * @see {@link createDeliveryNote} for creating parent DO
 */
export async function addDOLine(line: DOLine): Promise<DOLine> {
    const { data, error } = await supabaseServer
        .from('delivery_note_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Auto-creates a delivery note from a sales order.
 * 
 * **Convenience function** that:
 * 1. Creates DO header from SO details
 * 2. Copies SO lines as DO lines
 * 3. Supports partial delivery (can specify qty < ordered)
 * 4. Links DO lines to SO lines for tracking
 * 
 * **Partial Delivery:**
 * Can deliver less than ordered quantity. Remaining qty
 * can be delivered via subsequent DOs.
 * 
 * @param soId - UUID of sales order to deliver from
 * @param lines - Array of lines to deliver with quantities
 * @param userId - UUID of user creating DO
 * 
 * @throws {Error} If SO not found or not approved
 * @throws {Error} If requested qty exceeds pending qty
 * @throws {Error} If database operations fail
 * @returns Promise resolving to created delivery note with lines
 * 
 * @example
 * ```typescript
 * // Full delivery of entire SO
 * const so = await getSalesOrder(soId);
 * const fullDelivery = so.lines.map(line => ({
 *   so_line_id: line.id,
 *   product_variant_id: line.product_variant_id,
 *   qty_delivered: line.qty_ordered - line.qty_delivered
 * }));
 * 
 * const dn = await createDOFromSO(soId, fullDelivery, userId);
 * 
 * // Partial delivery (only some items)
 * const partialDelivery = [
 *   {
 *     so_line_id: soLine1Id,
 *     product_variant_id: variant1Id,
 *     qty_delivered: 50  // Only 50 out of 100 ordered
 *   }
 * ];
 * 
 * const partialDN = await createDOFromSO(soId, partialDelivery, userId);
 * 
 * // Confirm delivery to issue inventory
 * await confirmDelivery(dn.id, userId);
 * ```
 * 
 * @see {@link confirmDelivery} for confirming delivery
 */
export async function createDOFromSO(
    soId: string,
    lines: Array<{
        so_line_id: string;
        product_variant_id: string;
        qty_delivered: number;
    }>,
    userId: string
): Promise<any> {
    // Get SO details
    const so = await getSalesOrder(soId);

    if (!so) {
        throw new Error('Sales order not found');
    }

    if (so.status === 'draft') {
        throw new Error('Sales order must be approved before creating delivery note');
    }

    // Generate DO number (simple increment - production should use sequence)
    const doNumber = `DO-${Date.now()}`;

    // Create DO header
    const dn = await createDeliveryNote(
        {
            company_id: so.company_id,
            do_number: doNumber,
            do_date: new Date().toISOString().split('T')[0],
            so_id: soId,
            customer_id: so.customer_id,
            warehouse_id: so.warehouse_id,
            period_id: so.period_id,
            delivery_address: so.delivery_address,
        },
        userId
    );

    // Add DO lines
    for (let i = 0; i < lines.length; i++) {
        await addDOLine({
            do_id: dn.id!,
            line_number: i + 1,
            so_line_id: lines[i].so_line_id,
            product_variant_id: lines[i].product_variant_id,
            qty_delivered: lines[i].qty_delivered,
        });
    }

    return getDeliveryNote(dn.id!);
}

/**
 * Confirms delivery and processes inventory issuance.
 * 
 * **This function calls the database RPC `confirm_delivery` which:**
 * 1. Validates DO is in draft status
 * 2. **Issues finished goods inventory** (reduces qty)
 * 3. **Posts COGS** (Dr. COGS / Cr. FG Inventory)
 * 4. Updates SO line qty_delivered
 * 5. Updates SO status (in_delivery / completed)
 * 6. Changes DO status to 'sent'
 * 
 * **Important:** This is irreversible. Inventory is immediately deducted.
 * 
 * @param doId - UUID of delivery note to confirm
 * @param userId - UUID of user confirming
 * 
 * @throws {Error} If DO not in draft status
 * @throws {Error} If insufficient inventory
 * @throws {Error} If period is closed
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when confirmed
 * 
 * @example
 * ```typescript
 * try {
 *   await confirmDelivery(doId, userId);
 *   console.log('✅ Delivery confirmed');
 *   console.log('   - Inventory issued');
 *   console.log('   - COGS posted');
 *   console.log('   - SO updated');
 * } catch (error) {
 *   if (error.message.includes('Insufficient stock')) {
 *     alert('Cannot deliver - out of stock!');
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Complete delivery workflow
 * const dn = await createDOFromSO(soId, lines, userId);
 * 
 * // Review before confirming
 * const dnDetails = await getDeliveryNote(dn.id);
 * console.log(`Delivering ${dnDetails.lines.length} items`);
 * 
 * // Confirm (issues inventory)
 * await confirmDelivery(dn.id, userId);
 * 
 * // Check SO status
 * const so = await getSalesOrder(soId);
 * console.log(`SO Status: ${so.status}`);  // 'completed' if all delivered
 * ```
 * 
 * @see {@link createDOFromSO} for creating DO
 */
export async function confirmDelivery(doId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('confirm_delivery', {
        p_do_id: doId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves a delivery note with all related details.
 * 
 * @param doId - UUID of the delivery note
 * @throws {Error} If DO not found
 * @returns Promise resolving to DO with nested relationships
 * 
 * @example
 * ```typescript
 * const dn = await getDeliveryNote(doId);
 * 
 * console.log(`DO: ${dn.do_number}`);
 * console.log(`Customer: ${dn.customer.name}`);
 * console.log(`Status: ${dn.status}`);
 * console.log(`Delivered by: ${dn.delivered_by}`);
 * console.log(`Vehicle: ${dn.vehicle_number}`);
 * 
 * console.log('\nItems Delivered:');
 * dn.lines.forEach(line => {
 *   console.log(`  ${line.variant.sku}: ${line.qty_delivered}`);
 * });
 * ```
 */
export async function getDeliveryNote(doId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('delivery_notes')
        .select(`
      *,
      so:sales_orders(*),
      customer:customers(*),
      warehouse:warehouses(*),
      lines:delivery_note_lines(*, variant:product_variants(*, product:products(*)))
    `)
        .eq('id', doId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all delivery notes with optional status filter.
 * 
 * @param companyId - UUID of the company
 * @param status - Optional status filter (draft/sent/received/cancelled)
 * 
 * @returns Promise resolving to array of delivery notes
 * 
 * @example
 * ```typescript
 * // Get all pending confirmations
 * const pending = await getAllDeliveryNotes(companyId, 'draft');
 * 
 * // Get all DNs
 * const allDNs = await getAllDeliveryNotes(companyId);
 * ```
 */
export async function getAllDeliveryNotes(
    companyId: string,
    status?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('delivery_note_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('do_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ==================== SALES INVOICES ====================

export interface SalesInvoice {
    id?: string;
    company_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    so_id?: string;
    do_id?: string;
    customer_id: string;
    period_id: string;
    discount_amount?: number;
    tax_amount?: number;
    payment_terms?: string;
    notes?: string;
}

export interface InvoiceLine {
    id?: string;
    invoice_id: string;
    line_number: number;
    so_line_id?: string;
    do_line_id?: string;
    product_variant_id: string;
    qty_invoiced: number;
    unit_price: number;
    discount_percentage?: number;
    notes?: string;
}

/**
 * Creates a sales invoice for credit sales.
 * 
 * **Invoice Purpose:**
 * - Bill customer for delivered goods
 * - Create Accounts Receivable (AR)
 * - Recognize revenue
 * - Track payment due date
 * 
 * **Workflow:**
 * 1. Create invoice (this function) → Draft status
 * 2. Add lines with {@link addInvoiceLine}
 * 3. Post with {@link postSalesInvoice} → Creates AR
 * 4. Customer pays → See AR Payments module
 * 
 * @param invoice - Sales invoice details
 * @param invoice.company_id - UUID of the company
 * @param invoice.invoice_number - Unique invoice number (e.g., 'INV-2025-001')
 * @param invoice.invoice_date - Invoice date
 * @param invoice.due_date - Payment due date
 * @param invoice.so_id - Optional UUID of originating sales order
 * @param invoice.do_id - Optional UUID of delivery note
 * @param invoice.customer_id - UUID of customer
 * @param invoice.period_id - UUID of accounting period (must be open)
 * @param invoice.payment_terms - Payment terms (Net 14/30/60)
 * @param userId - UUID of user creating invoice
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created invoice
 * 
 * @example
 * ```typescript
 * // Create invoice from delivery note
 * const invoice = await createSalesInvoice({
 *   company_id: companyId,
 *   invoice_number: 'INV-2025-001',
 *   invoice_date: '2025-01-21',
 *   due_date: '2025-02-20',  // Net 30
 *   do_id: doId,
 *   customer_id: customerId,
 *   period_id: periodId,
 *   payment_terms: 'Net 30',
 *   tax_amount: 450000  // 10% PPN
 * }, userId);
 * 
 * // Add invoice lines
 * await addInvoiceLine({
 *   invoice_id: invoice.id,
 *   line_number: 1,
 *   do_line_id: doLineId,
 *   product_variant_id: variantId,
 *   qty_invoiced: 100,
 *   unit_price: 50000
 * });
 * 
 * // Post to create AR
 * await postSalesInvoice(invoice.id, userId);
 * ```
 * 
 * @see {@link addInvoiceLine} for adding line items
 * @see {@link postSalesInvoice} for posting to AR
 */
export async function createSalesInvoice(
    invoice: SalesInvoice,
    userId: string
): Promise<SalesInvoice> {
    await validatePeriodIsOpen(invoice.period_id);

    const { data, error } = await supabaseServer
        .from('sales_invoices')
        .insert({ ...invoice, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to a sales invoice.
 * 
 * @param line - Invoice line item details
 * @param line.invoice_id - UUID of parent invoice
 * @param line.line_number - Sequential line number (1, 2, 3...)
 * @param line.so_line_id - Optional UUID of originating SO line
 * @param line.do_line_id - Optional UUID of DO line
 * @param line.product_variant_id - UUID of product variant
 * @param line.qty_invoiced - Quantity being invoiced
 * @param line.unit_price - Price per unit
 * @param line.discount_percentage - Optional line discount
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * await addInvoiceLine({
 *   invoice_id: invoiceId,
 *   line_number: 1,
 *   do_line_id: doLineId,
 *   product_variant_id: variantId,
 *   qty_invoiced: 100,
 *   unit_price: 50000
 * });
 * ```
 * 
 * @see {@link createSalesInvoice} for creating parent invoice
 */
export async function addInvoiceLine(line: InvoiceLine): Promise<InvoiceLine> {
    const { data, error } = await supabaseServer
        .from('sales_invoice_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Posts a sales invoice to create Accounts Receivable.
 * 
 * **This function calls the database RPC `post_sales_invoice` which:**
 * 1. Validates invoice is in draft status
 * 2. **Creates AR liability** (customer owes money)
 * 3. Creates journal entries:
 *    - DR Accounts Receivable (total)
 *    - CR Sales Revenue (subtotal)
 *    - CR Sales Tax Payable (tax)
 * 4. Updates SO line qty_invoiced
 * 5. Changes invoice status to 'posted'
 * 
 * **Important:** This is irreversible. Use {@link voidInvoice} to cancel.
 * 
 * @param invoiceId - UUID of invoice to post
 * @param userId - UUID of user posting
 * 
 * @throws {Error} If invoice not in draft status
 * @throws {Error} If period is closed
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when posted
 * 
 * @example
 * ```typescript
 * try {
 *   await postSalesInvoice(invoiceId, userId);
 *   console.log('✅ Invoice posted');
 *   console.log('   - AR created');
 *   console.log('   - Revenue recognized');
 *   console.log('   - Customer can now pay');
 * } catch (error) {
 *   console.error('Failed to post invoice:', error.message);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Complete invoicing workflow
 * const invoice = await createSalesInvoice({...});
 * await addInvoiceLine({...});
 * 
 * // Post to AR
 * await postSalesInvoice(invoice.id, userId);
 * 
 * // Check AR aging
 * const aging = await getARAging(companyId);
 * console.log(`Total AR: ${aging.reduce((sum, inv) => sum + inv.amount_due, 0)}`);
 * ```
 * 
 * @see {@link createSalesInvoice} for creating invoice
 * @see {@link voidInvoice} for cancelling posted invoice
 */
export async function postSalesInvoice(invoiceId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('post_sales_invoice', {
        p_invoice_id: invoiceId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves a sales invoice with all related details.
 * 
 * @param invoiceId - UUID of the invoice
 * @throws {Error} If invoice not found
 * @returns Promise resolving to invoice with nested relationships
 * 
 * @example
 * ```typescript
 * const invoice = await getSalesInvoice(invoiceId);
 * 
 * console.log(`Invoice: ${invoice.invoice_number}`);
 * console.log(`Customer: ${invoice.customer.name}`);
 * console.log(`Total: ${invoice.total_amount.toLocaleString()}`);
 * console.log(`Due: ${invoice.due_date}`);
 * console.log(`Status: ${invoice.payment_status}`);
 * console.log(`Amount Due: ${invoice.amount_due.toLocaleString()}`);
 * 
 * console.log('\nLine Items:');
 * invoice.lines.forEach(line => {
 *   console.log(`  ${line.variant.sku}: ${line.qty_invoiced} × ${line.unit_price}`);
 * });
 * ```
 */
export async function getSalesInvoice(invoiceId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('sales_invoices')
        .select(`
      *,
      customer:customers(*),
      so:sales_orders(*),
      do:delivery_notes(*),
      lines:sales_invoice_lines(*, variant:product_variants(*, product:products(*)))
    `)
        .eq('id', invoiceId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all sales invoices with optional filters.
 * 
 * @param companyId - UUID of the company
 * @param status - Optional status filter (draft/posted/void)
 * @param paymentStatus - Optional payment status (unpaid/partial/paid/overdue)
 * 
 * @returns Promise resolving to array of invoices
 * 
 * @example
 * ```typescript
 * // Get all unpaid invoices
 * const unpaid = await getAllInvoices(companyId, 'posted', 'unpaid');
 * 
 * // Get all overdue invoices
 * const overdue = await getAllInvoices(companyId, 'posted', 'overdue');
 * 
 * // Get all invoices
 * const all = await getAllInvoices(companyId);
 * ```
 */
export async function getAllInvoices(
    companyId: string,
    status?: string,
    paymentStatus?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('sales_invoice_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (status) {
        query = query.eq('status', status);
    }

    if (paymentStatus) {
        query = query.eq('payment_status', paymentStatus);
    }

    const { data, error } = await query.order('invoice_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Voids a sales invoice (cancels it).
 * 
 * **Important:** Cannot void if payments have been received.
 * Must reverse payments first.
 * 
 * @param invoiceId - UUID of invoice to void
 * @param reason - Reason for voiding
 * 
 * @throws {Error} If invoice has payments
 * @throws {Error} If update fails
 * @returns Promise that resolves when voided
 * 
 * @example
 * ```typescript
 * await voidInvoice(invoiceId, 'Duplicate invoice - created in error');
 * ```
 */
export async function voidInvoice(invoiceId: string, reason: string): Promise<void> {
    // Check if payments exist
    const invoice = await getSalesInvoice(invoiceId);

    if (invoice.amount_paid > 0) {
        throw new Error('Cannot void invoice with payments. Reverse payments first.');
    }

    const { error } = await supabaseServer
        .from('sales_invoices')
        .update({
            status: 'void',
            notes: `VOIDED: ${reason}`,
        })
        .eq('id', invoiceId);

    if (error) throw error;
}

// ==================== AR REPORTING ====================

/**
 * Retrieves AR aging report showing unpaid invoices by age.
 * 
 * **Aging Buckets:**
 * - Current: Not yet due
 * - 1-30 Days: Up to 30 days overdue
 * - 31-60 Days: 31-60 days overdue
 * - 61-90 Days: 61-90 days overdue
 * - 90+ Days: More than 90 days overdue
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to AR aging data
 * 
 * @example
 * ```typescript
 * const aging = await getARAging(companyId);
 * 
 * console.log('AR Aging Report:');
 * aging.forEach(inv => {
 *   console.log(`\n${inv.customer_name}`);
 *   console.log(`  Invoice: ${inv.invoice_number}`);
 *   console.log(`  Due: ${inv.due_date}`);
 *   console.log(`  Amount: ${inv.amount_due.toLocaleString()}`);
 *   console.log(`  Bucket: ${inv.aging_bucket}`);
 *   if (inv.days_overdue > 0) {
 *     console.log(`  ⚠️  ${inv.days_overdue} days overdue`);
 *   }
 * });
 * 
 * // Group by bucket
 * const byBucket = aging.reduce((acc, inv) => {
 *   const bucket = inv.aging_bucket;
 *   if (!acc[bucket]) acc[bucket] = { count: 0, amount: 0 };
 *   acc[bucket].count++;
 *   acc[bucket].amount += inv.amount_due;
 *   return acc;
 * }, {});
 * 
 * console.log('\nSummary by Age:');
 * Object.entries(byBucket).forEach(([bucket, data]) => {
 *   console.log(`${bucket}: ${data.count} invoices, ${data.amount.toLocaleString()}`);
 * });
 * ```
 */
export async function getARAging(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('ar_aging_vw')
        .select('*')
        .eq('company_id', companyId)
        .order('aging_bucket_order', { ascending: true })
        .order('days_overdue', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Retrieves customer AR balance summary.
 * 
 * Shows total AR balance per customer with credit limit comparison.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to customer AR balances
 * 
 * @example
 * ```typescript
 * const balances = await getCustomerARBalance(companyId);
 * 
 * console.log('Customer AR Balances:');
 * balances.forEach(cust => {
 *   console.log(`\n${cust.customer_name}`);
 *   console.log(`  Credit Limit: ${cust.credit_limit.toLocaleString()}`);
 *   console.log(`  Total AR: ${cust.total_ar_balance.toLocaleString()}`);
 *   console.log(`  Overdue: ${cust.overdue_amount.toLocaleString()}`);
 *   console.log(`  Available Credit: ${cust.available_credit.toLocaleString()}`);
 *   
 *   if (cust.overdue_amount > 0) {
 *     console.log(`  ⚠️  Has overdue invoices!`);
 *   }
 *   
 *   if (cust.available_credit < 0) {
 *     console.log(`  ❌ Exceeded credit limit!`);
 *   }
 * });
 * ```
 */
export async function getCustomerARBalance(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('customer_ar_balance_vw')
        .select('*')
        .eq('company_id', companyId)
        .order('total_ar_balance', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ==================== AR PAYMENTS ====================

export interface ARPayment {
    id?: string;
    company_id: string;
    payment_number: string;
    payment_date: string;
    customer_id: string;
    period_id: string;
    amount_received: number;
    payment_method: string;
    reference_number?: string;
    bank_account?: string;
    discount_taken?: number;
    notes?: string;
}

export interface PaymentAllocation {
    id?: string;
    payment_id: string;
    invoice_id: string;
    amount_allocated: number;
    notes?: string;
}

/**
 * Creates an AR payment (customer payment receipt).
 * 
 * **Payment Purpose:**
 * - Record customer payments
 * - Reduce AR balance
 * - Track payment methods
 * - Enable allocation to invoices
 * 
 * **Workflow:**
 * 1. Create payment (this function)
 * 2. Allocate to invoices with {@link allocatePaymentToInvoice}
 *    OR auto-allocate with {@link autoAllocatePayment}
 * 3. Payment updates invoice.amount_paid automatically
 * 4. Invoice payment_status updates automatically
 * 
 * @param payment - AR payment details
 * @param payment.company_id - UUID of the company
 * @param payment.payment_number - Unique payment number (e.g., 'PAY-2025-001')
 * @param payment.payment_date - Payment received date
 * @param payment.customer_id - UUID of customer making payment
 * @param payment.period_id - UUID of accounting period (must be open)
 * @param payment.amount_received - Total amount received
 * @param payment.payment_method - Payment method (Cash/Transfer/Check/Card)
 * @param payment.reference_number - Bank ref, check number, etc.
 * @param userId - UUID of user creating payment
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created payment
 * 
 * @example
 * ```typescript
 * // Record bank transfer payment
 * const payment = await createARPayment({
 *   company_id: companyId,
 *   payment_number: 'PAY-2025-001',
 *   payment_date: '2025-02-15',
 *   customer_id: customerId,
 *   period_id: periodId,
 *   amount_received: 5000000,
 *   payment_method: 'Transfer',
 *   reference_number: 'TRF20250215001',
 *   bank_account: 'BCA 1234567890'
 * }, userId);
 * 
 * // Auto-allocate to oldest invoices (FIFO)
 * const allocations = await autoAllocatePayment(payment.id, userId);
 * console.log(`Allocated to ${allocations.length} invoices`);
 * 
 * allocations.forEach(alloc => {
 *   console.log(`  ${alloc.invoice_number}: ${alloc.amount_allocated.toLocaleString()}`);
 * });
 * ```
 * 
 * @see {@link allocatePaymentToInvoice} for manual allocation
 * @see {@link autoAllocatePayment} for FIFO auto-allocation
 */
export async function createARPayment(
    payment: ARPayment,
    userId: string
): Promise<ARPayment> {
    await validatePeriodIsOpen(payment.period_id);

    const { data, error } = await supabaseServer
        .from('ar_payments')
        .insert({ ...payment, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Allocates payment to a specific invoice.
 * 
 * **Manual allocation** allows precise control over which invoices
 * get paid. Use this when customer specifies which invoices to pay.
 * 
 * **Validations:**
 * - Customer must match
 * - Invoice must be posted
 * - Amount <= payment unallocated
 * - Amount <= invoice amount_due
 * 
 * @param paymentId - UUID of payment to allocate from
 * @param invoiceId - UUID of invoice to allocate to
 * @param amount - Amount to allocate
 * @param userId - UUID of user performing allocation
 * 
 * @throws {Error} If customer mismatch
 * @throws {Error} If invoice not posted
 * @throws {Error} If insufficient unallocated amount
 * @throws {Error} If amount exceeds invoice due
 * @throws {Error} If RPC call fails
 * @returns Promise that resolves when allocated
 * 
 * @example
 * ```typescript
 * // Customer pays specific invoice
 * try {
 *   await allocatePaymentToInvoice(
 *     paymentId,
 *     invoiceId,
 *     2500000,  // Partial payment
 *     userId
 *   );
 *   console.log('✅ Payment allocated to invoice');
 * } catch (error) {
 *   if (error.message.includes('exceeds unallocated')) {
 *     console.error('Payment already fully allocated!');
 *   } else if (error.message.includes('exceeds invoice amount due')) {
 *     console.error('Amount too large for invoice!');
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Allocate to multiple invoices manually
 * const payment = await getARPayment(paymentId);
 * const invoicesToPay = [
 *   { invoiceId: inv1Id, amount: 1000000 },
 *   { invoiceId: inv2Id, amount: 1500000 },
 *   { invoiceId: inv3Id, amount: 2500000 }
 * ];
 * 
 * for (const inv of invoicesToPay) {
 *   await allocatePaymentToInvoice(
 *     paymentId,
 *     inv.invoiceId,
 *     inv.amount,
 *     userId
 *   );
 * }
 * 
 * // Check remaining
 * const updated = await getARPayment(paymentId);
 * console.log(`Unallocated: ${updated.amount_unallocated.toLocaleString()}`);
 * ```
 * 
 * @see {@link createARPayment} for creating payment
 * @see {@link autoAllocatePayment} for FIFO allocation
 */
export async function allocatePaymentToInvoice(
    paymentId: string,
    invoiceId: string,
    amount: number,
    userId: string
): Promise<void> {
    const { error } = await supabaseServer.rpc('allocate_payment_to_invoice', {
        p_payment_id: paymentId,
        p_invoice_id: invoiceId,
        p_amount: amount,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Auto-allocates payment to oldest unpaid invoices (FIFO).
 * 
 * **FIFO Logic:**
 * - Sorts invoices by due_date ASC, then invoice_date ASC
 * - Allocates to oldest first
 * - Continues until payment fully allocated or no more invoices
 * 
 * **Use Case:**
 * When customer doesn't specify which invoices to pay,
 * automatically apply to oldest balances first.
 * 
 * @param paymentId - UUID of payment to allocate
 * @param userId - UUID of user performing allocation
 * 
 * @returns Promise resolving to array of allocations made
 * @returns allocation.invoice_id - Invoice UUID
 * @returns allocation.invoice_number - Invoice number
 * @returns allocation.amount_allocated - Amount allocated
 * 
 * @example
 * ```typescript
 * // Auto-allocate payment to oldest invoices
 * const allocations = await autoAllocatePayment(paymentId, userId);
 * 
 * console.log(`Payment auto-allocated to ${allocations.length} invoices:`);
 * allocations.forEach(alloc => {
 *   console.log(`  Invoice ${alloc.invoice_number}: ${alloc.amount_allocated.toLocaleString()}`);
 * });
 * 
 * // Check if fully allocated
 * const payment = await getARPayment(paymentId);
 * if (payment.amount_unallocated === 0) {
 *   console.log('✅ Payment fully allocated');
 * } else {
 *   console.log(`⚠️  ${payment.amount_unallocated.toLocaleString()} remaining`);
 *   console.log('No more unpaid invoices for this customer');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Complete payment workflow with auto-allocation
 * const payment = await createARPayment({
 *   company_id: companyId,
 *   payment_number: 'PAY-2025-001',
 *   payment_date: '2025-02-15',
 *   customer_id: customerId,
 *   period_id: periodId,
 *   amount_received: 10000000,
 *   payment_method: 'Transfer'
 * }, userId);
 * 
 * // Auto-allocate FIFO
 * const allocations = await autoAllocatePayment(payment.id, userId);
 * 
 * // Show results
 * console.log('Payment Allocation Summary:');
 * console.log(`Total Received: ${payment.amount_received.toLocaleString()}`);
 * console.log(`Allocated to ${allocations.length} invoices:`);
 * 
 * let totalAllocated = 0;
 * allocations.forEach(alloc => {
 *   console.log(`  ${alloc.invoice_number}: ${alloc.amount_allocated.toLocaleString()}`);
 *   totalAllocated += alloc.amount_allocated;
 * });
 * 
 * console.log(`Total Allocated: ${totalAllocated.toLocaleString()}`);
 * console.log(`Remaining: ${(payment.amount_received - totalAllocated).toLocaleString()}`);
 * ```
 * 
 * @see {@link createARPayment} for creating payment
 * @see {@link allocatePaymentToInvoice} for manual allocation
 */
export async function autoAllocatePayment(
    paymentId: string,
    userId: string
): Promise<any[]> {
    const { data, error } = await supabaseServer.rpc('auto_allocate_payment', {
        p_payment_id: paymentId,
        p_user_id: userId,
    });

    if (error) throw error;
    return data || [];
}

/**
 * Retrieves an AR payment with all related details.
 * 
 * @param paymentId - UUID of the payment
 * @throws {Error} If payment not found
 * @returns Promise resolving to payment with nested relationships
 * 
 * @example
 * ```typescript
 * const payment = await getARPayment(paymentId);
 * 
 * console.log(`Payment: ${payment.payment_number}`);
 * console.log(`Customer: ${payment.customer.name}`);
 * console.log(`Amount Received: ${payment.amount_received.toLocaleString()}`);
 * console.log(`Allocated: ${payment.amount_allocated.toLocaleString()}`);
 * console.log(`Unallocated: ${payment.amount_unallocated.toLocaleString()}`);
 * console.log(`Method: ${payment.payment_method}`);
 * console.log(`Reference: ${payment.reference_number}`);
 * 
 * if (payment.allocations && payment.allocations.length > 0) {
 *   console.log('\nAllocations:');
 *   payment.allocations.forEach(alloc => {
 *     console.log(`  Invoice ${alloc.invoice.invoice_number}: ${alloc.amount_allocated.toLocaleString()}`);
 *   });
 * }
 * ```
 */
export async function getARPayment(paymentId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('ar_payments')
        .select(`
      *,
      customer:customers(*),
      allocations:ar_payment_allocations(
        *,
        invoice:sales_invoices(invoice_number, total_amount, amount_due)
      )
    `)
        .eq('id', paymentId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all AR payments with optional filters.
 * 
 * @param companyId - UUID of the company
 * @param customerId - Optional customer filter
 * 
 * @returns Promise resolving to array of payments
 * 
 * @example
 * ```typescript
 * // Get all payments for a customer
 * const payments = await getAllARPayments(companyId, customerId);
 * 
 * console.log(`Customer Payments (${payments.length}):`);
 * payments.forEach(p => {
 *   console.log(`${p.payment_date} - ${p.payment_number}: ${p.amount_received.toLocaleString()}`);
 *   console.log(`  Status: ${p.allocation_status}`);
 *   console.log(`  Allocated to ${p.invoice_count} invoices`);
 * });
 * 
 * // Get all payments
 * const allPayments = await getAllARPayments(companyId);
 * ```
 */
export async function getAllARPayments(
    companyId: string,
    customerId?: string
): Promise<any[]> {
    let query = supabaseServer
        .from('ar_payment_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (customerId) {
        query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Reverses a payment allocation (removes allocation from invoice).
 * 
 * **Use Case:**
 * - Allocation was made to wrong invoice
 * - Need to reallocate to different invoices
 * - Payment was recorded incorrectly
 * 
 * @param allocationId - UUID of allocation to reverse
 * 
 * @throws {Error} If allocation not found
 * @throws {Error} If delete fails
 * @returns Promise that resolves when reversed
 * 
 * @example
 * ```typescript
 * // Reverse incorrect allocation
 * await reversePaymentAllocation(allocationId);
 * console.log('✅ Allocation reversed');
 * 
 * // Re-allocate to correct invoice
 * await allocatePaymentToInvoice(
 *   paymentId,
 *   correctInvoiceId,
 *   amount,
 *   userId
 * );
 * ```
 * 
 * @example
 * ```typescript
 * // Reverse all allocations for a payment
 * const payment = await getARPayment(paymentId);
 * 
 * for (const alloc of payment.allocations) {
 *   await reversePaymentAllocation(alloc.id);
 * }
 * 
 * console.log('All allocations reversed');
 * 
 * // Re-allocate using different logic
 * await autoAllocatePayment(paymentId, userId);
 * ```
 */
export async function reversePaymentAllocation(allocationId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('ar_payment_allocations')
        .delete()
        .eq('id', allocationId);

    if (error) throw error;
}

// ==================== CREDIT MANAGEMENT ====================

/**
 * Updates customer credit limit with history tracking.
 * 
 * **Use Case:**
 * - Customer requests credit limit increase
 * - Credit review results in limit change
 * - Business relationship changes
 * 
 * **History Tracking:**
 * Automatically records previous and new limit with reason in
 * `customer_credit_limit_history` table for audit purposes.
 * 
 * @param customerId - UUID of customer
 * @param newLimit - New credit limit amount
 * @param reason - Reason for change
 * @param userId - UUID of user making change
 * 
 * @throws {Error} If customer not found
 * @throws {Error} If update fails
 * @returns Promise that resolves when updated
 * 
 * @example
 * ```typescript
 * // Increase credit limit after review
 * await updateCustomerCreditLimit(
 *   customerId,
 *   15000000,  // Increase from 10M to 15M
 *   'Good payment history for 6 months, sales growing',
 *   managerId
 * );
 * 
 * console.log('✅ Credit limit updated');
 * 
 * // Check new status
 * const status = await getCustomerCreditStatus(customerId);
 * console.log(`New Limit: ${status.credit_limit.toLocaleString()}`);
 * console.log(`Available: ${status.available_credit.toLocaleString()}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Decrease due to payment issues
 * await updateCustomerCreditLimit(
 *   customerId,
 *   5000000,  // Decrease from 10M to 5M
 *   'Multiple late payments in last 3 months',
 *   managerId
 * );
 * ```
 */
export async function updateCustomerCreditLimit(
    customerId: string,
    newLimit: number,
    reason: string,
    userId: string
): Promise<void> {
    // Get current customer
    const { data: customer, error: fetchError } = await supabaseServer
        .from('customers')
        .select('credit_limit')
        .eq('id', customerId)
        .single();

    if (fetchError) throw fetchError;

    const previousLimit = customer.credit_limit || 0;

    // Create history record
    const { error: historyError } = await supabaseServer
        .from('customer_credit_limit_history')
        .insert({
            customer_id: customerId,
            previous_limit: previousLimit,
            new_limit: newLimit,
            reason: reason,
            created_by: userId,
        });

    if (historyError) throw historyError;

    // Update customer
    const { error: updateError } = await supabaseServer
        .from('customers')
        .update({ credit_limit: newLimit })
        .eq('id', customerId);

    if (updateError) throw updateError;
}

/**
 * Sets credit hold on a customer (blocks new orders).
 * 
 * **Credit Hold Effect:**
 * - Blocks new sales order approval
 * - Blocks delivery confirmation (optional in implementation)
 * - Does NOT affect existing approved orders
 * - Customer can still make payments
 * 
 * **Use Case:**
 * - Customer has overdue invoices
 * - Credit limit consistently exceeded
 * - Payment disputes
 * - Risk management decision
 * 
 * @param customerId - UUID of customer
 * @param reason - Reason for hold
 * @param userId - UUID of user setting hold
 * 
 * @throws {Error} If customer not found
 * @throws {Error} If update fails
 * @returns Promise that resolves when hold set
 * 
 * @example
 * ```typescript
 * // Set hold due to overdue payments
 * await setCreditHold(
 *   customerId,
 *   'Invoices overdue > 90 days. Total overdue: 3,500,000',
 *   managerId
 * );
 * 
 * console.log('🛑 Credit hold activated');
 * 
 * // Try to approve SO will now fail
 * try {
 *   await approveSalesOrder(soId, managerId);
 * } catch (error) {
 *   console.log(error.message);  // 'Customer is on credit hold'
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Automated hold based on aging
 * const aging = await getARAging(companyId);
 * 
 * aging.forEach(async (inv) => {
 *   if (inv.days_overdue > 90) {
 *     await setCreditHold(
 *       inv.customer_id,
 *       `Auto-hold: Invoice ${inv.invoice_number} overdue ${inv.days_overdue} days`,
 *       'SYSTEM'
 *     );
 *   }
 * });
 * ```
 */
export async function setCreditHold(
    customerId: string,
    reason: string,
    userId: string
): Promise<void> {
    // Get current status
    const { data: customer, error: fetchError } = await supabaseServer
        .from('customers')
        .select('credit_hold')
        .eq('id', customerId)
        .single();

    if (fetchError) throw fetchError;

    const previousHold = customer.credit_hold || false;

    // Create history record
    const { error: historyError } = await supabaseServer
        .from('customer_credit_hold_history')
        .insert({
            customer_id: customerId,
            action: 'hold_set',
            reason: reason,
            previous_credit_hold: previousHold,
            new_credit_hold: true,
            created_by: userId,
        });

    if (historyError) throw historyError;

    // Set credit hold
    const { error: updateError } = await supabaseServer
        .from('customers')
        .update({ credit_hold: true })
        .eq('id', customerId);

    if (updateError) throw updateError;
}

/**
 * Removes credit hold from a customer (enables new orders).
 * 
 * **Use Case:**
 * - Customer paid overdue invoices
 * - Dispute resolved
 * - AR balance back under control
 * - Management override
 * 
 * @param customerId - UUID of customer
 * @param reason - Reason for removing hold
 * @param userId - UUID of user removing hold
 * 
 * @throws {Error} If customer not found
 * @throws {Error} If update fails
 * @returns Promise that resolves when hold removed
 * 
 * @example
 * ```typescript
 * // Remove hold after payment received
 * await removeCreditHold(
 *   customerId,
 *   'All overdue invoices paid. Payment received: PAY-2025-015',
 *   managerId
 * );
 * 
 * console.log('✅ Credit hold removed - customer can order again');
 * 
 * // Check status
 * const status = await getCustomerCreditStatus(customerId);
 * console.log(`Status: ${status.credit_status}`);  // Should be 'Good' or 'Near Limit'
 * ```
 * 
 * @example
 * ```typescript
 * // Workflow: Payment received → Remove hold
 * const payment = await createARPayment({
 *   customer_id: customerId,
 *   amount_received: 5000000,
 *   // ... other details
 * }, userId);
 * 
 * // Auto-allocate to overdue invoices
 * await autoAllocatePayment(payment.id, userId);
 * 
 * // Check if all overdue cleared
 * const aging = await getARAging(companyId);
 * const customerOverdue = aging.filter(inv => 
 *   inv.customer_id === customerId && inv.days_overdue > 0
 * );
 * 
 * if (customerOverdue.length === 0) {
 *   await removeCreditHold(
 *     customerId,
 *     'All overdue invoices cleared',
 *     userId
 *   );
 *   console.log('✅ Credit hold auto-removed');
 * }
 * ```
 */
export async function removeCreditHold(
    customerId: string,
    reason: string,
    userId: string
): Promise<void> {
    // Get current status
    const { data: customer, error: fetchError } = await supabaseServer
        .from('customers')
        .select('credit_hold')
        .eq('id', customerId)
        .single();

    if (fetchError) throw fetchError;

    const previousHold = customer.credit_hold || false;

    // Create history record
    const { error: historyError } = await supabaseServer
        .from('customer_credit_hold_history')
        .insert({
            customer_id: customerId,
            action: 'hold_removed',
            reason: reason,
            previous_credit_hold: previousHold,
            new_credit_hold: false,
            created_by: userId,
        });

    if (historyError) throw historyError;

    // Remove credit hold
    const { error: updateError } = await supabaseServer
        .from('customers')
        .update({ credit_hold: false })
        .eq('id', customerId);

    if (updateError) throw updateError;
}
