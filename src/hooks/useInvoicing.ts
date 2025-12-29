
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useApp } from '@/contexts/AppContext';
import { SalesInvoice } from '@/types/sales';

export const useVendorInvoices = (companyId: string) => {
    return useQuery({
        queryKey: ['vendor-invoices', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('vendor_invoices')
                .select(`
          *,
          vendor:vendors(name, code)
        `)
                .eq('company_id', companyId)
                .order('invoice_date', { ascending: false });

            if (error) throw error;
            return data;
        },
        enabled: !!companyId,
    });
};

export const useCreateVendorInvoice = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const { companyId } = useApp();

    return useMutation({
        mutationFn: async (invoice: any) => {
            if (!companyId) throw new Error('Company ID not found');

            // 1. Create Invoice Header
            const { data: header, error: headerError } = await supabase
                .from('vendor_invoices')
                .insert({
                    company_id: companyId,
                    vendor_id: invoice.vendor_id,
                    invoice_number: invoice.invoice_number,
                    invoice_date: invoice.invoice_date,
                    due_date: invoice.due_date,
                    period_id: invoice.period_id,
                    status: 'draft', // Initial status
                    subtotal: 0, // Will be updated by trigger
                    tax_amount: invoice.tax_amount || 0,
                })
                .select()
                .single();

            if (headerError) throw headerError;

            // 2. Create Invoice Lines (if any)
            if (invoice.lines && invoice.lines.length > 0) {
                const linesToInsert = invoice.lines.map((line: any) => ({
                    invoice_id: header.id,
                    material_id: line.material_id,
                    qty_invoiced: line.qty_invoiced,
                    unit_price: line.unit_price,
                    po_line_id: line.po_line_id, // Optional linkage
                    grn_line_id: line.grn_line_id // Optional linkage
                }));

                const { error: linesError } = await supabase
                    .from('vendor_invoice_lines')
                    .insert(linesToInsert);

                if (linesError) throw linesError;
            }

            return header;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
            toast({
                title: 'Invoice Created',
                description: 'Vendor invoice has been successfully recorded.',
            });
        },
        onError: (error) => {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: `Failed to create invoice: ${error.message}`,
            });
        },
    });
};

export const usePayVendorInvoice = () => {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
            // Simplified payment logic: update amount_paid
            // In a real system, this would create a Payment Record and update the Invoice linkage
            const { data, error } = await supabase.rpc('pay_vendor_invoice', {
                p_invoice_id: id,
                p_amount: amount
            });

            // Fallback if RPC doesn't exist (simulated for MVP)
            if (error && error.message.includes('function') && error.message.includes('does not exist')) {
                const { data: inv } = await supabase.from('vendor_invoices').select('amount_paid').eq('id', id).single();
                const newPaid = (inv?.amount_paid || 0) + amount;

                const { error: updateError } = await supabase
                    .from('vendor_invoices')
                    .update({ amount_paid: newPaid })
                    .eq('id', id);

                if (updateError) throw updateError;
                return;
            }

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
            toast({ title: 'Payment Recorded', description: 'Invoice payment has been updated.' });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    });
};

export const useSalesInvoices = (companyId: string) => {
    return useQuery({
        queryKey: ['sales-invoices', companyId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales_invoices')
                .select(`
            *,
            customer:customers(name)
          `)
                .eq('company_id', companyId)
                .order('invoice_date', { ascending: false });

            if (error) throw error;
            return data as SalesInvoice[];
        },
        enabled: !!companyId,
    });
};

export const useReceivePayment = () => { // For Sales Invoices
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
        mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
            const { data: inv } = await supabase.from('sales_invoices').select('amount_paid').eq('id', id).single();
            const newPaid = (inv?.amount_paid || 0) + amount;

            const { error: updateError } = await supabase
                .from('sales_invoices')
                .update({ amount_paid: newPaid })
                .eq('id', id);

            if (updateError) throw updateError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
            toast({ title: 'Payment Received', description: 'Sales invoice payment recorded.' });
        },
        onError: (error) => {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    });
};
