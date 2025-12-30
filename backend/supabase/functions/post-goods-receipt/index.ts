// Edge Function: post-goods-receipt
// Description: Post GRN with ACID transaction using raw Postgres connection
// Addresses: "Logic Leakage" (Audit Finding #22) and ensures Data Integrity

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "postgres"
import { createClient } from "supabase"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // 1. Setup Clients
    // We use Supabase Client for auth/validation (easier API)
    // We use Postgres Client for the heavy write transaction (atomicity)
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // DB Connection String
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!dbUrl) {
        return new Response(JSON.stringify({ error: 'Missing SUPABASE_DB_URL env var' }), { status: 500, headers: corsHeaders })
    }

    const pgClient = new Client(dbUrl)

    try {
        const { grn_id, user_id } = await req.json()

        if (!grn_id || !user_id) {
            throw new Error("Missing grn_id or user_id")
        }

        // 2. Auth Check (Optional if relying solely on RLS, but good for explicit logic)
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error("Unauthorized")

        // 3. Connect to DB
        await pgClient.connect()

        // 4. Start Transaction
        const transaction = await pgClient.createTransaction("post_grn_trx")
        await transaction.begin()

        try {
            // A. Fetch GRN & Validate
            const resultGrn = await transaction.queryObject`
                SELECT * FROM goods_receipt_notes WHERE id = ${grn_id} FOR UPDATE
            `
            const grn = resultGrn.rows[0] as any

            if (!grn) throw new Error("GRN not found")

            // SECURITY: Verify User belongs to GRN Company
            const resultAuth = await transaction.queryArray`
                SELECT 1 FROM user_company_mapping 
                WHERE user_id = ${user.id} AND company_id = ${grn.company_id} AND is_active = true
            `
            if (resultAuth.rows.length === 0) {
                throw new Error("Access Denied: User does not belong to this company")
            }

            if (grn.status === 'posted') throw new Error("GRN already posted")

            // B. Fetch Lines
            const resultLines = await transaction.queryObject`
                SELECT * FROM grn_lines WHERE grn_id = ${grn_id}
            `
            const lines = resultLines.rows as any[]

            if (lines.length === 0) throw new Error("No GRN lines found")

            // C. Process Lines (Insert Ledger + Update PO)
            for (const line of lines) {
                // Insert into Raw Material Ledger
                await transaction.queryArray`
                    INSERT INTO raw_material_ledger (
                        company_id, material_id, warehouse_id, bin_id, 
                        period_id, transaction_date, transaction_type, 
                        reference_type, reference_id, reference_number, 
                        qty_in, qty_out, unit_cost, created_by, is_posted
                    ) VALUES (
                        ${grn.company_id}, ${line.material_id}, ${grn.warehouse_id}, ${line.bin_id}, 
                        ${grn.period_id}, ${grn.grn_date}, 'RECEIPT', 
                        'PURCHASE', ${grn.id}, ${grn.grn_number}, 
                        ${line.qty_received}, 0, ${line.unit_cost}, ${user_id}, true
                    )
                `

                // Update PO Line
                if (line.po_line_id) {
                    await transaction.queryArray`
                        UPDATE purchase_order_lines 
                        SET qty_received = qty_received + ${line.qty_received}
                        WHERE id = ${line.po_line_id}
                    `
                }
            }

            // D. Update GRN Status
            await transaction.queryArray`
                UPDATE goods_receipt_notes 
                SET status = 'posted', posted_at = NOW(), posted_by = ${user_id}
                WHERE id = ${grn_id}
            `

            // E. Commit
            await transaction.commit()

        } catch (innerError) {
            await transaction.rollback() // Rollback on any error
            throw innerError
        } finally {
            await pgClient.end() // Close connection
        }

        return new Response(
            JSON.stringify({ message: 'GRN Posted Successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
