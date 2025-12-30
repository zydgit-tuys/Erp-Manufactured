
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/utils/errorHandler';
import { useApp } from '@/contexts/AppContext';

import {
    PurchaseOrder,
    PurchaseOrderLine,
    CreateGRNPayload,
    GoodsReceiptNote
} from '@/types/purchasing';

export interface CreatePOPayload {
    vendor_id: string;
    warehouse_id: string;
    po_date: string;
    delivery_date?: string;
    notes?: string;
    items: {
        material_id: string;
        qty_ordered: number;
        unit_price: number;
    }[];
}

export const usePurchaseOrders = (companyId: string) => {
    return useQuery({
        queryKey: ['purchase-orders', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, vendor:vendors(name, code)')
                .eq('company_id', companyId)
                .order('po_date', { ascending: false });

            if (error) throw error;
            return data as PurchaseOrder[];
        },
        enabled: !!companyId,
    });
};

export const usePurchaseOrder = (id: string) => {
    return useQuery({
        queryKey: ['purchase-order', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select('*, vendor:vendors(name, code), lines:purchase_order_lines(*, material:materials(name, code, unit_of_measure))')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as PurchaseOrder & { lines: PurchaseOrderLine[] };
        },
        enabled: !!id,
    });
};

export const useCreatePurchaseOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: CreatePOPayload) => {
            if (!companyId) throw new Error('Company ID is required');

            // 1. Get open period
            const { data: period, error: periodError } = await supabase
                .from('accounting_periods')
                .select('id')
                .eq('company_id', companyId)
                .eq('status', 'open')
                .lte('start_date', payload.po_date)
                .gte('end_date', payload.po_date)
                .single();

            if (periodError || !period) throw new Error('No open accounting period found for the PO date');

            // 2. Generate PO Number (Simple auto-increment logic or random for now)
            const poNumber = `PO-${Date.now().toString().slice(-6)}`;

            // 3. Create PO Header
            const { data: po, error: poError } = await supabase
                .from('purchase_orders')
                .insert({
                    company_id: companyId,
                    po_number: poNumber,
                    po_date: payload.po_date,
                    vendor_id: payload.vendor_id,
                    warehouse_id: payload.warehouse_id,
                    period_id: period.id,
                    created_by: userId,
                    delivery_date: payload.delivery_date,
                    notes: payload.notes
                })
                .select()
                .single();

            if (poError) throw poError;

            // 4. Create PO Lines
            const lines = payload.items.map((item, index) => ({
                po_id: po.id,
                line_number: index + 1,
                material_id: item.material_id,
                qty_ordered: item.qty_ordered,
                unit_price: item.unit_price,
            }));

            const { error: linesError } = await supabase
                .from('purchase_order_lines')
                .insert(lines);

            if (linesError) throw linesError;

            return po;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            toast({
                title: 'Purchase Order Created',
                description: 'PO has been successfully created.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Failed to create PO',
                description: handleSupabaseError(error),
            });
        },
    });
};

export const useUpdatePOLine = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, qty_received }: { id: string, qty_received: number }) => {
            const { data: line, error: fetchError } = await supabase
                .from('purchase_order_lines')
                .select('qty_received')
                .eq('id', id)
                .single();

            if (fetchError) throw fetchError;

            const newQty = (line.qty_received || 0) + qty_received;

            const { data, error } = await supabase
                .from('purchase_order_lines')
                .update({ qty_received: newQty })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        },
    });
};

export const useCreateGRN = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: CreateGRNPayload) => {
            if (!companyId) throw new Error('Company ID is required');

            // 1. Get open period
            const { data: period, error: periodError } = await supabase
                .from('accounting_periods')
                .select('id')
                .eq('company_id', companyId)
                .eq('status', 'open')
                .lte('start_date', payload.grn_date)
                .gte('end_date', payload.grn_date)
                .single();

            if (periodError || !period) throw new Error('No open accounting period found for the GRN date');

            // 2. Generate GRN Number
            const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;

            // 3. Create GRN Header
            const { data: grn, error: grnError } = await supabase
                .from('goods_receipt_notes')
                .insert({
                    company_id: companyId,
                    grn_number: grnNumber,
                    grn_date: payload.grn_date,
                    po_id: payload.po_id,
                    vendor_id: payload.vendor_id,
                    warehouse_id: payload.warehouse_id,
                    period_id: period.id,
                    created_by: userId,
                    status: 'draft',
                    delivery_note_number: payload.delivery_note_number,
                    vehicle_number: payload.vehicle_number,
                    notes: payload.notes
                })
                .select()
                .single();

            if (grnError) throw grnError;

            // 4. Create GRN Lines
            const lines = payload.items.map(item => ({
                grn_id: grn.id,
                po_line_id: item.po_line_id,
                material_id: item.material_id,
                bin_id: item.bin_id,
                qty_received: item.qty_received,
                unit_cost: item.unit_cost,
                notes: item.notes
            }));

            const { error: linesError } = await supabase
                .from('grn_lines')
                .insert(lines);

            if (linesError) throw linesError;

            return grn;
        },
        onSuccess: () => {
            // We don't toast here usually if we chain post, but it's okay
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Failed to create GRN',
                description: handleSupabaseError(error),
            });
        },
    });
};

export const usePostGRN = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { userId } = useApp();

    return useMutation({
        mutationFn: async (grnId: string) => {
            const { error } = await supabase.rpc('post_grn', {
                p_grn_id: grnId,
                p_user_id: userId
            });

            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['purchase-order'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            toast({
                title: 'GRN Posted',
                description: 'Inventory updated and PO status updated.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Failed to post GRN',
                description: handleSupabaseError(error),
            });
        },
    });
};

// ==================== AUTOMATION HOOKS ====================

export function useLastPurchasePrice(variantId?: string) {
    return useQuery({
        queryKey: ['last-purchase-price', variantId],
        queryFn: async () => {
            const { data, error } = await supabase
                .rpc('get_last_purchase_price', { p_variant_id: variantId });

            if (error) throw error;
            // RPC returns an array, we want the first (latest)
            return data && data.length > 0 ? data[0] : null;
        },
        enabled: !!variantId,
    });
}
