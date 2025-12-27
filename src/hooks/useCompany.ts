import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company, CompanySettings } from '@/types/company';

export const useCompany = () => {
    return useQuery({
        queryKey: ['company'],
        queryFn: async () => {
            // Assuming user has access to at least one company via RLS
            const { data, error } = await supabase
                .from('companies')
                .select('*, user_company_mapping(role)')
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data as Company;
        },
    });
};

export const useUpdateCompanySettings = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, settings }: { id: string, settings: CompanySettings }) => {
            const { data, error } = await supabase
                .from('companies')
                .update({ settings })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company'] });
        },
    });
};
