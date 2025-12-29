
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

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

export interface WorkCenter {
    id: string;
    code: string;
    name: string;
    capacity_per_day: number;
    cost_per_hour: number;
    is_active: boolean;
}

export interface Operation {
    id: string;
    code: string;
    name: string;
    work_center_id?: string;
    standard_time_minutes: number;
    is_active: boolean;
    work_center?: {
        name: string;
    };
}

export const useBOMs = (companyId: string) => {
    return useQuery({
        queryKey: ['boms', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bom_headers')
                .select(`
                    *,
                    product:products(code, name)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as BOMHeader[];
        },
        enabled: !!companyId,
    });
};

export const useCreateBOM = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (bom: Omit<Partial<BOMHeader>, 'company_id'>) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('bom_headers')
                .insert({ ...bom, company_id: companyId, created_by: userId })
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

export const useWorkOrders = (companyId: string) => {
    return useQuery({
        queryKey: ['work_orders', companyId],
        queryFn: async () => {
            // Check if table exists first to avoid crashing if migration not run
            // But we assume schema exists. Using direct call.
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    *,
                    product:products(code, name)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("Fetch Work Orders failed", error);
                throw error;
            }
            return data as WorkOrder[];
        },
        enabled: !!companyId,
    });
};

export const useWorkCenters = (companyId: string) => {
    return useQuery({
        queryKey: ['work_centers', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('work_centers')
                .select('*')
                .eq('company_id', companyId)
                .order('code');

            if (error) {
                console.warn("Work Centers table likely missing, returning empty.", error);
                return [] as WorkCenter[];
            }
            return data as WorkCenter[];
        },
        enabled: !!companyId,
        retry: false
    });
};

export const useOperations = (companyId: string) => {
    return useQuery({
        queryKey: ['operations', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_operations')
                .select(`
                    *,
                    work_center:work_centers(name)
                `)
                .eq('company_id', companyId)
                .order('code');

            if (error) {
                console.warn("Operations table likely missing, returning empty.", error);
                return [] as Operation[];
            }
            return data as Operation[];
        },
        enabled: !!companyId,
        retry: false
    });
};
