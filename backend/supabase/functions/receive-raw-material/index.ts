// Edge Function: receive-raw-material
// Description: Receive raw materials into inventory
// RULES.md: Edge Function (fast, I/O bound, < 2-3 sec)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReceiveRawMaterialRequest {
    company_id: string;
    material_id: string;
    warehouse_id: string;
    bin_id?: string;
    qty_in: number;
    unit_cost: number;
    transaction_date: string;
    reference_type: string;
    reference_id?: string;
    reference_number?: string;
    notes?: string;
    user_id: string;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client
        const supabaseClient = createClient(
            // @ts-ignore - Deno.env is available in Deno runtime
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore - Deno.env is available in Deno runtime
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        // Parse request body
        const payload: ReceiveRawMaterialRequest = await req.json()

        // Validate required fields
        if (!payload.company_id || !payload.material_id || !payload.warehouse_id ||
            !payload.qty_in || !payload.unit_cost || !payload.transaction_date || !payload.user_id) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Insert into raw_material_ledger
        // Database will handle:
        // - Period lock check (trigger)
        // - Immutability (trigger)
        const { data, error } = await supabaseClient
            .from('raw_material_ledger')
            .insert({
                company_id: payload.company_id,
                material_id: payload.material_id,
                warehouse_id: payload.warehouse_id,
                bin_id: payload.bin_id,
                transaction_type: 'RECEIPT',
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
            console.error('Error inserting raw material receipt:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ data, message: 'Raw material received successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
