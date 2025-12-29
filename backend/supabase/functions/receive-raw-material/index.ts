// Edge Function: receive-raw-material
// Description: Receive raw materials into inventory
// RULES.md: Edge Function (fast, I/O bound, < 2-3 sec)
// Enhanced with: Structured logging, retry logic, performance tracking

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger, withRetry, PerformanceTracker } from '../_shared/logger.ts'
import { createAutoJournal } from '../_shared/auto-journal.ts'
import { getSystemAccounts, ACCOUNT_MAPPINGS } from '../_shared/account-mapping.ts'

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

    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, operation: 'receive-raw-material' });
    const perf = new PerformanceTracker();

    try {
        logger.info('Request started', { method: req.method });

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

        perf.checkpoint('client_init');

        // Parse request body
        const payload: ReceiveRawMaterialRequest = await req.json()

        logger.debug('Request payload received', {
            material_id: payload.material_id,
            qty_in: payload.qty_in,
            warehouse_id: payload.warehouse_id
        });

        // Validate required fields
        if (!payload.company_id || !payload.material_id || !payload.warehouse_id ||
            !payload.qty_in || !payload.unit_cost || !payload.transaction_date || !payload.user_id) {
            logger.warn('Validation failed: Missing required fields', { payload });
            return new Response(
                JSON.stringify({ error: 'Missing required fields', requestId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        perf.checkpoint('validation');

        // Insert into raw_material_ledger with retry logic
        // Database will handle:
        // - Period lock check (trigger)
        // - Immutability (trigger)
        // - CHECK constraints (quantity validation)
        const ledgerEntry = {
            company_id: payload.company_id,
            material_id: payload.material_id,
            warehouse_id: payload.warehouse_id,
            bin_id: payload.bin_id,
            transaction_type: 'RECEIPT',
            transaction_date: payload.transaction_date,
            quantity: payload.qty_in, // Positive for receipts
            unit_cost: payload.unit_cost,
            total_cost: payload.qty_in * payload.unit_cost,
            reference_type: payload.reference_type,
            reference_id: payload.reference_id,
            reference_number: payload.reference_number,
            notes: payload.notes,
            created_by: payload.user_id,
        };

        const data = await withRetry(async () => {
            logger.debug('Attempting ledger insert');

            const { data, error } = await supabaseClient
                .from('raw_material_ledger')
                .insert(ledgerEntry)
                .select()
                .single()

            if (error) {
                logger.error('Ledger insert failed', error);
                throw error;
            }

            return data;
        });

        perf.checkpoint('database_insert');

        // Create automatic journal entry
        // DR: Inventory (Raw Materials)
        // CR: Accounts Payable (Accrued)
        try {
            logger.debug('Creating automatic journal entry');

            const accounts = await getSystemAccounts(
                supabaseClient,
                payload.company_id,
                [
                    ACCOUNT_MAPPINGS.INVENTORY_RAW_MATERIALS,
                    ACCOUNT_MAPPINGS.ACCOUNTS_PAYABLE_ACCRUED
                ]
            );

            const totalAmount = payload.qty_in * payload.unit_cost;

            const journalResult = await createAutoJournal(
                supabaseClient,
                {
                    company_id: payload.company_id,
                    transaction_date: payload.transaction_date,
                    reference_type: 'GOODS_RECEIPT',
                    reference_id: data.id,
                    reference_number: payload.reference_number || `GR-${data.id.substring(0, 8)}`,
                    description: `Goods Receipt - Raw Material`,
                    lines: [
                        {
                            account_id: accounts.INVENTORY_RAW_MATERIALS,
                            debit: totalAmount,
                            credit: 0,
                            description: 'Raw Material Received'
                        },
                        {
                            account_id: accounts.ACCOUNTS_PAYABLE_ACCRUED,
                            debit: 0,
                            credit: totalAmount,
                            description: 'Accrued Payable'
                        }
                    ],
                    created_by: payload.user_id
                },
                requestId
            );

            perf.checkpoint('journal_entry');

            logger.info('Journal entry created', {
                journal_id: journalResult.journal_id,
                journal_number: journalResult.journal_number
            });
        } catch (journalError) {
            // Log error but don't fail the transaction
            // Journal can be created manually if needed
            logger.error('Failed to create journal entry', journalError);
            logger.warn('Goods receipt completed but journal entry failed - manual entry required');
        }

        logger.info('Raw material received successfully', {
            ledger_id: data.id,
            material_id: payload.material_id,
            qty_in: payload.qty_in,
            ...perf.getMetrics()
        });

        return new Response(
            JSON.stringify({
                data,
                message: 'Raw material received successfully',
                requestId,
                performance: perf.getMetrics()
            }),
            {
                status: 200,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId
                }
            }
        )

    } catch (error) {
        logger.error('Request failed', error);

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            }),
            {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId
                }
            }
        )
    }
})
