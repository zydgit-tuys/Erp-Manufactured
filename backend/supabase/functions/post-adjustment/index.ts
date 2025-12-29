// Edge Function: post-adjustment
// Description: Post inventory adjustment (transform lines to ledger entries)
// RULES.md: Edge Function (I/O bound, atomic transaction, < 100 lines typical)
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

interface PostAdjustmentRequest {
    adjustment_id: string;
    user_id: string;
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const requestId = crypto.randomUUID();
    const logger = createLogger({ requestId, operation: 'post-adjustment' });
    const perf = new PerformanceTracker();

    try {
        logger.info('Request started', { method: req.method });

        // Create Supabase client with service role for transaction
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        perf.checkpoint('client_init');

        const payload: PostAdjustmentRequest = await req.json()

        logger.debug('Request payload received', { adjustment_id: payload.adjustment_id });

        if (!payload.adjustment_id || !payload.user_id) {
            logger.warn('Validation failed: Missing required fields');
            return new Response(
                JSON.stringify({ error: 'Missing required fields', requestId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        // 1. Get adjustment header
        const { data: adjustment, error: adjError } = await supabaseClient
            .from('inventory_adjustments')
            .select('*')
            .eq('id', payload.adjustment_id)
            .single()

        if (adjError || !adjustment) {
            logger.warn('Adjustment not found', { adjustment_id: payload.adjustment_id });
            return new Response(
                JSON.stringify({ error: 'Adjustment not found', requestId }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        if (adjustment.status !== 'draft') {
            logger.warn('Invalid adjustment status', { status: adjustment.status });
            return new Response(
                JSON.stringify({ error: 'Only draft adjustments can be posted', requestId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        perf.checkpoint('validation');

        // 2. Get adjustment lines
        const { data: lines, error: linesError } = await supabaseClient
            .from('inventory_adjustment_lines')
            .select('*')
            .eq('adjustment_id', payload.adjustment_id)

        if (linesError || !lines || lines.length === 0) {
            logger.warn('No adjustment lines found');
            return new Response(
                JSON.stringify({ error: 'No adjustment lines found', requestId }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } }
            )
        }

        logger.info('Processing adjustment lines', { line_count: lines.length });
        perf.checkpoint('fetch_lines');

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
                        quantity: line.variance_qty, // Can be positive or negative
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
                        quantity: line.variance_qty,
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
                        quantity: line.variance_qty,
                        unit_cost: line.unit_cost,
                        total_cost: Math.abs(line.variance_amount),
                    }
                })
            }
        }

        perf.checkpoint('transform_entries');

        // 4. Insert ledger entries with retry logic
        let entriesCreated = 0;
        for (const entry of ledgerEntries) {
            await withRetry(async () => {
                logger.debug('Inserting ledger entry', { table: entry.table });

                const { error: insertError } = await supabaseClient
                    .from(entry.table)
                    .insert(entry.data)

                if (insertError) {
                    logger.error(`Error inserting to ${entry.table}`, insertError);
                    throw insertError;
                }

                entriesCreated++;
            });
        }

        perf.checkpoint('insert_entries');

        // Create automatic journal entries for adjustments
        // DR/CR: Inventory (based on ledger type)
        // DR/CR: Inventory Variance (opposite side)
        try {
            logger.debug('Creating automatic journal entries for adjustments');

            // Group adjustment lines by ledger type for journal entries
            const adjustmentsByType = new Map<string, { totalIncrease: number; totalDecrease: number }>();

            for (const line of lines) {
                const key = line.ledger_type;
                if (!adjustmentsByType.has(key)) {
                    adjustmentsByType.set(key, { totalIncrease: 0, totalDecrease: 0 });
                }
                const totals = adjustmentsByType.get(key)!;
                if (line.variance_qty > 0) {
                    totals.totalIncrease += Math.abs(line.variance_amount);
                } else {
                    totals.totalDecrease += Math.abs(line.variance_amount);
                }
            }

            // Get required accounts
            const accountMappings = [
                ACCOUNT_MAPPINGS.INVENTORY_VARIANCE,
                ACCOUNT_MAPPINGS.INVENTORY_RAW_MATERIALS,
                ACCOUNT_MAPPINGS.INVENTORY_WIP,
                ACCOUNT_MAPPINGS.INVENTORY_FINISHED_GOODS
            ];

            const accounts = await getSystemAccounts(
                supabaseClient,
                adjustment.company_id,
                accountMappings
            );

            // Create journal entry for each ledger type
            for (const [ledgerType, totals] of adjustmentsByType.entries()) {
                const inventoryAccount =
                    ledgerType === 'RAW' ? accounts.INVENTORY_RAW_MATERIALS :
                        ledgerType === 'WIP' ? accounts.INVENTORY_WIP :
                            accounts.INVENTORY_FINISHED_GOODS;

                // Net adjustment amount
                const netAdjustment = totals.totalIncrease - totals.totalDecrease;

                if (Math.abs(netAdjustment) > 0.01) {
                    const isIncrease = netAdjustment > 0;
                    const amount = Math.abs(netAdjustment);

                    const journalResult = await createAutoJournal(
                        supabaseClient,
                        {
                            company_id: adjustment.company_id,
                            transaction_date: adjustment.adjustment_date,
                            reference_type: 'INVENTORY_ADJUSTMENT',
                            reference_id: adjustment.id,
                            reference_number: adjustment.adjustment_number,
                            description: `Inventory Adjustment - ${adjustment.reason || 'Stock Adjustment'} (${ledgerType})`,
                            lines: [
                                {
                                    account_id: isIncrease ? inventoryAccount : accounts.INVENTORY_VARIANCE,
                                    debit: amount,
                                    credit: 0,
                                    description: isIncrease ? 'Inventory Increase' : 'Inventory Variance (Loss)'
                                },
                                {
                                    account_id: isIncrease ? accounts.INVENTORY_VARIANCE : inventoryAccount,
                                    debit: 0,
                                    credit: amount,
                                    description: isIncrease ? 'Inventory Variance (Gain)' : 'Inventory Decrease'
                                }
                            ],
                            created_by: payload.user_id
                        },
                        requestId
                    );

                    logger.info('Adjustment journal entry created', {
                        journal_id: journalResult.journal_id,
                        journal_number: journalResult.journal_number,
                        ledger_type: ledgerType,
                        amount,
                        type: isIncrease ? 'increase' : 'decrease'
                    });
                }
            }

            perf.checkpoint('journal_entries');
        } catch (journalError) {
            logger.error('Failed to create journal entries', journalError);
            logger.warn('Adjustment posted but journal entries failed - manual entries required');
        }

        // 5. Update adjustment status
        await withRetry(async () => {
            const { error: updateError } = await supabaseClient
                .from('inventory_adjustments')
                .update({
                    status: 'posted',
                    posted_at: new Date().toISOString(),
                    posted_by: payload.user_id,
                })
                .eq('id', payload.adjustment_id)

            if (updateError) {
                logger.error('Failed to update adjustment status', updateError);
                throw updateError;
            }
        });

        perf.checkpoint('update_status');

        logger.info('Adjustment posted successfully', {
            adjustment_id: payload.adjustment_id,
            entries_created: entriesCreated,
            ...perf.getMetrics()
        });

        return new Response(
            JSON.stringify({
                message: 'Adjustment posted successfully',
                entries_created: entriesCreated,
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
