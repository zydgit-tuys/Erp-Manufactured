import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Material } from '@/types/material';

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

    return useMutation({
        mutationFn: async (newMaterial: Omit<Material, 'id' | 'created_at' | 'updated_at'>) => {
            const { data, error } = await supabase
                .from('materials')
                .insert(newMaterial)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
        },
    });
};
