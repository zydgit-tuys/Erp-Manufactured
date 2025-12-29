import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

import { SalesOrder, SalesOrderLine, CreateSOPayload, POSOrderPayload } from '@/types/sales';

// Hook for fetching Sales Orders
export const useSalesOrders = (companyId: string) => {
    return useQuery({
        queryKey: ['sales-orders', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales_orders')
                .select(`
                    *,
                    customer:customers(name, email)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as SalesOrder[];
        },
        enabled: !!companyId
    });
};

// Hook for fetching a single Sales Order
export const useSalesOrder = (id: string) => {
    return useQuery({
        queryKey: ['sales-order', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales_orders')
                .select(`
                    *,
                    customer:customers(name, email),
                    lines:sales_order_lines(
                        *,
                        product_variant:product_variants(
                            sku,
                            product:products(name),
                            attributes
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as SalesOrder;
        },
        enabled: !!id
    });
};

// Hook for creating a Sales Order
export const useCreateSalesOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async (orderData: CreateSOPayload) => {
            // 1. Get Open Accounting Period
            const { data: period, error: periodError } = await supabase
                .from('accounting_periods')
                .select('id')
                .eq('company_id', companyId)
                .lte('start_date', orderData.so_date)
                .gte('end_date', orderData.so_date)
                .eq('is_closed', false)
                .single();

            if (periodError || !period) {
                throw new Error('No open accounting period found for this date.');
            }

            // 2. Generate SO Number
            const soNumber = `SO-${Date.now().toString().slice(-6)}`;

            // 3. Create Header
            const { data: so, error: soError } = await supabase
                .from('sales_orders')
                .insert({
                    company_id: companyId,
                    so_number: soNumber,
                    so_date: orderData.so_date,
                    customer_id: orderData.customer_id,
                    warehouse_id: orderData.warehouse_id,
                    period_id: period.id,
                    notes: orderData.notes,
                    status: 'draft' // Default status
                })
                .select()
                .single();

            if (soError) throw soError;

            // 4. Create Lines
            const lines = orderData.items.map((item, index) => ({
                so_id: so.id,
                line_number: index + 1,
                product_variant_id: item.variant_id,
                qty_ordered: item.qty,
                unit_price: item.price,
                discount_percentage: item.discount || 0
            }));

            const { error: linesError } = await supabase
                .from('sales_order_lines')
                .insert(lines);

            if (linesError) throw linesError;

            return so;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
            toast({
                title: 'Sales Order created',
                description: 'The order has been saved as draft.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Failed to create order',
                description: error.message,
                variant: 'destructive',
            });
        },
    });
};

// Hook for confirming/approving a Sales Order
export const useApproveSalesOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { userId } = useApp();

    return useMutation({
        mutationFn: async (id: string) => {
            // We can call the backend function 'approve_sales_order' 
            // BUT for now, direct update if RLS allows, or use the RPC function found in migration 022

            // Using RPC function from 022_sales_orders.sql
            const { error } = await supabase.rpc('approve_sales_order', {
                p_so_id: id,
                p_user_id: userId
            });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
            queryClient.invalidateQueries({ queryKey: ['sales-order'] });
            toast({
                title: 'Order Approved',
                description: 'Sales order has been confirmed.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Approval Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    });
};

// Hook for submitting a POS Order
export const useSubmitPOSOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { userId, companyId } = useApp();

    return useMutation({
        mutationFn: async (orderData: POSOrderPayload) => {
            // 1. Get Open Accounting Period
            const { data: period, error: periodError } = await supabase
                .from('accounting_periods')
                .select('id')
                .eq('company_id', companyId)
                .lte('start_date', orderData.sale_date)
                .gte('end_date', orderData.sale_date)
                .eq('status', 'open')
                .single();

            if (periodError || !period) {
                throw new Error('No open accounting period found for this date.');
            }

            // 2. Generate POS Number
            const posNumber = `POS-${Date.now().toString().slice(-6)}`;

            // 3. Create Header
            const { data: pos, error: posError } = await supabase
                .from('sales_pos')
                .insert({
                    company_id: companyId,
                    pos_number: posNumber,
                    sale_date: orderData.sale_date,
                    warehouse_id: orderData.warehouse_id,
                    period_id: period.id,
                    payment_method: orderData.payment_method,
                    amount_tendered: orderData.amount_tendered,
                    notes: orderData.notes,
                    status: 'completed' // Initial status
                })
                .select()
                .single();

            if (posError) throw posError;

            // 4. Create Lines
            const lines = orderData.items.map((item, index) => ({
                pos_id: pos.id,
                line_number: index + 1,
                product_variant_id: item.variant_id,
                qty: item.qty,
                unit_price: item.price,
                discount_percentage: item.discount || 0
            }));

            const { error: linesError } = await supabase
                .from('sales_pos_lines')
                .insert(lines);

            if (linesError) throw linesError;

            // 5. Post Sale (Inventory Update)
            // Using RPC function from 020_sales_pos.sql
            const { error: postError } = await supabase.rpc('post_pos_sale', {
                p_pos_id: pos.id,
                p_user_id: userId
            });

            if (postError) throw postError;

            return pos;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pos-sales'] }); // If we had a list view
            // Also invalidate inventory
            queryClient.invalidateQueries({ queryKey: ['fg-balances'] });
            toast({
                title: 'Sale Completed',
                description: 'Transaction recorded and inventory updated.',
            });
        },
        onError: (error) => {
            toast({
                title: 'Transaction Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    });
};

