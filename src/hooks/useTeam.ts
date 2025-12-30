import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/utils/errorHandler';

export interface TeamMember {
    mapping_id: string;
    company_id: string;
    user_id: string;
    role: string;
    is_active: boolean;
    joined_at: string;
    email: string;
    full_name: string;
}

export interface UserInvite {
    id: string;
    company_id: string;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'expired';
    token: string;
    expires_at: string;
    created_at: string;
}

export function useTeamMembers(companyId: string) {
    return useQuery({
        queryKey: ['team-members', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('company_members_vw')
                .select('*')
                .eq('company_id', companyId)
                .order('joined_at', { ascending: true });

            if (error) throw error;
            return data as TeamMember[];
        },
        enabled: !!companyId,
    });
}

export function useTeamInvites(companyId: string) {
    return useQuery({
        queryKey: ['team-invites', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('user_invites')
                .select('*')
                .eq('company_id', companyId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as UserInvite[];
        },
        enabled: !!companyId,
    });
}

export function useInviteUser() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { user } = supabase.auth.getSession() as any; // simplified

    return useMutation({
        mutationFn: async ({ companyId, email, role }: { companyId: string; email: string; role: string }) => {
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('user_invites')
                .insert({
                    company_id: companyId,
                    email,
                    role,
                    created_by: userData.user?.id
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-invites'] });
            toast({ title: 'Invitation sent' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to invite user',
                description: handleSupabaseError(error),
                variant: 'destructive'
            });
        },
    });
}

export function useCancelInvite() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async (inviteId: string) => {
            const { error } = await supabase
                .from('user_invites')
                .delete()
                .eq('id', inviteId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['team-invites'] });
            toast({ title: 'Invitation cancelled' });
        },
        onError: (error: Error) => {
            toast({
                title: 'Failed to cancel invitation',
                description: handleSupabaseError(error),
                variant: 'destructive'
            });
        },
    });
}
