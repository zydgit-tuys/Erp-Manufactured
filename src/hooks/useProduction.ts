
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

import { BOMHeader, ProductionOrder } from '@/types/production';

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

export const useProductionOrders = (companyId: string) => {
    return useQuery({
        queryKey: ['production_orders', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    *,
                    product:products(code, name)
                `)
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });

            if (error) {
                console.warn("Fetch Production Orders failed", error);
                throw error;
            }
            return data as ProductionOrder[];
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
