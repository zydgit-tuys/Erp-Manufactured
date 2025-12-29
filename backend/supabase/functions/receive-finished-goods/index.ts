// Edge Function: receive-finished-goods
// Description: Receive finished goods into inventory (from production)
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

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, operation: 'receive-finished-goods' });
    const perf = new PerformanceTracker();

    try {
        logger.info('Request started', { method: req.method });

        const supabaseClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        perf.checkpoint('client_init');

        const payload = await req.json()

        logger.debug('Request payload received', {
            product_id: payload.product_id,
            variant_id: payload.variant_id,
            qty_in: payload.qty_in
        });

        perf.checkpoint('validation');

        const ledgerEntry = {
            company_id: payload.company_id,
            product_id: payload.product_id,
            variant_id: payload.variant_id,
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
                .from('finished_goods_ledger')
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
        // DR: Finished Goods Inventory
        // CR: WIP Inventory
        try {
            logger.debug('Creating automatic journal entry');

            const accounts = await getSystemAccounts(
                supabaseClient,
                payload.company_id,
                [
                    ACCOUNT_MAPPINGS.INVENTORY_FINISHED_GOODS,
                    ACCOUNT_MAPPINGS.INVENTORY_WIP
                ]
            );

            const totalAmount = payload.qty_in * payload.unit_cost;

            const journalResult = await createAutoJournal(
                supabaseClient,
                {
                    company_id: payload.company_id,
                    transaction_date: payload.transaction_date,
                    reference_type: 'PRODUCTION_RECEIPT',
                    reference_id: data.id,
                    reference_number: payload.reference_number || `PR-${data.id.substring(0, 8)}`,
                    description: `Production Complete - Finished Goods Receipt`,
                    lines: [
                        {
                            account_id: accounts.INVENTORY_FINISHED_GOODS,
                            debit: totalAmount,
                            credit: 0,
                            description: 'Finished Goods Received'
                        },
                        {
                            account_id: accounts.INVENTORY_WIP,
                            debit: 0,
                            credit: totalAmount,
                            description: 'WIP Transferred'
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
            logger.warn('Production receipt completed but journal entry failed - manual entry required');
        }

        logger.info('Finished goods received successfully', {
            ledger_id: data.id,
            product_id: payload.product_id,
            qty_in: payload.qty_in,
            ...perf.getMetrics()
        });

        return new Response(
            JSON.stringify({
                data,
                message: 'Finished goods received successfully',
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
