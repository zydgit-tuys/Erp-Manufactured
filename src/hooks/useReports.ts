import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MarginAnalysisRow {
    company_id: string;
    invoice_id: string;
    invoice_number: string;
    invoice_date: string;
    customer_id: string;
    customer_name: string;
    product_variant_id: string;
    product_name: string;
    sku: string;
    qty_invoiced: number;
    unit_sales_price: number;
    revenue: number;
    cogs: number;
    unit_cost: number;
    margin: number;
    margin_percentage: number;
}

export function useMarginAnalysis(companyId: string, startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: ['margin-analysis', companyId, startDate, endDate],
        queryFn: async () => {
            let query = supabase
                .from('sales_margin_analysis_vw')
                .select('*')
                .eq('company_id', companyId)
                .order('invoice_date', { ascending: false });

            if (startDate) {
                query = query.gte('invoice_date', startDate);
            }
            if (endDate) {
                query = query.lte('invoice_date', endDate);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as MarginAnalysisRow[];
        },
        enabled: !!companyId,
    });
}
