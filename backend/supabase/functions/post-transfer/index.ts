// Edge Function: post-transfer
// Description: Post internal transfer (create OUT and IN entries)
// RULES.md: Edge Function (I/O bound, atomic transaction)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PostTransferRequest {
    transfer_id: string;
    user_id: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with service role
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // Parse request body
        const payload: PostTransferRequest = await req.json()

        if (!payload.transfer_id || !payload.user_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Get transfer header
        const { data: transfer, error: transferError } = await supabaseClient
            .from('internal_transfers')
            .select('*')
            .eq('id', payload.transfer_id)
            .single()

        if (transferError || !transfer) {
            return new Response(
                JSON.stringify({ error: 'Transfer not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (transfer.status !== 'draft') {
            return new Response(
                JSON.stringify({ error: 'Only draft transfers can be posted' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Get transfer lines
        const { data: lines, error: linesError } = await supabaseClient
            .from('internal_transfer_lines')
            .select('*')
            .eq('transfer_id', payload.transfer_id)

        if (linesError || !lines || lines.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No transfer lines found' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Create ledger entries (OUT from source, IN to destination)
        const ledgerEntries = []

        for (const line of lines) {
            const baseEntry = {
                company_id: transfer.company_id,
                transaction_type: 'TRANSFER',
                transaction_date: transfer.transfer_date,
                reference_type: 'TRANSFER',
                reference_id: transfer.id,
                reference_number: transfer.transfer_number,
                notes: `Transfer: ${transfer.from_warehouse_id} → ${transfer.to_warehouse_id}`,
                created_by: payload.user_id,
            }

            // OUT entry (from source warehouse)
            if (line.ledger_type === 'RAW') {
                ledgerEntries.push({
                    table: 'raw_material_ledger',
                    data: {
                        ...baseEntry,
                        material_id: line.item_id,
                        warehouse_id: transfer.from_warehouse_id,
                        bin_id: line.from_bin_id,
                        qty_in: 0,
                        qty_out: line.qty,
                        unit_cost: line.unit_cost,
                        total_cost: line.qty * line.unit_cost,
                    }
                })
                // IN entry (to destination warehouse)
                ledgerEntries.push({
                    table: 'raw_material_ledger',
                    data: {
                        ...baseEntry,
                        material_id: line.item_id,
                        warehouse_id: transfer.to_warehouse_id,
                        bin_id: line.to_bin_id,
                        qty_in: line.qty,
                        qty_out: 0,
                        unit_cost: line.unit_cost,
                        total_cost: line.qty * line.unit_cost,
                    }
                })
            } else if (line.ledger_type === 'FG') {
                // OUT entry
                ledgerEntries.push({
                    table: 'finished_goods_ledger',
                    data: {
                        ...baseEntry,
                        product_id: line.item_id,
                        variant_id: line.variant_id,
                        warehouse_id: transfer.from_warehouse_id,
                        bin_id: line.from_bin_id,
                        qty_in: 0,
                        qty_out: line.qty,
                        unit_cost: line.unit_cost,
                        total_cost: line.qty * line.unit_cost,
                    }
                })
                // IN entry
                ledgerEntries.push({
                    table: 'finished_goods_ledger',
                    data: {
                        ...baseEntry,
                        product_id: line.item_id,
                        variant_id: line.variant_id,
                        warehouse_id: transfer.to_warehouse_id,
                        bin_id: line.to_bin_id,
                        qty_in: line.qty,
                        qty_out: 0,
                        unit_cost: line.unit_cost,
                        total_cost: line.qty * line.unit_cost,
                    }
                })
            }
        }

        // 4. Insert ledger entries
        for (const entry of ledgerEntries) {
            const { error: insertError } = await supabaseClient
                .from(entry.table)
                .insert(entry.data)

            if (insertError) {
                console.error(`Error inserting to ${entry.table}:`, insertError)
                return new Response(
                    JSON.stringify({ error: `Failed to post transfer: ${insertError.message}` }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 5. Update transfer status
        const { error: updateError } = await supabaseClient
            .from('internal_transfers')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                posted_by: payload.user_id,
            })
            .eq('id', payload.transfer_id)

        if (updateError) {
            return new Response(
                JSON.stringify({ error: `Failed to update transfer status: ${updateError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                message: 'Transfer posted successfully',
                entries_created: ledgerEntries.length
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
