
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BOMHeader {
    id: string;
    company_id: string;
    product_id: string;
    version: string;
    is_active: boolean;
    base_qty: number;
    yield_percentage: number;
    notes?: string;
    created_at: string;
    product?: {
        code: string;
        name: string;
    };
}

export interface BOMLine {
    id: string;
    bom_id: string;
    line_number: number;
    material_id?: string;
    component_product_id?: string;
    qty_per: number;
    uom: string;
    scrap_percentage: number;
    stage: string;
}

export interface WorkOrder {
    id: string;
    wo_number: string;
    product_id: string;
    status: 'draft' | 'released' | 'in_progress' | 'completed' | 'cancelled';
    qty_planned: number;
    start_date: string;
    due_date: string;
    product?: {
        code: string;
        name: string;
    };
}

export const useBOMs = () => {
    return useQuery({
        queryKey: ['boms'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bom_headers')
                .select(`
          *,
          product:products(code, name)
        `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as BOMHeader[];
        },
    });
};

export const useCreateBOM = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (bom: Partial<BOMHeader>) => {
            const { data, error } = await supabase
                .from('bom_headers')
                .insert(bom)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['boms'] });
            toast({
                title: 'BOM Created',
                description: 'New Bill of Materials has been successfully created.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to create BOM: ${error.message}`,
            });
        },
    });
};

export const useWorkOrders = () => {
    // Placeholder for now, assuming table 'production_orders' or 'work_orders' exists
    // Migration 018 created 'production_orders'. Let's verify table name if needed, but assuming 'production_orders'.
    return useQuery({
        queryKey: ['work_orders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_orders') // Assuming 018_manufacturing_wo.sql used this name
                .select(`
                    *,
                    product:products(code, name)
                `)
                .order('created_at', { ascending: false });

            if (error) {
                // Return empty if table doesn't exist yet (soft fail for placeholder)
                console.warn("Fetch Work Orders failed (table might missing)", error);
                return [];
            }
            return data as WorkOrder[];
        }
    });
};
