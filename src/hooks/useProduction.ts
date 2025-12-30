
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/utils/errorHandler';
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

export const useBOM = (id: string) => {
    return useQuery({
        queryKey: ['bom', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('bom_headers')
                .select(`
                    *,
                    product:products(code, name),
                    lines:bom_lines(
                        id,
                        material_id,
                        qty_per,
                        uom,
                        scrap_percentage,
                        stage,
                        notes,
                        material:materials(code, name)
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as BOMHeader & { lines: any[] };
        },
        enabled: !!id,
    });
};

export const useCreateBOM = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: { header: Omit<Partial<BOMHeader>, 'company_id'>, lines: any[] }) => {
            if (!companyId) throw new Error('Company ID not found');

            // 1. Create Header
            const { data: bom, error: bomError } = await supabase
                .from('bom_headers')
                .insert({ ...payload.header, company_id: companyId, created_by: userId })
                .select()
                .single();

            if (bomError) throw bomError;

            // 2. Create Lines
            if (payload.lines && payload.lines.length > 0) {
                const linesToInsert = payload.lines.map((line: any) => ({
                    bom_id: bom.id,
                    ...line
                }));

                const { error: linesError } = await supabase
                    .from('bom_lines')
                    .insert(linesToInsert);

                if (linesError) throw linesError;
            }

            return bom;
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

export const useCreateWorkCenter = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { error } = await supabase
                .from('work_centers')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    ...payload,
                    is_active: true
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work_centers'] });
            toast({ title: "Work Center Created", description: "New work center added." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateWorkCenter = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('work_centers')
                .update(payload)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['work_centers'] });
            toast({ title: "Work Center Updated", description: "Changes saved." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateOperation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { error } = await supabase
                .from('production_operations')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    ...payload,
                    is_active: true
                });

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operations'] });
            toast({ title: "Operation Created", description: "New operation added." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useUpdateOperation = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('production_operations')
                .update(payload)
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['operations'] });
            toast({ title: "Operation Updated", description: "Changes saved." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useCreateProductionOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (payload: any) => {
            const { data, error } = await supabase
                .from('production_orders')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    status: 'planned',
                    ...payload
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['production_orders'] });
            toast({ title: "Work Order Created", description: "Production order has been planned." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useProductionOrder = (id: string) => {
    return useQuery({
        queryKey: ['production_order', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    *,
                    product:products(code, name, unit_of_measure),
                    warehouse:warehouses(name),
                    bom:bom_headers(version)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as ProductionOrder & { product: any, warehouse: any, bom: any };
        },
        enabled: !!id,
    });
};

export const useReleaseProductionOrder = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.rpc('release_production_order', { p_po_id: id });
            if (error) throw error;
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: ['production_order', id] });
            queryClient.invalidateQueries({ queryKey: ['production_orders'] });
            toast({ title: "Work Order Released", description: "Stock has been reserved." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Release Failed", description: handleSupabaseError(err) });
        }
    });
};

export const useRecordOutput = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { userId } = useApp();

    return useMutation({
        mutationFn: async ({ id, qty }: { id: string, qty: number }) => {
            const { error } = await supabase.rpc('record_production_output', {
                p_production_order_id: id,
                p_qty_output: qty,
                p_user_id: userId
            });

            if (error) throw error;
        },
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: ['production_order', id] });
            queryClient.invalidateQueries({ queryKey: ['production_orders'] });
            toast({ title: "Output Recorded", description: "Finished goods added to inventory." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};
