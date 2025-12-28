// Edge Function: receive-finished-goods
// Similar to receive-raw-material but for finished goods

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        const payload = await req.json()

        const { data, error } = await supabaseClient
            .from('finished_goods_ledger')
            .insert({
                company_id: payload.company_id,
                product_id: payload.product_id,
                variant_id: payload.variant_id,
                warehouse_id: payload.warehouse_id,
                bin_id: payload.bin_id,
                transaction_type: 'PRODUCTION_IN',
                transaction_date: payload.transaction_date,
                qty_in: payload.qty_in,
                qty_out: 0,
                unit_cost: payload.unit_cost,
                total_cost: payload.qty_in * payload.unit_cost,
                reference_type: payload.reference_type,
                reference_id: payload.reference_id,
                reference_number: payload.reference_number,
                notes: payload.notes,
                created_by: payload.user_id,
            })
            .select()
            .single()

        if (error) {
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ data, message: 'Finished goods received successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
