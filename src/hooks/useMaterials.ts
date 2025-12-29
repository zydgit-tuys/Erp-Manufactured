import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Material } from '@/types/material';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

export const useMaterials = () => {
    return useQuery({
        queryKey: ['materials'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .order('name');

            if (error) throw error;
            return data as Material[];
        },
    });
};

export const useMaterial = (id: string) => {
    return useQuery({
        queryKey: ['materials', id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('materials')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data as Material;
        },
        enabled: !!id,
    });
};

export const useCreateMaterial = () => {
    const queryClient = useQueryClient();
    const { companyId, userId } = useApp();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (newMaterial: any) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('materials')
                .insert({
                    ...newMaterial,
                    company_id: companyId,
                    created_by: userId,
                    status: newMaterial.status || 'active'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            toast({ title: "Material Created", description: "Material has been added successfully." });
        },
        onError: (error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    });
};

export const useUpdateMaterial = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, ...payload }: any) => {
            const { error } = await supabase
                .from('materials')
                .update(payload)
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            toast({ title: "Material Updated", description: "Material details saved successfully." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

export const useDeleteMaterial = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('materials').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
            toast({ title: "Material Deleted", description: "Material has been removed." });
        },
        onError: (err) => {
            toast({ variant: "destructive", title: "Error", description: err.message });
        }
    });
};

// ==================== MATERIAL CATEGORIES ====================

export const useMaterialCategories = (companyId: string) => {
    return useQuery({
        queryKey: ['material_categories', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('material_categories')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            return data;
        },
        enabled: !!companyId,
    });
};

export const useCreateMaterialCategory = () => {
    const queryClient = useQueryClient();
    const { companyId, userId } = useApp();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ code, name, description }: { code: string; name: string; description?: string }) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('material_categories')
                .insert({
                    company_id: companyId,
                    created_by: userId,
                    code,
                    name,
                    description,
                    is_active: true
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['material_categories'] });
            toast({ title: "Category Created", description: "Material category has been added." });
        },
        onError: (error) => {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    });
};
