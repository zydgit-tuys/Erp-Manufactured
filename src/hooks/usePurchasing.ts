
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

export interface PurchaseOrder {
    id: string;
    company_id: string;
    po_number: string;
    po_date: string;
    vendor_id: string;
    warehouse_id: string;
    status: 'draft' | 'submitted' | 'approved' | 'partial' | 'closed' | 'cancelled';
    total_amount: number;
    delivery_date?: string;
    notes?: string;
    vendor?: {
        name: string;
        code: string;
    };
    created_at: string;
}

export interface PurchaseOrderLine {
    id: string;
    po_id: string;
    material_id: string;
    qty_ordered: number;
    qty_received: number;
    qty_invoiced: number;
    unit_price: number;
    line_total: number;
    material?: {
        name: string;
        code: string;
        unit_of_measure: string;
    };
}

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
                description: error.message,
            });
        },
    });
};

export const useUpdatePOLine = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, qty_received }: { id: string, qty_received: number }) => {
            // First get current qty to increment? Or we replace?
            // Usually we want to increment. But here we might just set the total received?
            // Let's assume the UI manages the TOTAL received or the DELTA.
            // The UI in ReceiveGoods.tsx calculates 'receivedItems' which seems to be the DELTA (amount being received NOW).
            // So we need to fetch current, add delta, and update.

            // 1. Fetch current line
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

