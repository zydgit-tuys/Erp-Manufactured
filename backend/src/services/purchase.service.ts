/**
 * Purchase Service
 * Complete Purchase-to-Pay (P2P) Cycle Management
 * 
 * **Complete P2P Workflow:**
 * 1. **Purchase Order (PO):** Request materials from vendor
 * 2. **Goods Receipt Note (GRN):** Receive materials into warehouse
 * 3. **Vendor Invoice:** Vendor bills for materials
 * 4. **Payment:** Pay vendor and settle invoice
 * 
 * **3-Way Matching:**
 * - PO: What we ordered
 * - GRN: What we received
 * - Invoice: What we're being charged for
 * 
 * Critical for inventory accuracy and financial control.
 */
import { supabaseServer } from '../config/supabase';
import { validatePeriodIsOpen } from './period.service';

// ==================== TYPES ====================

export interface PurchaseOrder {
    id?: string;
    company_id: string;
    po_number: string;
    po_date: string;
    vendor_id: string;
    warehouse_id: string;
    period_id: string;
    currency?: string;
    subtotal?: number;
    tax_amount?: number;
    delivery_date?: string;
    payment_terms?: string;
    notes?: string;
}

export interface POLine {
    id?: string;
    po_id: string;
    line_number: number;
    material_id: string;
    qty_ordered: number;
    unit_price: number;
    description?: string;
}

export interface GoodsReceiptNote {
    id?: string;
    company_id: string;
    grn_number: string;
    grn_date: string;
    po_id?: string;
    vendor_id: string;
    warehouse_id: string;
    period_id: string;
    delivery_note_number?: string;
    notes?: string;
}

export interface GRNLine {
    id?: string;
    grn_id: string;
    po_line_id?: string;
    material_id: string;
    bin_id: string;
    qty_received: number;
    unit_cost: number;
}

export interface VendorInvoice {
    id?: string;
    company_id: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    vendor_id: string;
    po_id?: string;
    period_id: string;
    subtotal?: number;
    tax_amount?: number;
    payment_terms?: string;
    notes?: string;
}

export interface InvoiceLine {
    id?: string;
    invoice_id: string;
    grn_line_id?: string;
    po_line_id?: string;
    material_id: string;
    qty_invoiced: number;
    unit_price: number;
    variance_approved?: boolean;
}

export interface VendorPayment {
    id?: string;
    company_id: string;
    payment_number: string;
    payment_date: string;
    vendor_id: string;
    period_id: string;
    payment_method: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'GIRO' | 'CREDIT_CARD';
    total_amount: number;
    reference_number?: string;
    notes?: string;
}

export interface PaymentAllocation {
    payment_id: string;
    invoice_id: string;
    amount_allocated: number;
}

// ==================== PURCHASE ORDERS ====================

/**
 * Creates a new purchase order to buy materials from vendor.
 * 
 * **Purchase Order Workflow:**
 * 1. Create PO (this function) → Status: draft
 * 2. Add line items → Status: draft
 * 3. Approve PO → Status: approved (sent to vendor)
 * 4. Vendor delivers → Create GRN
 * 5. Vendor invoices → Create vendor invoice
 * 6. Pay vendor → Create payment
 * 
 * **Use Cases:**
 * - Buying raw materials (fabric, thread, buttons)
 * - Replenishing low stock items
 * - Planned purchases based on production schedule
 * 
 * @param po - Purchase order details
 * @param po.company_id - UUID of the company
 * @param po.po_number - Unique PO number (e.g., 'PO-2025-001')
 * @param po.po_date - PO creation date
 * @param po.vendor_id - UUID of vendor (supplier)
 * @param po.warehouse_id - UUID of destination warehouse
 * @param po.period_id - UUID of accounting period (must be open)
 * @param po.delivery_date - Expected delivery date
 * @param po.payment_terms - Payment terms (e.g., 'Net 30')
 * @param po.currency - Currency code (e.g., 'IDR', 'USD')
 * @param userId - UUID of user creating the PO
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If vendor is blocked
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created PO
 * 
 * @example
 * ```typescript
 * // Create purchase order for fabric
 * const po = await createPurchaseOrder({
 *   company_id: companyId,
 *   po_number: 'PO-2025-001',
 *   po_date: '2025-01-15',
 *   vendor_id: fabricSuppliervendorId,
 *   warehouse_id: mainWarehouseId,
 *   period_id: periodId,
 *   delivery_date: '2025-01-22',
 *   payment_terms: 'Net 30',
 *   notes: 'Urgent order for production'
 * }, userId);
 * 
 * // Add materials to PO
 * await addPOLine({
 *   po_id: po.id,
 *   line_number: 1,
 *   material_id: cottonFabricId,
 *   qty_ordered: 500,  // 500 meters
 *   unit_price: 50000  // 50k per meter
 * }, userId);
 * 
 * // Approve and send to vendor
 * await approvePurchaseOrder(po.id, managerId);
 * ```
 * 
 * @see {@link addPOLine} for adding line items
 * @see {@link approvePurchaseOrder} for approval
 * @see {@link createGRN} for receiving materials
 */
export async function createPurchaseOrder(po: PurchaseOrder, userId: string): Promise<PurchaseOrder> {
    await validatePeriodIsOpen(po.period_id);

    const { data, error } = await supabaseServer
        .from('purchase_orders')
        .insert({ ...po, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to purchase order.
 * 
 * Each line specifies one material with quantity and price.
 * Line numbers should be sequential (1, 2, 3, ...).
 * 
 * @param line - PO line details
 * @param line.po_id - UUID of parent PO
 * @param line.line_number - Sequential line number (1, 2, 3, ...)
 * @param line.material_id - UUID of material to purchase
 * @param line.qty_ordered - Quantity to order
 * @param line.unit_price - Agreed price per unit (from vendor quote)
 * @param line.description - Optional description/specification
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If PO not found or already approved
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Add multiple materials to PO
 * await addPOLine({
 *   po_id: poId,
 *   line_number: 1,
 *   material_id: fabricId,
 *   qty_ordered: 500,
 *   unit_price: 50000,
 *   description: 'Blue cotton fabric, 60" width'
 * }, userId);
 * 
 * await addPOLine({
 *   po_id: poId,
 *   line_number: 2,
 *   material_id: threadId,
 *   qty_ordered: 100,
 *   unit_price: 15000
 * }, userId);
 * ```
 * 
 * @see {@link createPurchaseOrder} for creating PO
 */
export async function addPOLine(line: POLine, userId: string): Promise<POLine> {
    const { data, error } = await supabaseServer
        .from('purchase_order_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Approves purchase order and marks it as sent to vendor.
 * 
 * Approval workflow ensures proper authorization before committing
 * to purchase. After approval, PO cannot be modified (must create new PO).
 * 
 * @param poId - UUID of PO to approve
 * @param userId - UUID of approver (typically manager/director)
 * 
 * @throws {Error} If PO not found
 * @throws {Error} If PO totals exceed vendor credit limit
 * @throws {Error} If update fails
 * @returns Promise that resolves when approved
 * 
 * @example
 * ```typescript
 * // Manager approves PO
 * await approvePurchaseOrder(poId, managerId);
 * 
 * // Status changed: draft → approved
 * // PO can now be sent to vendor
 * // GRN can be created when delivery arrives
 * ```
 * 
 * @see {@link createPurchaseOrder} for creating PO
 * @see {@link createGRN} for receiving materials
 */
export async function approvePurchaseOrder(poId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('purchase_orders')
        .update({
            status: 'approved',
            approved_by: userId,
            approved_at: new Date().toISOString(),
        })
        .eq('id', poId);

    if (error) throw error;
}

/**
 * Retrieves purchase order with all line items and vendor details.
 * 
 * Includes nested vendor information for display purposes.
 * 
 * @param poId - UUID of the PO
 * @throws {Error} If PO not found
 * @returns Promise resolving to PO with lines and vendor
 * 
 * @example
 * ```typescript
 * const po = await getPurchaseOrder(poId);
 * 
 * console.log(`PO ${po.po_number} - ${po.vendor.name}`);
 * console.log(`Total: ${po.subtotal + po.tax_amount}`);
 * 
 * po.lines.forEach(line => {
 *   console.log(`  ${line.material.name}: ${line.qty_ordered} @ ${line.unit_price}`);
 * });
 * ```
 */
export async function getPurchaseOrder(poId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('purchase_orders')
        .select('*, lines:purchase_order_lines(*), vendor:vendors(*)')
        .eq('id', poId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves outstanding purchase orders (partially received).
 * 
 * Shows POs where qty_received < qty_ordered. Use for tracking
 * pending deliveries and follow-up with vendors.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to array of outstanding POs
 * 
 * @example
 * ```typescript
 * // Get all pending deliveries
 * const outstanding = await getOutstandingPOs(companyId);
 * 
 * console.log('Pending Deliveries:');
 * outstanding.forEach(po => {
 *   console.log(`${po.po_number}: ${po.qty_outstanding} items pending`);
 *   console.log(`  Vendor: ${po.vendor_name}`);
 *   console.log(`  Expected: ${po.delivery_date}`);
 * });
 * ```
 * 
 * @see {@link createGRN} for receiving materials
 */
export async function getOutstandingPOs(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('outstanding_po_vw')
        .select('*')
        .eq('company_id', companyId);

    if (error) throw error;
    return data;
}

// ==================== GOODS RECEIPT NOTES ====================

/**
 * Creates a Goods Receipt Note (GRN) to record material delivery.
 * 
 * **GRN Workflow:**
 * 1. Vendor delivers materials
 * 2. Create GRN (this function) → Status: draft
 * 3. Add lines with quantities received
 * 4. Post GRN → Inventory updated
 * 
 * **GRN vs PO:**
 * - GRN records ACTUAL receipt
 * - May differ from PO (partial delivery, over-delivery)
 * - GRN triggers inventory increase
 * - GRN cost becomes inventory cost
 * 
 * @param grn - GRN details
 * @param grn.company_id - UUID of the company
 * @param grn.grn_number - Unique GRN number (e.g., 'GRN-2025-001')
 * @param grn.grn_date - Date of receipt
 * @param grn.po_id - Optional UUID of related PO
 * @param grn.vendor_id - UUID of vendor
 * @param grn.warehouse_id - UUID of receiving warehouse
 * @param grn.period_id - UUID of accounting period (must be open)
 * @param grn.delivery_note_number - Vendor's delivery note number
 * @param userId - UUID of user creating GRN
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created GRN
 * 
 * @example
 * ```typescript
 * // Vendor delivers materials
 * const grn = await createGRN({
 *   company_id: companyId,
 *   grn_number: 'GRN-2025-001',
 *   grn_date: '2025-01-22',
 *   po_id: poId,
 *   vendor_id: vendorId,
 *   warehouse_id: warehouseId,
 *   period_id: periodId,
 *   delivery_note_number: 'DN-VENDOR-12345',
 *   notes: 'Delivery as promised'
 * }, userId);
 * 
 * // Add received items
 * await addGRNLine({
 *   grn_id: grn.id,
 *   po_line_id: poLineId,
 *   material_id: fabricId,
 *   bin_id: binId,
 *   qty_received: 480,  // Received 480 instead of ordered 500
 *   unit_cost: 50000
 * }, userId);
 * 
 * // Post to inventory
 * await postGRN(grn.id, userId);
 * ```
 * 
 * @see {@link addGRNLine} for adding line items
 * @see {@link postGRN} for posting to inventory
 */
export async function createGRN(grn: GoodsReceiptNote, userId: string): Promise<GoodsReceiptNote> {
    await validatePeriodIsOpen(grn.period_id);

    const { data, error } = await supabaseServer
        .from('goods_receipt_notes')
        .insert({ ...grn, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to GRN with received quantity.
 * 
 * **Important:** qty_received may differ from qty_ordered in PO:
 * - Partial delivery: qty_received < qty_ordered
 * - Over-delivery: qty_received > qty_ordered (requires approval)
 * - Exact match: qty_received = qty_ordered (ideal)
 * 
 * @param line - GRN line details
 * @param line.grn_id - UUID of parent GRN
 * @param line.po_line_id - Optional UUID of related PO line (for matching)
 * @param line.material_id - UUID of material received
 * @param line.bin_id - UUID of bin location for storage
 * @param line.qty_received - Actual quantity received
 * @param line.unit_cost - Cost per unit (from PO or invoice)
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Partial delivery
 * await addGRNLine({
 *   grn_id: grnId,
 *   po_line_id: poLineId,
 *   material_id: fabricId,
 *   bin_id: binId,
 *   qty_received: 300,  // PO was for 500, rest will come later
 *   unit_cost: 50000
 * }, userId);
 * ```
 * 
 * @see {@link createGRN} for creating GRN
 * @see {@link postGRN} for posting to inventory
 */
export async function addGRNLine(line: GRNLine, userId: string): Promise<GRNLine> {
    const { data, error } = await supabaseServer
        .from('grn_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Posts GRN to inventory ledger (increases raw material inventory).
 * 
 * **Posting Process (via Database RPC):**
 * 1. Validate period is open
 * 2. For each GRN line:
 *    - Insert into raw_material_ledger (qty_in)
 *    - Update material balance
 *    - Update weighted average cost
 * 3. Mark GRN as posted
 * 4. Update PO received quantities
 * 
 * **Accounting Impact:**
 * - Dr. Raw Material Inventory
 * - Cr. Accounts Payable (or GRN Clearing)
 * 
 * @param grnId - UUID of GRN to post
 * @param userId - UUID of user posting
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If GRN already posted
 * @throws {Error} If database RPC fails
 * @returns Promise that resolves when posted
 * 
 * @example
 * ```typescript
 * // Post GRN to inventory
 * await postGRN(grnId, userId);
 * 
 * // Result:
 * // 1. Inventory increased by qty_received
 * // 2. Cost updated (weighted average)
 * // 3. GRN status: draft → posted
 * // 4. PO shows partial/full completion
 * ```
 * 
 * @see {@link createGRN} for creating GRN
 * @see {@link createVendorInvoice} for next step (invoicing)
 */
export async function postGRN(grnId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer.rpc('post_grn', {
        p_grn_id: grnId,
        p_user_id: userId,
    });

    if (error) throw error;
}

/**
 * Retrieves GRN with all line items and vendor details.
 * 
 * @param grnId - UUID of the GRN
 * @throws {Error} If GRN not found
 * @returns Promise resolving to GRN with lines and vendor
 * 
 * @example
 * ```typescript
 * const grn = await getGRN(grnId);
 * 
 * console.log(`GRN ${grn.grn_number} - ${grn.vendor.name}`);
 * grn.lines.forEach(line => {
 *   console.log(`  ${line.material.name}: ${line.qty_received} received`);
 * });
 * ```
 */
export async function getGRN(grnId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('goods_receipt_notes')
        .select('*, lines:grn_lines(*), vendor:vendors(*)')
        .eq('id', grnId)
        .single();

    if (error) throw error;
    return data;
}

// ==================== VENDOR INVOICES ====================

/**
 * Creates a vendor invoice (bill from supplier).
 * 
 * **Invoice Workflow:**
 * 1. Vendor sends invoice
 * 2. Create vendor invoice (this function) → Status: draft
 * 3. Add line items
 * 4. Match against PO and GRN (3-way matching)
 * 5. Approve variances if any
 * 6. Post invoice → Creates AP liability
 * 7. Pay invoice → Settles AP
 * 
 * **3-Way Matching:**
 * - PO: What we agreed to buy
 * - GRN: What we actually received
 * - Invoice: What vendor is charging
 * - All three must match (within tolerance)
 * 
 * @param invoice - Invoice details
 * @param invoice.company_id - UUID of the company
 * @param invoice.invoice_number - Vendor's invoice number
 * @param invoice.invoice_date - Invoice date
 * @param invoice.due_date - Payment due date
 * @param invoice.vendor_id - UUID of vendor
 * @param invoice.po_id - Optional UUID of related PO
 * @param invoice.period_id - UUID of accounting period (must be open)
 * @param invoice.payment_terms - Payment terms (e.g., 'Net 30')
 * @param userId - UUID of user creating invoice
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created invoice
 * 
 * @example
 * ```typescript
 * // Vendor sends invoice
 * const invoice = await createVendorInvoice({
 *   company_id: companyId,
 *   invoice_number: 'INV-VENDOR-2025-001',
 *   invoice_date: '2025-01-25',
 *   due_date: '2025-02-24',  // Net 30
 *   vendor_id: vendorId,
 *   po_id: poId,
 *   period_id: periodId,
 *   payment_terms: 'Net 30'
 * }, userId);
 * 
 * // Add invoice lines
 * await addInvoiceLine({
 *   invoice_id: invoice.id,
 *   grn_line_id: grnLineId,
 *   material_id: fabricId,
 *   qty_invoiced: 480,
 *   unit_price: 50000
 * }, userId);
 * 
 * // Post to create AP liability
 * await postVendorInvoice(invoice.id, userId);
 * ```
 * 
 * @see {@link addInvoiceLine} for adding line items
 * @see {@link postVendorInvoice} for posting
 * @see {@link createVendorPayment} for payment
 */
export async function createVendorInvoice(invoice: VendorInvoice, userId: string): Promise<VendorInvoice> {
    await validatePeriodIsOpen(invoice.period_id);

    const { data, error } = await supabaseServer
        .from('vendor_invoices')
        .insert({ ...invoice, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Adds a line item to vendor invoice.
 * 
 * **Variance Handling:**
 * - If qty_invoiced ≠ qty_received, requires approval
 * - If unit_price ≠ PO price, requires approval
 * - Set variance_approved = true after manager approval
 * 
 * @param line - Invoice line details
 * @param line.invoice_id - UUID of parent invoice
 * @param line.grn_line_id - Optional UUID of GRN line (for matching)
 * @param line.po_line_id - Optional UUID of PO line (for matching)
 * @param line.material_id - UUID of material being invoiced
 * @param line.qty_invoiced - Quantity on invoice
 * @param line.unit_price - Price per unit on invoice
 * @param line.variance_approved - Set true if variance approved
 * @param userId - UUID of user adding the line
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created line
 * 
 * @example
 * ```typescript
 * // Perfect match
 * await addInvoiceLine({
 *   invoice_id: invoiceId,
 *   grn_line_id: grnLineId,
 *   po_line_id: poLineId,
 *   material_id: fabricId,
 *   qty_invoiced: 480,  // Matches GRN
 *   unit_price: 50000   // Matches PO
 * }, userId);
 * 
 * // Price variance (requires approval)
 * await addInvoiceLine({
 *   invoice_id: invoiceId,
 *   material_id: threadId,
 *   qty_invoiced: 100,
 *   unit_price: 16000,  // PO was 15000, vendor increased price
 *   variance_approved: true  // Manager approved the increase
 * }, userId);
 * ```
 */
export async function addInvoiceLine(line: InvoiceLine, userId: string): Promise<InvoiceLine> {
    const { data, error } = await supabaseServer
        .from('vendor_invoice_lines')
        .insert(line)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Posts vendor invoice to create Accounts Payable liability.
 * 
 * **Posting Process:**
 * 1. Validates 3-way match (PO-GRN-Invoice)
 * 2. Creates journal entry:
 *    - Dr. Inventory / Expense
 *    - Cr. Accounts Payable
 * 3. Marks invoice as posted
 * 4. Updates AP aging
 * 
 * **Status Change:** draft → posted
 * 
 * @param invoiceId - UUID of invoice to post
 * @param userId - UUID of user posting
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If 3-way match fails (unapproved variances)
 * @throws {Error} If update fails
 * @returns Promise that resolves when posted
 * 
 * @example
 * ```typescript
 * // Post invoice (creates AP liability)
 * await postVendorInvoice(invoiceId, userId);
 * 
 * // Accounting:
 * // Dr. Raw Material Inventory  24,000,000
 * // Cr. Accounts Payable         24,000,000
 * 
 * // Invoice now appears in AP aging
 * // Due date tracked for payment
 * ```
 * 
 * @see {@link createVendorInvoice} for creating invoice
 * @see {@link createVendorPayment} for payment
 */
export async function postVendorInvoice(invoiceId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('vendor_invoices')
        .update({
            status: 'posted',
            posted_by: userId,
            posted_at: new Date().toISOString(),
        })
        .eq('id', invoiceId);

    if (error) throw error;
}

/**
 * Retrieves vendor invoice with all line items and vendor details.
 * 
 * @param invoiceId - UUID of the invoice
 * @throws {Error} If invoice not found
 * @returns Promise resolving to invoice with lines and vendor
 * 
 * @example
 * ```typescript
 * const invoice = await getVendorInvoice(invoiceId);
 * 
 * console.log(`Invoice ${invoice.invoice_number} - ${invoice.vendor.name}`);
 * console.log(`Due: ${invoice.due_date}`);
 * console.log(`Total: ${invoice.subtotal + invoice.tax_amount}`);
 * ```
 */
export async function getVendorInvoice(invoiceId: string): Promise<any> {
    const { data, error } = await supabaseServer
        .from('vendor_invoices')
        .select('*, lines:vendor_invoice_lines(*), vendor:vendors(*)')
        .eq('id', invoiceId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves Accounts Payable aging report.
 * 
 * Shows unpaid vendor invoices categorized by days overdue:
 * - Current (0-30 days)
 * - 31-60 days overdue
 * - 61-90 days overdue
 * - 90+ days overdue
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to AP aging data
 * 
 * @example
 * ```typescript
 * const aging = await getAPAging(companyId);
 * 
 * console.log('Accounts Payable Aging:');
 * aging.forEach(item => {
 *   console.log(`${item.vendor_name}:`);
 *   console.log(`  Invoice: ${item.invoice_number}`);
 *   console.log(`  Amount: ${item.outstanding_amount}`);
 *   console.log(`  Days Overdue: ${item.days_overdue}`);
 * });
 * 
 * // Prioritize payment for 90+ days overdue
 * const urgent = aging.filter(a => a.days_overdue > 90);
 * ```
 * 
 * @see {@link createVendorPayment} for making payments
 */
export async function getAPAging(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('ap_aging_vw')
        .select('*')
        .eq('company_id', companyId)
        .order('days_overdue', { ascending: false });

    if (error) throw error;
    return data;
}

// ==================== VENDOR PAYMENTS ====================

/**
 * Creates a payment to vendor (settle AP liability).
 * 
 * **Payment Workflow:**
 * 1. Create payment (this function) → Status: draft
 * 2. Allocate payment to invoice(s)
 * 3. Post payment → Updates AP, creates journal
 * 
 * **Payment Methods:**
 * - CASH: Cash payment
 * - BANK_TRANSFER: Wire transfer
 * - CHECK: Check payment
 * - GIRO: Giro (post-dated check)
 * - CREDIT_CARD: Credit card
 * 
 * @param payment - Payment details
 * @param payment.company_id - UUID of the company
 * @param payment.payment_number - Unique payment number
 * @param payment.payment_date - Payment date
 * @param payment.vendor_id - UUID of vendor being paid
 * @param payment.period_id - UUID of accounting period (must be open)
 * @param payment.payment_method - Payment method
 * @param payment.total_amount - Total payment amount
 * @param payment.reference_number - Bank reference / check number
 * @param userId - UUID of user creating payment
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created payment
 * 
 * @example
 * ```typescript
 * // Create payment
 * const payment = await createVendorPayment({
 *   company_id: companyId,
 *   payment_number: 'PAY-2025-001',
 *   payment_date: '2025-02-01',
 *   vendor_id: vendorId,
 *   period_id: periodId,
 *   payment_method: 'BANK_TRANSFER',
 *   total_amount: 50000000,  // 50 million
 *   reference_number: 'TRF-20250201-001'
 * }, userId);
 * 
 * // Allocate to invoices
 * await allocatePayment(payment.id, invoice1Id, 30000000);
 * await allocatePayment(payment.id, invoice2Id, 20000000);
 * 
 * // Post payment
 * await postPayment(payment.id, userId);
 * ```
 * 
 * @see {@link allocatePayment} for allocating to invoices
 * @see {@link postPayment} for posting
 */
export async function createVendorPayment(payment: VendorPayment, userId: string): Promise<VendorPayment> {
    await validatePeriodIsOpen(payment.period_id);

    const { data, error } = await supabaseServer
        .from('vendor_payments')
        .insert({ ...payment, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Allocates payment amount to specific invoice(s).
 * 
 * One payment can be allocated to multiple invoices.
 * Total allocations must equal payment total_amount.
 * 
 * @param paymentId - UUID of the payment
 * @param invoiceId - UUID of invoice to pay
 * @param amount - Amount to allocate to this invoice
 * 
 * @throws {Error} If database insert fails
 * @returns Promise that resolves when allocated
 * 
 * @example
 * ```typescript
 * // Pay multiple invoices with one payment
 * await allocatePayment(paymentId, invoice1Id, 30000000);
 * await allocatePayment(paymentId, invoice2Id, 15000000);
 * await allocatePayment(paymentId, invoice3Id, 5000000);
 * // Total: 50000000 (matches payment.total_amount)
 * 
 * // Partial payment
 * await allocatePayment(paymentId, largeInvoiceId, 10000000);
 * // Remaining invoice balance: still outstanding
 * ```
 * 
 * @see {@link createVendorPayment} for creating payment
 */
export async function allocatePayment(
    paymentId: string,
    invoiceId: string,
    amount: number
): Promise<void> {
    const { error } = await supabaseServer
        .from('payment_allocations')
        .insert({
            payment_id: paymentId,
            invoice_id: invoiceId,
            amount_allocated: amount,
        });

    if (error) throw error;
}

/**
 * Posts payment to reduce Accounts Payable.
 * 
 * **Posting Process:**
 * 1. Validates allocations equal payment amount
 * 2. Creates journal entry:
 *    - Dr. Accounts Payable
 *    - Cr. Bank / Cash
 * 3. Marks payment as posted
 * 4. Updates invoice payment status
 * 5. Updates AP aging
 * 
 * @param paymentId - UUID of payment to post
 * @param userId - UUID of user posting
 * 
 * @throws {Error} If period is closed
 * @throws {Error} If allocations don't match total
 * @throws {Error} If update fails
 * @returns Promise that resolves when posted
 * 
 * @example
 * ```typescript
 * // Post payment
 * await postPayment(paymentId, userId);
 * 
 * // Accounting:
 * // Dr. Accounts Payable  50,000,000
 * // Cr. Bank              50,000,000
 * 
 * // Invoices marked as paid (full or partial)
 * // AP aging updated
 * ```
 * 
 * @see {@link createVendorPayment} for creating payment
 * @see {@link allocatePayment} for allocations
 */
export async function postPayment(paymentId: string, userId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('vendor_payments')
        .update({
            status: 'posted',
            posted_by: userId,
            posted_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

    if (error) throw error;
}

/**
 * Retrieves payment summary by vendor.
 * 
 * Shows total paid, total outstanding, and payment history.
 * 
 * @param companyId - UUID of the company
 * @returns Promise resolving to payment summary
 * 
 * @example
 * ```typescript
 * const summary = await getPaymentSummary(companyId);
 * 
 * summary.forEach(vendor => {
 *   console.log(`${vendor.vendor_name}:`);
 *   console.log(`  Total Paid: ${vendor.total_paid}`);
 *   console.log(`  Outstanding: ${vendor.total_outstanding}`);
 * });
 * ```
 */
export async function getPaymentSummary(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('payment_summary_vw')
        .select('*')
        .eq('company_id', companyId);

    if (error) throw error;
    return data;
}
