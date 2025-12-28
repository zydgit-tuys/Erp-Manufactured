// Edge Function: post-adjustment
// Description: Post inventory adjustment (transform lines to ledger entries)
// RULES.md: Edge Function (I/O bound, atomic transaction, < 100 lines typical)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PostAdjustmentRequest {
    adjustment_id: string;
    user_id: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with service role for transaction
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // Parse request body
        const payload: PostAdjustmentRequest = await req.json()

        if (!payload.adjustment_id || !payload.user_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 1. Get adjustment header
        const { data: adjustment, error: adjError } = await supabaseClient
            .from('inventory_adjustments')
            .select('*')
            .eq('id', payload.adjustment_id)
            .single()

        if (adjError || !adjustment) {
            return new Response(
                JSON.stringify({ error: 'Adjustment not found' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        if (adjustment.status !== 'draft') {
            return new Response(
                JSON.stringify({ error: 'Only draft adjustments can be posted' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 2. Get adjustment lines
        const { data: lines, error: linesError } = await supabaseClient
            .from('inventory_adjustment_lines')
            .select('*')
            .eq('adjustment_id', payload.adjustment_id)

        if (linesError || !lines || lines.length === 0) {
            return new Response(
                JSON.stringify({ error: 'No adjustment lines found' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Transform lines to ledger entries
        const ledgerEntries = []

        for (const line of lines) {
            const entry = {
                company_id: adjustment.company_id,
                transaction_type: 'ADJUSTMENT',
                transaction_date: adjustment.adjustment_date,
                reference_type: 'ADJUSTMENT',
                reference_id: adjustment.id,
                reference_number: adjustment.adjustment_number,
                notes: `Adjustment: ${adjustment.reason}`,
                created_by: payload.user_id,
            }

            if (line.ledger_type === 'RAW') {
                ledgerEntries.push({
                    table: 'raw_material_ledger',
                    data: {
                        ...entry,
                        material_id: line.item_id,
                        warehouse_id: line.warehouse_id,
                        bin_id: line.bin_id,
                        qty_in: line.variance_qty > 0 ? Math.abs(line.variance_qty) : 0,
                        qty_out: line.variance_qty < 0 ? Math.abs(line.variance_qty) : 0,
                        unit_cost: line.unit_cost,
                        total_cost: Math.abs(line.variance_amount),
                    }
                })
            } else if (line.ledger_type === 'WIP') {
                ledgerEntries.push({
                    table: 'wip_ledger',
                    data: {
                        ...entry,
                        product_id: line.item_id,
                        variant_id: line.variant_id,
                        stage: line.wip_stage,
                        qty_in: line.variance_qty > 0 ? Math.abs(line.variance_qty) : 0,
                        qty_out: line.variance_qty < 0 ? Math.abs(line.variance_qty) : 0,
                        material_cost: line.variance_qty > 0 ? Math.abs(line.variance_amount) : 0,
                        labor_cost: 0,
                        overhead_cost: 0,
                    }
                })
            } else if (line.ledger_type === 'FG') {
                ledgerEntries.push({
                    table: 'finished_goods_ledger',
                    data: {
                        ...entry,
                        product_id: line.item_id,
                        variant_id: line.variant_id,
                        warehouse_id: line.warehouse_id,
                        bin_id: line.bin_id,
                        qty_in: line.variance_qty > 0 ? Math.abs(line.variance_qty) : 0,
                        qty_out: line.variance_qty < 0 ? Math.abs(line.variance_qty) : 0,
                        unit_cost: line.unit_cost,
                        total_cost: Math.abs(line.variance_amount),
                    }
                })
            }
        }

        // 4. Insert ledger entries (database will validate stock, period lock, etc)
        for (const entry of ledgerEntries) {
            const { error: insertError } = await supabaseClient
                .from(entry.table)
                .insert(entry.data)

            if (insertError) {
                console.error(`Error inserting to ${entry.table}:`, insertError)
                return new Response(
                    JSON.stringify({ error: `Failed to post adjustment: ${insertError.message}` }),
                    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
        }

        // 5. Update adjustment status
        const { error: updateError } = await supabaseClient
            .from('inventory_adjustments')
            .update({
                status: 'posted',
                posted_at: new Date().toISOString(),
                posted_by: payload.user_id,
            })
            .eq('id', payload.adjustment_id)

        if (updateError) {
            return new Response(
                JSON.stringify({ error: `Failed to update adjustment status: ${updateError.message}` }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({
                message: 'Adjustment posted successfully',
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
