import { supabaseServer } from '../config/supabase';
import { SalesOrder } from './sales-distributor.service';
import { createSalesOrder, addSOLine } from './sales-distributor.service';

// Types
export type MarketplacePlatform = 'Shopee' | 'Tokopedia' | 'TikTok' | 'Lazada';
export type SyncStatus = 'pending' | 'synced' | 'failed' | 'ignored';

export interface MarketplaceAccount {
    id?: string;
    company_id: string;
    platform: MarketplacePlatform;
    account_name: string;
    shop_id: string;
    api_key?: string;
    api_secret?: string;
    access_token?: string;
    auto_sync_orders?: boolean;
    auto_sync_inventory?: boolean;
    warehouse_id?: string;
    is_active?: boolean;
}

export interface ExternalOrder {
    external_id: string;
    external_status: string;
    order_date: string;
    customer_name: string;
    currency: string;
    total_amount: number;
    shipping_fee: number;
    items: ExternalOrderItem[];
}

export interface ExternalOrderItem {
    external_item_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    original_price: number;
    deal_price: number;
}

// ==================== ACCOUNT MANAGEMENT ====================

/**
 * Connects a new marketplace account.
 * In a real scenario, this would involve OAuth flow steps.
 */
export async function connectAccount(
    account: MarketplaceAccount,
    userId: string
): Promise<MarketplaceAccount> {
    const { data, error } = await supabaseServer
        .from('marketplace_accounts')
        .insert({
            ...account,
            created_by: userId
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function getAccounts(companyId: string): Promise<MarketplaceAccount[]> {
    const { data, error } = await supabaseServer
        .from('marketplace_accounts')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);

    if (error) throw error;
    return data || [];
}

// ==================== ORDER SYNC ====================

/**
 * Simulates syncing orders from an external marketplace.
 * In production, this would call Shopee/Tokopedia Open API.
 */
export async function syncOrders(
    accountId: string,
    userId: string
): Promise<{ synced: number, errors: number }> {
    // 1. Get account details
    const { data: account, error: accError } = await supabaseServer
        .from('marketplace_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (accError || !account) throw new Error('Account not found');

    // MOCK: Fetch orders from external API
    // const externalOrders = await shopeeApi.getOrders(account.access_token);
    const mockExternalOrders: ExternalOrder[] = [
        {
            external_id: `ORD-${Date.now()}-01`,
            external_status: 'READY_TO_SHIP',
            order_date: new Date().toISOString(),
            customer_name: 'Budi Santoso (Masked)',
            currency: 'IDR',
            total_amount: 150000,
            shipping_fee: 10000,
            items: [
                {
                    external_item_id: `ITM-${Date.now()}-A`,
                    sku: 'TSHIRT-BLK-L', // Assumes this matches local SKU
                    product_name: 'Kaos Polos Black L',
                    quantity: 2,
                    original_price: 75000,
                    deal_price: 70000
                }
            ]
        }
    ];

    let syncedCount = 0;
    let errorCount = 0;

    for (const extOrder of mockExternalOrders) {
        try {
            await processMarketplaceOrder(account.company_id, accountId, extOrder, userId);
            syncedCount++;
        } catch (err) {
            console.error(`Failed to sync order ${extOrder.external_id}:`, err);
            errorCount++;
        }
    }

    return { synced: syncedCount, errors: errorCount };
}

/**
 * Saves marketplace order and optionally converts to internal SO.
 */
async function processMarketplaceOrder(
    companyId: string,
    accountId: string,
    extOrder: ExternalOrder,
    userId: string
): Promise<string> {
    // 1. Insert into marketplace_orders
    const { data: mpOrder, error: mpError } = await supabaseServer
        .from('marketplace_orders')
        .upsert({
            company_id: companyId,
            account_id: accountId,
            external_order_id: extOrder.external_id,
            external_status: extOrder.external_status,
            mapped_status: mapStatus(extOrder.external_status),
            order_date: extOrder.order_date,
            customer_name: extOrder.customer_name,
            total_amount: extOrder.total_amount,
            shipping_fee: extOrder.shipping_fee,
            sync_status: 'pending'
        }, { onConflict: 'account_id, external_order_id' })
        .select()
        .single();

    if (mpError) throw mpError;

    // 2. Insert items
    // First clear existing items if any (full replace strategy)
    await supabaseServer
        .from('marketplace_order_items')
        .delete()
        .eq('order_id', mpOrder.id);

    for (const item of extOrder.items) {
        // Try to find matching internal product variant by SKU
        const { data: variant } = await supabaseServer
            .from('product_variants')
            .select('id')
            .eq('company_id', companyId) // Ensure tenant isolation
            .eq('sku', item.sku)
            .single();

        await supabaseServer
            .from('marketplace_order_items')
            .insert({
                order_id: mpOrder.id,
                external_item_id: item.external_item_id,
                sku: item.sku,
                product_name: item.product_name,
                quantity: item.quantity,
                original_price: item.original_price,
                deal_price: item.deal_price,
                product_variant_id: variant?.id || null // Link if found
            });
    }

    // 3. Auto-convert to Sales Order if linked product exists and settings allow
    // In a full implementation, check account.auto_sync_orders setting
    if (mpOrder.sync_status === 'pending') {
        try {
            const soId = await mapOrderToSO(mpOrder.id, userId);

            // Link SO
            await supabaseServer
                .from('marketplace_orders')
                .update({
                    so_id: soId,
                    sync_status: 'synced'
                })
                .eq('id', mpOrder.id);
        } catch (err) {
            await supabaseServer
                .from('marketplace_orders')
                .update({
                    sync_status: 'failed',
                    sync_error: (err as Error).message
                })
                .eq('id', mpOrder.id);
        }
    }

    return mpOrder.id;
}

/**
 * Creates an internal Sales Order from a Marketplace Order.
 */
async function mapOrderToSO(mpOrderId: string, userId: string): Promise<string> {
    // Fetch MP order with items
    const { data: mpOrder, error } = await supabaseServer
        .from('marketplace_orders')
        .select('*, items:marketplace_order_items(*), account:marketplace_accounts(warehouse_id)')
        .eq('id', mpOrderId)
        .single();

    if (error || !mpOrder) throw new Error('Marketplace order not found');

    // Validations
    if (!mpOrder.account.warehouse_id) {
        throw new Error('No default warehouse mapped for this account');
    }

    // Get generic "Marketplace Customer" or create one
    // Ideally look up by name, but for MVP use a generic placeholder or find existing
    const { data: customer } = await supabaseServer
        .from('customers')
        .select('id')
        .eq('company_id', mpOrder.company_id)
        .eq('customer_type', 'Marketplace') // Assuming this type exists
        .limit(1)
        .single();

    // Fallback: If no marketplace customer exists, we might need to create one or error
    // For this MVP service layer, let's assume one exists or pick the first active customer for demo
    // In production: Create specific customer record per platform
    let customerId = customer?.id;
    if (!customerId) {
        const { data: anyCust } = await supabaseServer
            .from('customers')
            .select('id')
            .eq('company_id', mpOrder.company_id)
            .limit(1)
            .single();
        customerId = anyCust?.id;
    }

    if (!customerId) throw new Error('No customer found to map order to');

    // Create SO header
    // TODO: Need period_id. For now fetching open period.
    const { data: period } = await supabaseServer
        .from('accounting_periods')
        .select('id')
        .eq('company_id', mpOrder.company_id)
        .eq('status', 'open')
        .lte('start_date', mpOrder.order_date)
        .gte('end_date', mpOrder.order_date)
        .single();

    // Fallback period logic could go here
    const periodId = period?.id;
    if (!periodId) throw new Error('No open accounting period for order date');

    const so = await createSalesOrder({
        company_id: mpOrder.company_id,
        so_number: `SO-${mpOrder.external_order_id}`, // Use ext ID or generate new
        so_date: new Date(mpOrder.order_date).toISOString().split('T')[0],
        customer_id: customerId,
        warehouse_id: mpOrder.account.warehouse_id,
        period_id: periodId,
        payment_terms: 'COD', // Or Pre-paid logic
        delivery_date: new Date().toISOString().split('T')[0], // Immediate
        notes: `Imported from ${mpOrder.account.platform} (Ref: ${mpOrder.external_order_id})`
    }, userId);

    // Add SO Lines
    let lineNum = 1;
    for (const item of mpOrder.items) {
        if (!item.product_variant_id) {
            throw new Error(`Cannot map item ${item.sku}: Product not linked`);
        }

        await addSOLine({
            so_id: so.id!,
            line_number: lineNum++,
            product_variant_id: item.product_variant_id,
            qty_ordered: item.quantity,
            unit_price: item.deal_price, // Use deal price
            discount_percentage: 0 // Net price used
        });
    }

    return so.id!;
}

// Helper
function mapStatus(extStatus: string): 'pending' | 'ready_to_ship' | 'in_transit' | 'delivered' | 'cancelled' | 'returned' {
    const s = extStatus.toUpperCase();
    if (s === 'UNPAID') return 'pending';
    if (s === 'READY_TO_SHIP') return 'ready_to_ship';
    if (s === 'SHIPPING' || s === 'IN_TRANSIT') return 'in_transit';
    if (s === 'COMPLETED' || s === 'DELIVERED') return 'delivered';
    if (s === 'CANCELLED') return 'cancelled';
    return 'pending';
}

export async function getMarketplaceOrders(companyId: string): Promise<any[]> {
    const { data, error } = await supabaseServer
        .from('marketplace_orders')
        .select('*, account:marketplace_accounts(platform, shop_id)')
        .eq('company_id', companyId)
        .order('order_date', { ascending: false });

    if (error) throw error;
    return data || [];
}

// ==================== CSV IMPORT & RETURNS ====================

/**
 * Imports orders from parsed CSV data.
 * Useful for bulk importing history or when API sync is unavailable.
 * 
 * @param companyId - Company UUID
 * @param accountId - Marketplace Account UUID
 * @param csvData - Array of objects parsed from CSV (must have standard cols)
 * @param userId - User performing import
 */
export async function importOrdersFromCSV(
    companyId: string,
    accountId: string,
    csvData: any[],
    userId: string
): Promise<{ imported: number, failed: number }> {
    let imported = 0;
    let failed = 0;

    for (const row of csvData) {
        try {
            // Basic mapping - assumes CSV has specific headers
            // In a real app, you might need a column mapper
            const extOrder: ExternalOrder = {
                external_id: row.order_id,
                external_status: row.status || 'READY_TO_SHIP',
                order_date: row.order_date || new Date().toISOString(),
                customer_name: row.customer_name || 'Generic Customer',
                currency: row.currency || 'IDR',
                total_amount: parseFloat(row.total_amount || '0'),
                shipping_fee: parseFloat(row.shipping_fee || '0'),
                items: [
                    {
                        external_item_id: row.item_id || `${row.order_id}-1`,
                        sku: row.sku,
                        product_name: row.product_name || 'Imported Item',
                        quantity: parseInt(row.quantity || '1'),
                        original_price: parseFloat(row.original_price || '0'),
                        deal_price: parseFloat(row.deal_price || '0')
                    }
                ]
            };

            await processMarketplaceOrder(companyId, accountId, extOrder, userId);
            imported++;
        } catch (err) {
            console.error(`CSV Import Failed for row ${row.order_id}:`, err);
            failed++;
        }
    }
    return { imported, failed };
}

/**
 * Handles a marketplace return event.
 * Marks the order as returned and logs the reason.
 * In a full system, this should also trigger a Sales Return (SR) to restock inventory.
 */
export async function processMarketplaceReturn(
    orderId: string,
    reason: string,
    userId: string
): Promise<void> {
    const { data: mpOrder, error } = await supabaseServer
        .from('marketplace_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !mpOrder) throw new Error('Marketplace order not found');

    // Update status to returned
    const { error: upError } = await supabaseServer
        .from('marketplace_orders')
        .update({
            mapped_status: 'returned',
            sync_error: `Return processed: ${reason}`,
            updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

    if (upError) throw upError;

    // TODO: Trigger Sales Return creation if SO exists
}
