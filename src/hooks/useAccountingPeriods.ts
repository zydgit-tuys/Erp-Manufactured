import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AccountingPeriod } from '@/types/accountingPeriod';

export const useAccountingPeriods = () => {
    return useQuery({
        queryKey: ['accounting-periods'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('accounting_periods')
                .select('*')
                .order('period_code', { ascending: false }); // Latest first

            if (error) throw error;
            return data as AccountingPeriod[];
        },
    });
};

export const useCreateAccountingPeriod = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (newPeriod: Partial<AccountingPeriod>) => {
            const { data, error } = await supabase
                .from('accounting_periods')
                .insert(newPeriod)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
        },
    });
};
