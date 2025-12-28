// Edge Function: post-delivery-order
// Post DO and update inventory (issue finished goods for sales)

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
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        const payload = await req.json()

        // 1. Get DO header
        const { data: deliveryOrder, error: doError } = await supabaseClient
            .from('delivery_orders')
            .select('*')
            .eq('id', payload.do_id)
            .single()

        if (doError || !deliveryOrder) {
            return new Response(
                JSON.stringify({ error: 'Delivery Order not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (deliveryOrder.status !== 'draft') {
            return new Response(
                JSON.stringify({ error: 'Only draft DOs can be posted' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Get DO lines
        const { data: lines, error: linesError } = await supabaseClient
            .from('delivery_order_lines')
            .select('*')
            .eq('do_id', payload.do_id)

        if (linesError || !lines || lines.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No DO lines found' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Create finished goods ledger entries (issue stock)
        for (const line of lines) {
            const { error: ledgerError } = await supabaseClient
                .from('finished_goods_ledger')
                .insert({
                    company_id: deliveryOrder.company_id,
                    product_id: line.product_id,
                    variant_id: line.variant_id,
                    warehouse_id: deliveryOrder.warehouse_id,
                    transaction_type: 'SALES',
                    transaction_date: deliveryOrder.delivery_date,
                    qty_in: 0,
                    qty_out: line.qty_delivered,
                    unit_cost: line.unit_cost,
                    total_cost: line.qty_delivered * line.unit_cost,
                    reference_type: 'DO',
                    reference_id: deliveryOrder.id,
                    reference_number: deliveryOrder.do_number,
                    notes: `DO for SO ${deliveryOrder.so_number}`,
                    created_by: payload.user_id,
                })

            if (ledgerError) {
                return new Response(
                    JSON.stringify({ error: `Failed to post DO: ${ledgerError.message}` }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 4. Update DO status
        const { error: updateError } = await supabaseClient
            .from('delivery_orders')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                posted_by: payload.user_id,
            })
            .eq('id', payload.do_id)

        if (updateError) {
            return new Response(
                JSON.stringify({ error: `Failed to update DO status: ${updateError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ message: 'Delivery Order posted successfully', entries_created: lines.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
