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

// ==================== HELPER: Get Auth Token ====================

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

async function callEdgeFunction<T>(functionName: string, payload: any): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to call ${functionName}`);
  }

  const result = await response.json();
  return result.data;
}

// ==================== RAW MATERIAL LEDGER ====================

export async function receiveRawMaterial(
  data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_out' | 'total_cost'>
): Promise<RawMaterialLedger> {
  return callEdgeFunction<RawMaterialLedger>('receive-raw-material', data);
}

export async function issueRawMaterial(
  data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>
): Promise<RawMaterialLedger> {
  return callEdgeFunction<RawMaterialLedger>('issue-raw-material', data);
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
  data: Omit<WipLedgerInsert, 'qty_out'>
): Promise<WipLedger> {
  const entry: WipLedgerInsert = {
    ...data,
    qty_out: 0,
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
  data: Omit<WipLedgerInsert, 'qty_in'>
): Promise<WipLedger> {
  const entry: WipLedgerInsert = {
    ...data,
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
  return callEdgeFunction<FinishedGoodsLedger>('receive-finished-goods', data);
}

export async function issueFinishedGoods(
  data: Omit<FinishedGoodsLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>
): Promise<FinishedGoodsLedger> {
  return callEdgeFunction<FinishedGoodsLedger>('issue-finished-goods', data);
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
  variantId?: string,
  warehouseId?: string,
  binId?: string
): Promise<FinishedGoodsBalance | null> {
  let query = supabase
    .from('finished_goods_balance_mv')
    .select('*')
    .eq('company_id', companyId)
    .eq('product_id', productId);

  if (variantId) query = query.eq('variant_id', variantId);
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
    .order('product_code');

  if (error) throw error;
  return data || [];
}

// ==================== INVENTORY ADJUSTMENTS ====================

export async function createAdjustment(
  adjustment: InventoryAdjustmentInsert,
  lines: InventoryAdjustmentLineInsert[]
): Promise<InventoryAdjustment> {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .insert(adjustment)
    .select()
    .single();

  if (error) throw error;

  const linesWithAdjustmentId = lines.map(line => ({
    ...line,
    adjustment_id: data.id,
  }));

  const { error: linesError } = await supabase
    .from('inventory_adjustment_lines')
    .insert(linesWithAdjustmentId);

  if (linesError) throw linesError;

  return data;
}

export async function postAdjustment(
  adjustmentId: string,
  userId: string
): Promise<void> {
  await callEdgeFunction('post-adjustment', {
    adjustment_id: adjustmentId,
    user_id: userId,
  });
}

export async function getAdjustments(companyId: string): Promise<InventoryAdjustment[]> {
  const { data, error } = await supabase
    .from('inventory_adjustments')
    .select('*')
    .eq('company_id', companyId)
    .order('adjustment_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ==================== INTERNAL TRANSFERS ====================

export async function createTransfer(
  transfer: InternalTransferInsert,
  lines: InternalTransferLineInsert[]
): Promise<InternalTransfer> {
  const { data, error } = await supabase
    .from('internal_transfers')
    .insert(transfer)
    .select()
    .single();

  if (error) throw error;

  const linesWithTransferId = lines.map(line => ({
    ...line,
    transfer_id: data.id,
  }));

  const { error: linesError } = await supabase
    .from('internal_transfer_lines')
    .insert(linesWithTransferId);

  if (linesError) throw linesError;

  return data;
}

export async function postTransfer(
  transferId: string,
  userId: string
): Promise<void> {
  await callEdgeFunction('post-transfer', {
    transfer_id: transferId,
    user_id: userId,
  });
}

export async function getTransfers(companyId: string): Promise<InternalTransfer[]> {
  const { data, error } = await supabase
    .from('internal_transfers')
    .select('*')
    .eq('company_id', companyId)
    .order('transfer_date', { ascending: false });

  if (error) throw error;
  return data || [];
}
