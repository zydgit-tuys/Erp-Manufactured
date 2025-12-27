import { supabase } from '@/integrations/supabase/client';
import type {
  RawMaterialLedger,
  RawMaterialLedgerInsert,
  WipLedger,
  WipLedgerInsert,
  FinishedGoodsLedger,
  FinishedGoodsLedgerInsert,
  InventoryAdjustment,
  InventoryAdjustmentInsert,
  InventoryAdjustmentLineInsert,
  InternalTransfer,
  InternalTransferInsert,
  InternalTransferLineInsert,
  RawMaterialBalance,
  WipBalance,
  FinishedGoodsBalance,
  TransactionType,
  WipStage,
  LedgerType,
} from '@/types/inventory';

// ==================== RAW MATERIAL LEDGER ====================

export async function receiveRawMaterial(
  data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_out' | 'total_cost'>
): Promise<RawMaterialLedger> {
  const entry: RawMaterialLedgerInsert = {
    ...data,
    transaction_type: 'RECEIPT',
    qty_out: 0,
    total_cost: data.qty_in * data.unit_cost,
  };

  const { data: result, error } = await supabase
    .from('raw_material_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function issueRawMaterial(
  data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>
): Promise<RawMaterialLedger> {
  // Validate no negative stock
  const balance = await getRawMaterialBalance(data.company_id, data.material_id, data.warehouse_id, data.bin_id);
  if (balance && balance.current_qty < data.qty_out) {
    throw new Error(`Insufficient stock. Available: ${balance.current_qty}, Requested: ${data.qty_out}`);
  }

  const entry: RawMaterialLedgerInsert = {
    ...data,
    transaction_type: 'ISSUE',
    qty_in: 0,
    total_cost: data.qty_out * data.unit_cost,
  };

  const { data: result, error } = await supabase
    .from('raw_material_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getRawMaterialLedger(
  companyId: string,
  materialId?: string,
  startDate?: string,
  endDate?: string
): Promise<RawMaterialLedger[]> {
  let query = supabase
    .from('raw_material_ledger')
    .select('*')
    .eq('company_id', companyId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (materialId) query = query.eq('material_id', materialId);
  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getRawMaterialBalance(
  companyId: string,
  materialId: string,
  warehouseId?: string,
  binId?: string
): Promise<RawMaterialBalance | null> {
  let query = supabase
    .from('raw_material_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .eq('material_id', materialId);

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (binId) query = query.eq('bin_id', binId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllRawMaterialBalances(companyId: string): Promise<RawMaterialBalance[]> {
  const { data, error } = await supabase
    .from('raw_material_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .order('material_code');

  if (error) throw error;
  return data || [];
}

// ==================== WIP LEDGER ====================

export async function recordWipIn(
  data: Omit<WipLedgerInsert, 'transaction_type' | 'qty_out'>
): Promise<WipLedger> {
  const entry: WipLedgerInsert = {
    ...data,
    transaction_type: 'PRODUCTION_IN',
    qty_out: 0,
    total_cost: data.material_cost + data.labor_cost + data.overhead_cost,
  };

  const { data: result, error } = await supabase
    .from('wip_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function recordWipOut(
  data: Omit<WipLedgerInsert, 'transaction_type' | 'qty_in'>
): Promise<WipLedger> {
  // Validate no negative stock
  const balance = await getWipBalance(data.company_id, data.product_id, data.stage, data.variant_id);
  if (balance && balance.current_qty < data.qty_out) {
    throw new Error(`Insufficient WIP stock at ${data.stage}. Available: ${balance.current_qty}, Requested: ${data.qty_out}`);
  }

  const entry: WipLedgerInsert = {
    ...data,
    transaction_type: 'PRODUCTION_OUT',
    qty_in: 0,
  };

  const { data: result, error } = await supabase
    .from('wip_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getWipLedger(
  companyId: string,
  productId?: string,
  stage?: WipStage,
  startDate?: string,
  endDate?: string
): Promise<WipLedger[]> {
  let query = supabase
    .from('wip_ledger')
    .select('*')
    .eq('company_id', companyId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (productId) query = query.eq('product_id', productId);
  if (stage) query = query.eq('stage', stage);
  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getWipBalance(
  companyId: string,
  productId: string,
  stage: WipStage,
  variantId?: string
): Promise<WipBalance | null> {
  let query = supabase
    .from('wip_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .eq('stage', stage);

  if (variantId) query = query.eq('variant_id', variantId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllWipBalances(companyId: string): Promise<WipBalance[]> {
  const { data, error } = await supabase
    .from('wip_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .order('product_code')
    .order('stage');

  if (error) throw error;
  return data || [];
}

// ==================== FINISHED GOODS LEDGER ====================

export async function receiveFinishedGoods(
  data: Omit<FinishedGoodsLedgerInsert, 'transaction_type' | 'qty_out' | 'total_cost'>
): Promise<FinishedGoodsLedger> {
  const entry: FinishedGoodsLedgerInsert = {
    ...data,
    transaction_type: 'PRODUCTION_IN',
    qty_out: 0,
    total_cost: data.qty_in * data.unit_cost,
  };

  const { data: result, error } = await supabase
    .from('finished_goods_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function issueFinishedGoods(
  data: Omit<FinishedGoodsLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>
): Promise<FinishedGoodsLedger> {
  // Validate no negative stock
  const balance = await getFinishedGoodsBalance(
    data.company_id, 
    data.product_id, 
    data.variant_id, 
    data.warehouse_id, 
    data.bin_id
  );
  if (balance && balance.current_qty < data.qty_out) {
    throw new Error(`Insufficient FG stock. Available: ${balance.current_qty}, Requested: ${data.qty_out}`);
  }

  const entry: FinishedGoodsLedgerInsert = {
    ...data,
    transaction_type: 'SALES_OUT',
    qty_in: 0,
    total_cost: data.qty_out * data.unit_cost,
  };

  const { data: result, error } = await supabase
    .from('finished_goods_ledger')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function getFinishedGoodsLedger(
  companyId: string,
  productId?: string,
  variantId?: string,
  startDate?: string,
  endDate?: string
): Promise<FinishedGoodsLedger[]> {
  let query = supabase
    .from('finished_goods_ledger')
    .select('*')
    .eq('company_id', companyId)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (productId) query = query.eq('product_id', productId);
  if (variantId) query = query.eq('variant_id', variantId);
  if (startDate) query = query.gte('transaction_date', startDate);
  if (endDate) query = query.lte('transaction_date', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getFinishedGoodsBalance(
  companyId: string,
  productId: string,
  variantId: string,
  warehouseId?: string,
  binId?: string
): Promise<FinishedGoodsBalance | null> {
  let query = supabase
    .from('finished_goods_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .eq('variant_id', variantId);

  if (warehouseId) query = query.eq('warehouse_id', warehouseId);
  if (binId) query = query.eq('bin_id', binId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllFinishedGoodsBalances(companyId: string): Promise<FinishedGoodsBalance[]> {
  const { data, error } = await supabase
    .from('finished_goods_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .order('product_code')
    .order('sku');

  if (error) throw error;
  return data || [];
}

// ==================== INVENTORY ADJUSTMENT ====================

export async function createAdjustment(
  data: InventoryAdjustmentInsert,
  lines: InventoryAdjustmentLineInsert[]
): Promise<InventoryAdjustment> {
  // Create adjustment header
  const { data: adjustment, error: adjError } = await supabase
    .from('inventory_adjustments')
    .insert(data)
    .select()
    .single();

  if (adjError) throw adjError;

  // Create adjustment lines
  const linesWithAdjustmentId = lines.map(line => ({
    ...line,
    adjustment_id: adjustment.id,
    variance_qty: line.actual_qty - line.system_qty,
    variance_amount: (line.actual_qty - line.system_qty) * line.unit_cost,
  }));

  const { error: linesError } = await supabase
    .from('inventory_adjustment_lines')
    .insert(linesWithAdjustmentId);

  if (linesError) throw linesError;

  return adjustment;
}

export async function postAdjustment(adjustmentId: string, userId: string): Promise<void> {
  // Get adjustment with lines
  const { data: adjustment, error: adjError } = await supabase
    .from('inventory_adjustments')
    .select('*, lines:inventory_adjustment_lines(*)')
    .eq('id', adjustmentId)
    .single();

  if (adjError) throw adjError;
  if (adjustment.status !== 'draft') {
    throw new Error('Adjustment is not in draft status');
  }

  // Create ledger entries for each line
  for (const line of adjustment.lines) {
    if (line.variance_qty === 0) continue;

    const isPositive = line.variance_qty > 0;
    const transactionType: TransactionType = isPositive ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';

    if (adjustment.ledger_type === 'RAW') {
      await supabase.from('raw_material_ledger').insert({
        company_id: adjustment.company_id,
        material_id: line.material_id,
        warehouse_id: line.warehouse_id,
        bin_id: line.bin_id,
        period_id: adjustment.period_id,
        transaction_date: adjustment.adjustment_date,
        transaction_type: transactionType,
        reference_type: 'ADJUSTMENT',
        reference_id: adjustmentId,
        reference_number: adjustment.adjustment_number,
        qty_in: isPositive ? Math.abs(line.variance_qty) : 0,
        qty_out: isPositive ? 0 : Math.abs(line.variance_qty),
        unit_cost: line.unit_cost,
        total_cost: Math.abs(line.variance_amount),
        notes: `Adjustment: ${adjustment.reason} - ${line.notes || ''}`,
        created_by: userId,
      });
    } else if (adjustment.ledger_type === 'WIP') {
      await supabase.from('wip_ledger').insert({
        company_id: adjustment.company_id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        stage: line.wip_stage,
        period_id: adjustment.period_id,
        transaction_date: adjustment.adjustment_date,
        transaction_type: transactionType,
        reference_type: 'ADJUSTMENT',
        reference_id: adjustmentId,
        reference_number: adjustment.adjustment_number,
        qty_in: isPositive ? Math.abs(line.variance_qty) : 0,
        qty_out: isPositive ? 0 : Math.abs(line.variance_qty),
        material_cost: 0,
        labor_cost: 0,
        overhead_cost: 0,
        total_cost: Math.abs(line.variance_amount),
        notes: `Adjustment: ${adjustment.reason} - ${line.notes || ''}`,
        created_by: userId,
      });
    } else if (adjustment.ledger_type === 'FG') {
      await supabase.from('finished_goods_ledger').insert({
        company_id: adjustment.company_id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        warehouse_id: line.warehouse_id,
        bin_id: line.bin_id,
        period_id: adjustment.period_id,
        transaction_date: adjustment.adjustment_date,
        transaction_type: transactionType,
        reference_type: 'ADJUSTMENT',
        reference_id: adjustmentId,
        reference_number: adjustment.adjustment_number,
        qty_in: isPositive ? Math.abs(line.variance_qty) : 0,
        qty_out: isPositive ? 0 : Math.abs(line.variance_qty),
        unit_cost: line.unit_cost,
        total_cost: Math.abs(line.variance_amount),
        notes: `Adjustment: ${adjustment.reason} - ${line.notes || ''}`,
        created_by: userId,
      });
    }
  }

  // Update adjustment status
  const { error: updateError } = await supabase
    .from('inventory_adjustments')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_by: userId,
    })
    .eq('id', adjustmentId);

  if (updateError) throw updateError;
}

export async function getAdjustments(
  companyId: string,
  status?: 'draft' | 'posted' | 'cancelled'
): Promise<InventoryAdjustment[]> {
  let query = supabase
    .from('inventory_adjustments')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==================== INTERNAL TRANSFERS ====================

export async function createTransfer(
  data: InternalTransferInsert,
  lines: InternalTransferLineInsert[]
): Promise<InternalTransfer> {
  // Create transfer header
  const { data: transfer, error: transferError } = await supabase
    .from('internal_transfers')
    .insert(data)
    .select()
    .single();

  if (transferError) throw transferError;

  // Create transfer lines
  const linesWithTransferId = lines.map(line => ({
    ...line,
    transfer_id: transfer.id,
  }));

  const { error: linesError } = await supabase
    .from('internal_transfer_lines')
    .insert(linesWithTransferId);

  if (linesError) throw linesError;

  return transfer;
}

export async function postTransfer(transferId: string, userId: string): Promise<void> {
  // Get transfer with lines
  const { data: transfer, error: transferError } = await supabase
    .from('internal_transfers')
    .select('*, lines:internal_transfer_lines(*)')
    .eq('id', transferId)
    .single();

  if (transferError) throw transferError;
  if (transfer.status !== 'draft') {
    throw new Error('Transfer is not in draft status');
  }

  // Create ledger entries for each line (OUT from source, IN to destination)
  for (const line of transfer.lines) {
    if (transfer.ledger_type === 'RAW') {
      // OUT from source
      await supabase.from('raw_material_ledger').insert({
        company_id: transfer.company_id,
        material_id: line.material_id,
        warehouse_id: transfer.from_warehouse_id,
        bin_id: transfer.from_bin_id,
        period_id: transfer.period_id,
        transaction_date: transfer.transfer_date,
        transaction_type: 'TRANSFER_OUT',
        reference_type: 'TRANSFER',
        reference_id: transferId,
        reference_number: transfer.transfer_number,
        qty_in: 0,
        qty_out: line.qty,
        unit_cost: line.unit_cost,
        total_cost: line.qty * line.unit_cost,
        notes: line.notes,
        created_by: userId,
      });

      // IN to destination
      await supabase.from('raw_material_ledger').insert({
        company_id: transfer.company_id,
        material_id: line.material_id,
        warehouse_id: transfer.to_warehouse_id,
        bin_id: transfer.to_bin_id,
        period_id: transfer.period_id,
        transaction_date: transfer.transfer_date,
        transaction_type: 'TRANSFER_IN',
        reference_type: 'TRANSFER',
        reference_id: transferId,
        reference_number: transfer.transfer_number,
        qty_in: line.qty,
        qty_out: 0,
        unit_cost: line.unit_cost,
        total_cost: line.qty * line.unit_cost,
        notes: line.notes,
        created_by: userId,
      });
    } else if (transfer.ledger_type === 'FG') {
      // OUT from source
      await supabase.from('finished_goods_ledger').insert({
        company_id: transfer.company_id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        warehouse_id: transfer.from_warehouse_id,
        bin_id: transfer.from_bin_id,
        period_id: transfer.period_id,
        transaction_date: transfer.transfer_date,
        transaction_type: 'TRANSFER_OUT',
        reference_type: 'TRANSFER',
        reference_id: transferId,
        reference_number: transfer.transfer_number,
        qty_in: 0,
        qty_out: line.qty,
        unit_cost: line.unit_cost,
        total_cost: line.qty * line.unit_cost,
        notes: line.notes,
        created_by: userId,
      });

      // IN to destination
      await supabase.from('finished_goods_ledger').insert({
        company_id: transfer.company_id,
        product_id: line.product_id,
        variant_id: line.variant_id,
        warehouse_id: transfer.to_warehouse_id,
        bin_id: transfer.to_bin_id,
        period_id: transfer.period_id,
        transaction_date: transfer.transfer_date,
        transaction_type: 'TRANSFER_IN',
        reference_type: 'TRANSFER',
        reference_id: transferId,
        reference_number: transfer.transfer_number,
        qty_in: line.qty,
        qty_out: 0,
        unit_cost: line.unit_cost,
        total_cost: line.qty * line.unit_cost,
        notes: line.notes,
        created_by: userId,
      });
    }
  }

  // Update transfer status
  const { error: updateError } = await supabase
    .from('internal_transfers')
    .update({
      status: 'posted',
      posted_at: new Date().toISOString(),
      posted_by: userId,
    })
    .eq('id', transferId);

  if (updateError) throw updateError;
}

export async function getTransfers(
  companyId: string,
  status?: 'draft' | 'posted' | 'cancelled'
): Promise<InternalTransfer[]> {
  let query = supabase
    .from('internal_transfers')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ==================== VALIDATION HELPERS ====================

export async function validateStockAvailability(
  ledgerType: LedgerType,
  companyId: string,
  itemId: string,
  qty: number,
  warehouseId?: string,
  binId?: string,
  variantId?: string,
  stage?: WipStage
): Promise<{ available: boolean; currentQty: number }> {
  let currentQty = 0;

  if (ledgerType === 'RAW') {
    const balance = await getRawMaterialBalance(companyId, itemId, warehouseId, binId);
    currentQty = balance?.current_qty || 0;
  } else if (ledgerType === 'WIP' && stage) {
    const balance = await getWipBalance(companyId, itemId, stage, variantId);
    currentQty = balance?.current_qty || 0;
  } else if (ledgerType === 'FG' && variantId) {
    const balance = await getFinishedGoodsBalance(companyId, itemId, variantId, warehouseId, binId);
    currentQty = balance?.current_qty || 0;
  }

  return {
    available: currentQty >= qty,
    currentQty,
  };
}

export async function getOpenPeriod(companyId: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from('accounting_periods')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
