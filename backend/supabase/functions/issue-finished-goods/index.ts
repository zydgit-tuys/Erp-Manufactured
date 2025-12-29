// Edge Function: issue-finished-goods
// Description: Issue finished goods from inventory (for sales)
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

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, operation: 'issue-finished-goods' });
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
            qty_out: payload.qty_out
        });

        perf.checkpoint('validation');

        // Database trigger will validate stock availability
        const ledgerEntry = {
            company_id: payload.company_id,
            product_id: payload.product_id,
            variant_id: payload.variant_id,
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
                .from('finished_goods_ledger')
                .insert(ledgerEntry)
                .select()
                .single()

            if (error) {
                logger.error('Ledger insert failed', error);

                // Check if it's a stock validation error
                if (error.message.includes('Insufficient')) {
                    const stockError = new Error(error.message);
                    (stockError as any).isStockError = true;
                    throw stockError;
                }

                throw error;
            }

            return data;
        });

        perf.checkpoint('database_insert');

        // Create automatic journal entries (2 entries needed for sales)
        // Entry 1: Revenue Recognition
        // DR: Accounts Receivable
        // CR: Sales Revenue
        //
        // Entry 2: Cost of Goods Sold
        // DR: COGS
        // CR: Finished Goods Inventory
        try {
            logger.debug('Creating automatic journal entries for sales');

            const accounts = await getSystemAccounts(
                supabaseClient,
                payload.company_id,
                [
                    ACCOUNT_MAPPINGS.ACCOUNTS_RECEIVABLE,
                    ACCOUNT_MAPPINGS.SALES_REVENUE,
                    ACCOUNT_MAPPINGS.COST_OF_GOODS_SOLD,
                    ACCOUNT_MAPPINGS.INVENTORY_FINISHED_GOODS
                ]
            );

            const costAmount = payload.qty_out * payload.unit_cost;
            const revenueAmount = payload.qty_out * (payload.selling_price || payload.unit_cost * 1.3); // Default 30% markup if no selling price

            // Journal Entry 1: Revenue Recognition
            const revenueJournal = await createAutoJournal(
                supabaseClient,
                {
                    company_id: payload.company_id,
                    transaction_date: payload.transaction_date,
                    reference_type: 'SALES_REVENUE',
                    reference_id: data.id,
                    reference_number: payload.reference_number || `SR-${data.id.substring(0, 8)}`,
                    description: `Sales Revenue`,
                    lines: [
                        {
                            account_id: accounts.ACCOUNTS_RECEIVABLE,
                            debit: revenueAmount,
                            credit: 0,
                            description: 'Accounts Receivable'
                        },
                        {
                            account_id: accounts.SALES_REVENUE,
                            debit: 0,
                            credit: revenueAmount,
                            description: 'Sales Revenue'
                        }
                    ],
                    created_by: payload.user_id
                },
                requestId
            );

            logger.info('Revenue journal entry created', {
                journal_id: revenueJournal.journal_id,
                journal_number: revenueJournal.journal_number,
                amount: revenueAmount
            });

            // Journal Entry 2: Cost of Goods Sold
            const cogsJournal = await createAutoJournal(
                supabaseClient,
                {
                    company_id: payload.company_id,
                    transaction_date: payload.transaction_date,
                    reference_type: 'SALES_COGS',
                    reference_id: data.id,
                    reference_number: payload.reference_number || `COGS-${data.id.substring(0, 8)}`,
                    description: `Cost of Goods Sold`,
                    lines: [
                        {
                            account_id: accounts.COST_OF_GOODS_SOLD,
                            debit: costAmount,
                            credit: 0,
                            description: 'Cost of Goods Sold'
                        },
                        {
                            account_id: accounts.INVENTORY_FINISHED_GOODS,
                            debit: 0,
                            credit: costAmount,
                            description: 'Finished Goods Issued'
                        }
                    ],
                    created_by: payload.user_id
                },
                requestId
            );

            logger.info('COGS journal entry created', {
                journal_id: cogsJournal.journal_id,
                journal_number: cogsJournal.journal_number,
                amount: costAmount
            });

            perf.checkpoint('journal_entries');
        } catch (journalError) {
            logger.error('Failed to create journal entries', journalError);
            logger.warn('Sales completed but journal entries failed - manual entries required');
        }

        logger.info('Finished goods issued successfully', {
            ledger_id: data.id,
            product_id: payload.product_id,
            qty_out: payload.qty_out,
            ...perf.getMetrics()
        });

        return new Response(
            JSON.stringify({
                data,
                message: 'Finished goods issued successfully',
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
