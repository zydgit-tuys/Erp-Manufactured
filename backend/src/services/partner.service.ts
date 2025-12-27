/**
 * Partner Service
 * Manages business partners: vendors (suppliers) and customers
 * 
 * Vendors supply materials and products. Customers purchase finished goods.
 * Includes customer-specific pricing with time-based validity.
 */
import { supabaseServer } from '../config/supabase';

export interface Vendor {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    tax_id?: string;
    payment_terms?: string; // e.g., 'Net 30', 'COD'
    credit_limit?: number;
    is_blocked?: boolean;
    blocked_reason?: string;
    is_active?: boolean;
}

export interface Customer {
    id?: string;
    company_id: string;
    code: string;
    name: string;
    type: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'ONLINE';
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    tax_id?: string;
    payment_terms?: string;
    credit_limit?: number;
    is_blocked?: boolean;
    blocked_reason?: string;
    is_active?: boolean;
}

export interface CustomerPriceList {
    id?: string;
    company_id: string;
    customer_id: string;
    product_variant_id: string;
    unit_price: number;
    effective_from: string;
    effective_to?: string;
    is_active?: boolean;
}

// ==================== VENDORS ====================

/**
 * Creates a new vendor (supplier).
 * 
 * Vendors provide materials and products to the company. Track:
 * - Payment terms for AP management
 * - Credit limits for purchase approval
 * - Block status for suspended vendors
 * 
 * @param vendor - Vendor details
 * @param vendor.company_id - UUID of the company
 * @param vendor.code - Unique vendor code (e.g., 'VEN-001')
 * @param vendor.name - Vendor company name
 * @param vendor.contact_person - Primary contact name
 * @param vendor.email - Vendor email
 * @param vendor.phone - Vendor phone
 * @param vendor.payment_terms - Payment terms (e.g., 'Net 30', 'Net 60', 'COD')
 * @param vendor.credit_limit - Maximum outstanding payables allowed
 * @param userId - UUID of user creating the vendor
 * 
 * @throws {Error} If vendor code not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created vendor
 * 
 * @example
 * ```typescript
 * const vendor = await createVendor({
 *   company_id: companyId,
 *   code: 'VEN-FABRIC-INDO',
 *   name: 'Indonesia Fabric Supplier',
 *   contact_person: 'Ahmad Yani',
 *   email: 'sales@fabricsupplier.co.id',
 *   phone: '+62-21-1234567',
 *   payment_terms: 'Net 30',
 *   credit_limit: 100000000,  // 100 million IDR
 *   is_blocked: false
 * }, userId);
 * ```
 * 
 * @see {@link blockVendor} for blocking vendors
 * @see {@link getAllVendors} for listing vendors
 */
export async function createVendor(vendor: Vendor, userId: string): Promise<Vendor> {
    const { data, error } = await supabaseServer
        .from('vendors')
        .insert({ ...vendor, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a vendor by its unique ID.
 * 
 * @param vendorId - UUID of the vendor
 * @throws {Error} If vendor not found
 * @returns Promise resolving to vendor record
 * 
 * @example
 * ```typescript
 * const vendor = await getVendorById(vendorId);
 * console.log(`${vendor.name} - Payment: ${vendor.payment_terms}`);
 * ```
 */
export async function getVendorById(vendorId: string): Promise<Vendor> {
    const { data, error } = await supabaseServer
        .from('vendors')
        .select('*')
        .eq('id', vendorId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active vendors for a company.
 * 
 * Returns vendors ordered by code. Excludes blocked vendors unless
 * specifically requested. Use for dropdowns, vendor selection in
 * purchase orders, and vendor reports.
 * 
 * **Caching Recommended:** Vendor data changes infrequently (TTL: 1800s)
 * 
 * @param companyId - UUID of the company
 * @param includeBlocked - If true, includes blocked vendors (default: false)
 * 
 * @returns Promise resolving to array of vendors
 * 
 * @example
 * ```typescript
 * // Get active, unblocked vendors
 * const vendors = await getAllVendors(companyId);
 * 
 * // Populate vendor dropdown in PO
 * vendors.forEach(v => {
 *   console.log(`${v.code} - ${v.name}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Get all vendors including blocked (for reports)
 * const allVendors = await getAllVendors(companyId, true);
 * ```
 */
export async function getAllVendors(
    companyId: string,
    includeBlocked: boolean = false
): Promise<Vendor[]> {
    let query = supabaseServer
        .from('vendors')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

    if (!includeBlocked) {
        query = query.eq('is_blocked', false);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

/**
 * Updates vendor details.
 * 
 * Common updates:
 * - Payment terms changes
 * - Credit limit adjustments
 * - Contact information updates
 * - Tax ID updates
 * 
 * @param vendorId - UUID of vendor to update
 * @param updates - Partial vendor object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated vendor
 * 
 * @example
 * ```typescript
 * // Update payment terms and credit limit
 * const updated = await updateVendor(vendorId, {
 *   payment_terms: 'Net 45',
 *   credit_limit: 150000000
 * });
 * ```
 */
export async function updateVendor(vendorId: string, updates: Partial<Vendor>): Promise<Vendor> {
    const { data, error } = await supabaseServer
        .from('vendors')
        .update(updates)
        .eq('id', vendorId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Blocks a vendor from being used in new transactions.
 * 
 * Blocked vendors cannot be selected in new purchase orders.
 * Existing transactions remain unaffected. Common reasons:
 * - Quality issues
 * - Payment disputes
 * - Breach of contract
 * - Temporary suspension
 * 
 * @param vendorId - UUID of vendor to block
 * @param reason - Reason for blocking (for audit trail)
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * await blockVendor(vendorId, 'Quality issues - received defective materials');
 * 
 * // Vendor is now blocked
 * const vendor = await getVendorById(vendorId);
 * console.log(vendor.is_blocked); // true
 * console.log(vendor.blocked_reason); // "Quality issues..."
 * ```
 * 
 * @see {@link unblockVendor} for unblocking
 */
export async function blockVendor(vendorId: string, reason: string): Promise<void> {
    const { error } = await supabaseServer
        .from('vendors')
        .update({
            is_blocked: true,
            blocked_reason: reason,
        })
        .eq('id', vendorId);

    if (error) throw error;
}

/**
 * Unblocks a previously blocked vendor.
 * 
 * Removes blocking status, allowing vendor to be used in new transactions.
 * The blocked_reason is cleared.
 * 
 * @param vendorId - UUID of vendor to unblock
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // Issue resolved, unblock vendor
 * await unblockVendor(vendorId);
 * 
 * const vendor = await getVendorById(vendorId);
 * console.log(vendor.is_blocked); // false
 * ```
 * 
 * @see {@link blockVendor} for blocking vendors
 */
export async function unblockVendor(vendorId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('vendors')
        .update({
            is_blocked: false,
            blocked_reason: null,
        })
        .eq('id', vendorId);

    if (error) throw error;
}

// ==================== CUSTOMERS ====================

/**
 * Creates a new customer.
 * 
 * Customers purchase finished goods. Categorized by type:
 * - RETAIL: Individual consumers (walk-in, one-time)
 * - WHOLESALE: Bulk buyers (recurring, volume discounts)
 * - DISTRIBUTOR: Resellers (special pricing, consignment)
 * - ONLINE: E-commerce customers (marketplace integration)
 * 
 * @param customer - Customer details
 * @param customer.company_id - UUID of the company
 * @param customer.code - Unique customer code (e.g., 'CUS-001')
 * @param customer.name - Customer name or company name
 * @param customer.type - Customer type (RETAIL/WHOLESALE/DISTRIBUTOR/ONLINE)
 * @param customer.contact_person - Primary contact (for corporate customers)
 * @param customer.email - Customer email
 * @param customer.phone - Customer phone
 * @param customer.payment_terms - Payment terms (e.g., 'COD', 'Net 14')
 * @param customer.credit_limit - Maximum outstanding receivables
 * @param userId - UUID of user creating the customer
 * 
 * @throws {Error} If customer code not unique
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created customer
 * 
 * @example
 * ```typescript
 * // Create wholesale customer
 * const customer = await createCustomer({
 *   company_id: companyId,
 *   code: 'CUS-WHOLESALE-001',
 *   name: 'Fashion Boutique Jakarta',
 *   type: 'WHOLESALE',
 *   contact_person: 'Siti Nurhaliza',
 *   email: 'siti@boutique.com',
 *   phone: '+62-812-3456-7890',
 *   payment_terms: 'Net 14',
 *   credit_limit: 50000000  // 50 million IDR
 * }, userId);
 * ```
 * 
 * @example
 * ```typescript
 * // Create retail customer (walk-in)
 * const retailCustomer = await createCustomer({
 *   company_id: companyId,
 *   code: 'CUS-RETAIL-WALKIN',
 *   name: 'Walk-in Customer',
 *   type: 'RETAIL',
 *   payment_terms: 'COD'
 * }, userId);
 * ```
 * 
 * @see {@link getCustomersByType} for filtering by type
 * @see {@link createCustomerPriceList} for custom pricing
 */
export async function createCustomer(customer: Customer, userId: string): Promise<Customer> {
    const { data, error } = await supabaseServer
        .from('customers')
        .insert({ ...customer, created_by: userId })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves a customer by its unique ID.
 * 
 * @param customerId - UUID of the customer
 * @throws {Error} If customer not found
 * @returns Promise resolving to customer record
 * 
 * @example
 * ```typescript
 * const customer = await getCustomerById(customerId);
 * console.log(`${customer.name} (${customer.type})`);
 * console.log(`Credit Limit: ${customer.credit_limit}`);
 * ```
 */
export async function getCustomerById(customerId: string): Promise<Customer> {
    const { data, error } = await supabaseServer
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves all active customers for a company.
 * 
 * Returns customers ordered by code. Excludes blocked customers
 * unless specifically requested.
 * 
 * **Caching Recommended:** Customer data changes infrequently (TTL: 1800s)
 * 
 * @param companyId - UUID of the company
 * @param includeBlocked - If true, includes blocked customers (default: false)
 * 
 * @returns Promise resolving to array of customers
 * 
 * @example
 * ```typescript
 * // Get active customers for POS
 * const customers = await getAllCustomers(companyId);
 * 
 * // Customer selection dropdown
 * customers.forEach(c => {
 *   console.log(`${c.code} - ${c.name} (${c.type})`);
 * });
 * ```
 */
export async function getAllCustomers(
    companyId: string,
    includeBlocked: boolean = false
): Promise<Customer[]> {
    let query = supabaseServer
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');

    if (!includeBlocked) {
        query = query.eq('is_blocked', false);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
}

/**
 * Retrieves customers filtered by type.
 * 
 * Use this to segment customers for reporting, targeted marketing,
 * or type-specific pricing strategies.
 * 
 * @param companyId - UUID of the company
 * @param customerType - Customer type to filter by
 * 
 * @returns Promise resolving to array of customers
 * 
 * @example
 * ```typescript
 * // Get all wholesale customers for special promotion
 * const wholesale = await getCustomersByType(companyId, 'WHOLESALE');
 * 
 * console.log(`${wholesale.length} wholesale customers`);
 * 
 * // Apply bulk discount to all wholesale customers
 * for (const customer of wholesale) {
 *   await createCustomerPriceList({
 *     customer_id: customer.id,
 *     product_variant_id: variantId,
 *     unit_price: basePrice * 0.85,  // 15% discount
 *     effective_from: '2025-01-01'
 *   });
 * }
 * ```
 * 
 * @see {@link getAllCustomers} for all customers
 */
export async function getCustomersByType(
    companyId: string,
    customerType: Customer['type']
): Promise<Customer[]> {
    const { data, error } = await supabaseServer
        .from('customers')
        .select('*')
        .eq('company_id', companyId)
        .eq('type', customerType)
        .eq('is_active', true)
        .eq('is_blocked', false)
        .order('code');

    if (error) throw error;
    return data;
}

/**
 * Updates customer details.
 * 
 * @param customerId - UUID of customer to update
 * @param updates - Partial customer object with fields to update
 * 
 * @throws {Error} If update fails
 * @returns Promise resolving to updated customer
 * 
 * @example
 * ```typescript
 * // Upgrade customer from RETAIL to WHOLESALE
 * const upgraded = await updateCustomer(customerId, {
 *   type: 'WHOLESALE',
 *   credit_limit: 50000000,
 *   payment_terms: 'Net 14'
 * });
 * ```
 */
export async function updateCustomer(
    customerId: string,
    updates: Partial<Customer>
): Promise<Customer> {
    const { data, error } = await supabaseServer
        .from('customers')
        .update(updates)
        .eq('id', customerId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Blocks a customer from making new purchases.
 * 
 * Blocked customers cannot be selected in new sales transactions.
 * Common reasons: credit limit exceeded, overdue payments, fraud.
 * 
 * @param customerId - UUID of customer to block
 * @param reason - Reason for blocking
 * 
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // Block customer for non-payment
 * await blockCustomer(customerId, 'Overdue invoices > 90 days');
 * ```
 * 
 * @see {@link unblockCustomer} for unblocking
 * @see {@link checkCreditLimit} for credit validation
 */
export async function blockCustomer(customerId: string, reason: string): Promise<void> {
    const { error } = await supabaseServer
        .from('customers')
        .update({
            is_blocked: true,
            blocked_reason: reason,
        })
        .eq('id', customerId);

    if (error) throw error;
}

/**
 * Unblocks a previously blocked customer.
 * 
 * @param customerId - UUID of customer to unblock
 * @throws {Error} If update fails
 * @returns Promise that resolves when complete
 * 
 * @example
 * ```typescript
 * // Payment received, unblock customer
 * await unblockCustomer(customerId);
 * ```
 */
export async function unblockCustomer(customerId: string): Promise<void> {
    const { error } = await supabaseServer
        .from('customers')
        .update({
            is_blocked: false,
            blocked_reason: null,
        })
        .eq('id', customerId);

    if (error) throw error;
}

// ==================== CUSTOMER PRICING ====================

/**
 * Creates a customer-specific price for a product variant.
 * 
 * Customer pricing enables:
 * - Volume discounts for wholesale customers
 * - Special negotiated pricing
 * - Promotional pricing with time limits
 * - Distributor pricing tiers
 * 
 * Prices can be time-bounded (effective_from, effective_to).
 * System uses customer price if available, otherwise standard price.
 * 
 * @param priceList - Customer price list entry
 * @param priceList.company_id - UUID of the company
 * @param priceList.customer_id - UUID of the customer
 * @param priceList.product_variant_id - UUID of the product variant (SKU)
 * @param priceList.unit_price - Special price for this customer
 * @param priceList.effective_from - Start date (YYYY-MM-DD)
 * @param priceList.effective_to - Optional end date (null = indefinite)
 * 
 * @throws {Error} If database insert fails
 * @returns Promise resolving to created price list entry
 * 
 * @example
 * ```typescript
 * // Create permanent wholesale price
 * await createCustomerPriceList({
 *   company_id: companyId,
 *   customer_id: wholesaleCustomerId,
 *   product_variant_id: variantId,
 *   unit_price: 85000,  // Standard: 100000
 *   effective_from: '2025-01-01'
 *   // No effective_to = permanent
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Create time-limited promotional price
 * await createCustomerPriceList({
 *   company_id: companyId,
 *   customer_id: customerId,
 *   product_variant_id: variantId,
 *   unit_price: 75000,  // 25% off
 *   effective_from: '2025-01-01',
 *   effective_to: '2025-01-31'  // January only
 * });
 * ```
 * 
 * @see {@link getCustomerPrice} for retrieving customer pricing
 */
export async function createCustomerPriceList(
    priceList: CustomerPriceList
): Promise<CustomerPriceList> {
    const { data, error } = await supabaseServer
        .from('customer_price_lists')
        .insert(priceList)
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Retrieves the customer-specific price for a product variant on a given date.
 * 
 * Checks for active customer pricing within the effective date range.
 * Returns null if no customer price exists (use standard price instead).
 * 
 * **Pricing Logic:**
 * 1. Check customer price list for variant
 * 2. Filter by effective date range
 * 3. If found, use customer price
 * 4. If not found, use product's standard price
 * 
 * @param customerId - UUID of the customer
 * @param variantId - UUID of the product variant
 * @param date - Date to check pricing (YYYY-MM-DD, default: today)
 * 
 * @returns Promise resolving to customer price or null
 * 
 * @example
 * ```typescript
 * // Get current price for customer
 * const customerPrice = await getCustomerPrice(
 *   customerId,
 *   variantId,
 *   '2025-01-15'
 * );
 * 
 * const finalPrice = customerPrice?.unit_price || variant.standard_price;
 * console.log(`Price for this customer: ${finalPrice}`);
 * ```
 * 
 * @example
 * ```typescript
 * // POS pricing logic
 * async function calculateLineTotal(customerId, variantId, qty) {
 *   const variant = await getVariantById(variantId);
 *   const customerPrice = await getCustomerPrice(customerId, variantId);
 *   
 *   const unitPrice = customerPrice?.unit_price || variant.selling_price;
 *   return qty * unitPrice;
 * }
 * ```
 * 
 * @see {@link createCustomerPriceList} for setting customer prices
 */
export async function getCustomerPrice(
    customerId: string,
    variantId: string,
    date: string = new Date().toISOString().split('T')[0]
): Promise<CustomerPriceList | null> {
    const { data, error } = await supabaseServer
        .from('customer_price_lists')
        .select('*')
        .eq('customer_id', customerId)
        .eq('product_variant_id', variantId)
        .eq('is_active', true)
        .lte('effective_from', date)
        .or(`effective_to.is.null,effective_to.gte.${date}`)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Validates customer credit limit before processing sale (placeholder).
 * 
 * **Implementation Required:**
 * - Query accounts receivable aging
 * - Calculate total outstanding balance
 * - Compare against customer.credit_limit
 * - Reject if limit exceeded
 * 
 * Currently returns true (no validation). Should integrate with
 * AR ledger once implemented.
 * 
 * @param customerId - UUID of the customer
 * @param newSaleAmount - Amount of the new sale
 * 
 * @returns Promise resolving to true if within limit, false if exceeded
 * 
 * @example
 * ```typescript
 * // Check credit before creating sale
 * const canSell = await checkCreditLimit(customerId, 10000000);
 * 
 * if (!canSell) {
 *   throw new Error('Customer credit limit exceeded');
 * }
 * 
 * await createSalesOrder({ customer_id: customerId, ... });
 * ```
 * 
 * @todo Implement AR balance calculation
 * @see {@link blockCustomer} for blocking over-limit customers
 */
export async function checkCreditLimit(
    customerId: string,
    newSaleAmount: number
): Promise<boolean> {
    // TODO: Implement AR balance calculation
    // const arBalance = await getARBalance(customerId);
    // const customer = await getCustomerById(customerId);
    // return (arBalance + newSaleAmount) <= customer.credit_limit;

    return true; // Placeholder - always allow
}
