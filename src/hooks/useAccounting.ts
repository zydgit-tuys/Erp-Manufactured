
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';

export interface AccountingPeriod {
    id: string;
    company_id: string;
    name: string;
    period_code: string;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed' | 'locked';
    closed_at?: string;
    closed_by?: string;
    created_at: string;
    updated_at: string;
}

// ... (Account interface remains same) ...

export const useAccountingPeriods = (companyId: string) => {
    return useQuery({
        queryKey: ['accounting-periods', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('accounting_periods')
                .select('*')
                .eq('company_id', companyId)
                .order('period_code', { ascending: false });

            if (error) throw error;
            return data as AccountingPeriod[];
        },
        enabled: !!companyId,
    });
};

export const useCreateAccountingPeriod = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (newPeriod: Omit<Partial<AccountingPeriod>, 'company_id'>) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('accounting_periods')
                .insert({
                    ...newPeriod,
                    company_id: companyId,
                    created_by: userId,
                    status: 'open'
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
            toast({
                title: 'Period Created',
                description: 'New accounting period has been successfully created.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to create period: ${error.message}`,
            });
        },
    });
};

export const useChartOfAccounts = (companyId: string) => {
    return useQuery({
        queryKey: ['chart-of-accounts', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('chart_of_accounts')
                .select('*')
                .eq('company_id', companyId)
                .order('account_code', { ascending: true });

            if (error) throw error;

            // Transform flat list to tree structure
            const accounts = data as Account[];
            const accountMap = new Map<string, Account>();
            const rootAccounts: Account[] = [];

            // First pass: Create map and initialize children
            accounts.forEach(acc => {
                accountMap.set(acc.id, { ...acc, children: [] });
            });

            // Second pass: Build tree
            accounts.forEach(acc => {
                const accountWithChildren = accountMap.get(acc.id)!;
                if (acc.parent_account_id && accountMap.has(acc.parent_account_id)) {
                    accountMap.get(acc.parent_account_id)!.children?.push(accountWithChildren);
                } else {
                    rootAccounts.push(accountWithChildren);
                }
            });

            return { flat: accounts, tree: rootAccounts };
        },
        enabled: !!companyId,
    });
};
// Account Mappings
export const useAccountMappings = (companyId: string) => {
    return useQuery({
        queryKey: ['account-mappings', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('system_account_mappings')
                .select(`
                    *,
                    account:chart_of_accounts(account_code, account_name)
                `)
                .eq('company_id', companyId);

            if (error) throw error;
            return data;
        },
        enabled: !!companyId,
    });
};

export const useUpdateAccountMapping = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, account_id }: { id: string; account_id: string }) => {
            const { data, error } = await supabase
                .from('system_account_mappings')
                .update({ account_id })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account-mappings'] });
            toast({
                title: 'Mapping Updated',
                description: 'Account mapping has been successfully updated.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to update mapping: ${error.message}`,
            });
        },
    });
};

// COA CRUD
export const useCreateAccount = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId, userId } = useApp();

    return useMutation({
        mutationFn: async (account: Omit<Partial<Account>, 'company_id'>) => {
            if (!companyId) throw new Error('Company ID not found');

            const { data, error } = await supabase
                .from('chart_of_accounts')
                .insert({ ...account, company_id: companyId, created_by: userId })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
            toast({
                title: 'Account Created',
                description: 'New account has been successfully created.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to create account: ${error.message}`,
            });
        },
    });
};

export const useUpdateAccount = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Account> }) => {
            const { data, error } = await supabase
                .from('chart_of_accounts')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
            toast({
                title: 'Account Updated',
                description: 'Account details have been updated.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to update account: ${error.message}`,
            });
        },
    });
};

export const useDeleteAccount = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('chart_of_accounts')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
            toast({
                title: 'Account Deleted',
                description: 'Account has been removed.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to delete account: ${error.message}`,
            });
        },
    });
};
