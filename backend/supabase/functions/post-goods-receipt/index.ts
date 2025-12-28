// Edge Function: post-goods-receipt
// Post GRN and update inventory (receive raw materials from purchase)

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

        // 1. Get GRN header
        const { data: grn, error: grnError } = await supabaseClient
            .from('goods_receipt_notes')
            .select('*')
            .eq('id', payload.grn_id)
            .single()

        if (grnError || !grn) {
            return new Response(
                JSON.stringify({ error: 'GRN not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (grn.status !== 'draft') {
            return new Response(
                JSON.stringify({ error: 'Only draft GRNs can be posted' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Get GRN lines
        const { data: lines, error: linesError } = await supabaseClient
            .from('grn_lines')
            .select('*')
            .eq('grn_id', payload.grn_id)

        if (linesError || !lines || lines.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No GRN lines found' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Create raw material ledger entries
        for (const line of lines) {
            const { error: ledgerError } = await supabaseClient
                .from('raw_material_ledger')
                .insert({
                    company_id: grn.company_id,
                    material_id: line.material_id,
                    warehouse_id: grn.warehouse_id,
                    transaction_type: 'RECEIPT',
                    transaction_date: grn.receipt_date,
                    qty_in: line.qty_received,
                    qty_out: 0,
                    unit_cost: line.unit_cost,
                    total_cost: line.qty_received * line.unit_cost,
                    reference_type: 'GRN',
                    reference_id: grn.id,
                    reference_number: grn.grn_number,
                    notes: `GRN from PO ${grn.po_number}`,
                    created_by: payload.user_id,
                })

            if (ledgerError) {
                return new Response(
                    JSON.stringify({ error: `Failed to post GRN: ${ledgerError.message}` }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 4. Update GRN status
        const { error: updateError } = await supabaseClient
            .from('goods_receipt_notes')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                posted_by: payload.user_id,
            })
            .eq('id', payload.grn_id)

        if (updateError) {
            return new Response(
                JSON.stringify({ error: `Failed to update GRN status: ${updateError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ message: 'GRN posted successfully', entries_created: lines.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
