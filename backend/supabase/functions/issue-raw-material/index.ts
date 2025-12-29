// Edge Function: issue-raw-material
// Description: Issue raw materials from inventory
// RULES.md: Edge Function (fast, I/O bound, < 2-3 sec)
// Enhanced with: Structured logging, retry logic, performance tracking
// Database handles stock validation via trigger

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createLogger, withRetry, PerformanceTracker } from '../_shared/logger.ts'
import { createAutoJournal } from '../_shared/auto-journal.ts'
import { getSystemAccounts, ACCOUNT_MAPPINGS } from '../_shared/account-mapping.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface IssueRawMaterialRequest {
    company_id: string;
    material_id: string;
    warehouse_id: string;
    bin_id?: string;
    qty_out: number;
    unit_cost: number;
    transaction_date: string;
    reference_type: string;
    reference_id?: string;
    reference_number?: string;
    notes?: string;
    user_id: string;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, operation: 'issue-raw-material' });
    const perf = new PerformanceTracker();

    try {
        logger.info('Request started', { method: req.method });

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: req.headers.get('Authorization')! },
                },
            }
        )

        perf.checkpoint('client_init');

        const payload: IssueRawMaterialRequest = await req.json()

        logger.debug('Request payload received', {
            material_id: payload.material_id,
            qty_out: payload.qty_out,
            warehouse_id: payload.warehouse_id
        });

        if (!payload.company_id || !payload.material_id || !payload.warehouse_id ||
            !payload.qty_out || !payload.unit_cost || !payload.transaction_date || !payload.user_id) {
            logger.warn('Validation failed: Missing required fields');
            return new Response(
                JSON.stringify({ error: 'Missing required fields', requestId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        perf.checkpoint('validation');

        // Insert into raw_material_ledger with retry logic
        // Database will handle:
        // - Period lock check (trigger)
        // - Stock availability validation (trigger)
        // - Immutability (trigger)
        // - CHECK constraints (quantity validation)
        const ledgerEntry = {
            company_id: payload.company_id,
            material_id: payload.material_id,
            warehouse_id: payload.warehouse_id,
            bin_id: payload.bin_id,
            transaction_type: 'ISSUE',
            transaction_date: payload.transaction_date,
            quantity: -payload.qty_out, // Negative for issues
            unit_cost: payload.unit_cost,
            total_cost: payload.qty_out * payload.unit_cost,
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

                // Check if it's a stock validation error
                if (error.message.includes('Insufficient stock')) {
                    const stockError = new Error(error.message);
                    (stockError as any).isStockError = true;
                    throw stockError;
                }

                throw error;
            }

            return data;
        });

        perf.checkpoint('database_insert');

        // Create automatic journal entry
        // DR: WIP Inventory
        // CR: Raw Materials Inventory
        try {
            logger.debug('Creating automatic journal entry');

            const accounts = await getSystemAccounts(
                supabaseClient,
                payload.company_id,
                [
                    ACCOUNT_MAPPINGS.INVENTORY_WIP,
                    ACCOUNT_MAPPINGS.INVENTORY_RAW_MATERIALS
                ]
            );

            const totalAmount = payload.qty_out * payload.unit_cost;

            const journalResult = await createAutoJournal(
                supabaseClient,
                {
                    company_id: payload.company_id,
                    transaction_date: payload.transaction_date,
                    reference_type: 'MATERIAL_ISSUE',
                    reference_id: data.id,
                    reference_number: payload.reference_number || `MI-${data.id.substring(0, 8)}`,
                    description: `Material Issue to Production`,
                    lines: [
                        {
                            account_id: accounts.INVENTORY_WIP,
                            debit: totalAmount,
                            credit: 0,
                            description: 'WIP Inventory'
                        },
                        {
                            account_id: accounts.INVENTORY_RAW_MATERIALS,
                            debit: 0,
                            credit: totalAmount,
                            description: 'Raw Material Issued'
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
            logger.error('Failed to create journal entry', journalError);
            logger.warn('Material issue completed but journal entry failed - manual entry required');
        }

        logger.info('Raw material issued successfully', {
            ledger_id: data.id,
            material_id: payload.material_id,
            qty_out: payload.qty_out,
            ...perf.getMetrics()
        });

        return new Response(
            JSON.stringify({
                data,
                message: 'Raw material issued successfully',
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

    } catch (error: any) {
        logger.error('Request failed', error);

        // Handle stock validation errors with 400 status
        const status = error.isStockError ? 400 : 500;

        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            }),
            {
                status,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId
                }
            }
        )
    }
})
