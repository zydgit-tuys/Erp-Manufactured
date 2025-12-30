// ==================== ENUMS ====================
export type WipStage = 'CUT' | 'SEW' | 'FINISH';
export type LedgerType = 'RAW' | 'WIP' | 'FG';
export type TransactionType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'PRODUCTION_IN'
  | 'PRODUCTION_OUT'
  | 'SALES_OUT';
export type AdjustmentReason =
  | 'STOCK_OPNAME'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'THEFT'
  | 'CORRECTION'
  | 'OTHER';

// ==================== MASTER DATA ====================
export interface Warehouse {
  id: string;
  company_id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  manager_name?: string;
  phone?: string;
  description?: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface Bin {
  id: string;
  warehouse_id: string;
  code: string;
  name: string;
  capacity?: number;
  is_active: boolean;
  created_at: string;
}

// ==================== INVENTORY LEDGERS ====================
export interface RawMaterialLedger {
  id: string;
  company_id: string;
  material_id: string;
  warehouse_id?: string;
  bin_id?: string;
  period_id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface WipLedger {
  id: string;
  company_id: string;
  product_id: string;
  variant_id?: string;
  stage: WipStage;
  period_id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  qty_in: number;
  qty_out: number;
  material_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface FinishedGoodsLedger {
  id: string;
  company_id: string;
  product_id: string;
  variant_id: string;
  warehouse_id?: string;
  bin_id?: string;
  period_id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  total_cost: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

// ==================== BALANCE VIEWS ====================
export interface RawMaterialBalance {
  company_id: string;
  material_id: string;
  warehouse_id?: string;
  bin_id?: string;
  material_code: string;
  material_name: string;
  unit: string;
  current_qty: number;
  current_cost: number;
  avg_unit_cost: number;
  last_updated: string;
}

export interface WipBalance {
  company_id: string;
  product_id: string;
  variant_id?: string;
  stage: WipStage;
  product_code: string;
  product_name: string;
  sku?: string;
  current_qty: number;
  current_cost: number;
  avg_unit_cost: number;
  last_updated: string;
}

export interface FinishedGoodsBalance {
  company_id: string;
  product_id: string;
  variant_id: string;
  warehouse_id?: string;
  bin_id?: string;
  product_code: string;
  product_name: string;
  sku: string;
  current_qty: number;
  current_cost: number;
  avg_unit_cost: number;
  last_updated: string;
}

// ==================== ADJUSTMENT & TRANSFER ====================
export interface InventoryAdjustment {
  id: string;
  company_id: string;
  adjustment_number: string;
  period_id: string;
  adjustment_date: string;
  ledger_type: LedgerType;
  reason: AdjustmentReason;
  reason_detail?: string;
  status: 'draft' | 'posted' | 'cancelled';
  posted_at?: string;
  posted_by?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lines?: InventoryAdjustmentLine[];
}

export interface InventoryAdjustmentLine {
  id: string;
  adjustment_id: string;
  material_id?: string;
  product_id?: string;
  variant_id?: string;
  warehouse_id?: string;
  bin_id?: string;
  wip_stage?: WipStage;
  system_qty: number;
  actual_qty: number;
  variance_qty: number;
  unit_cost: number;
  variance_amount: number;
  notes?: string;
  created_at: string;
}

export interface InternalTransfer {
  id: string;
  company_id: string;
  transfer_number: string;
  period_id: string;
  transfer_date: string;
  ledger_type: LedgerType;
  from_warehouse_id?: string;
  from_bin_id?: string;
  to_warehouse_id?: string;
  to_bin_id?: string;
  status: 'draft' | 'posted' | 'cancelled';
  posted_at?: string;
  posted_by?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  lines?: InternalTransferLine[];
}

export interface InternalTransferLine {
  id: string;
  transfer_id: string;
  material_id?: string;
  product_id?: string;
  variant_id?: string;
  wip_stage?: WipStage;
  qty: number;
  unit_cost: number;
  notes?: string;
  created_at: string;
}

// ==================== INSERT TYPES ====================
export type RawMaterialLedgerInsert = Omit<RawMaterialLedger, 'id' | 'created_at' | 'running_balance' | 'running_cost'>;
export type WipLedgerInsert = Omit<WipLedger, 'id' | 'created_at' | 'running_balance' | 'running_cost'>;
export type FinishedGoodsLedgerInsert = Omit<FinishedGoodsLedger, 'id' | 'created_at' | 'running_balance' | 'running_cost'>;
export type InventoryAdjustmentInsert = Omit<InventoryAdjustment, 'id' | 'created_at' | 'updated_at' | 'adjustment_number' | 'lines'>;
export type InventoryAdjustmentLineInsert = Omit<InventoryAdjustmentLine, 'id' | 'created_at'>;
export type InternalTransferInsert = Omit<InternalTransfer, 'id' | 'created_at' | 'updated_at' | 'transfer_number' | 'lines'>;
export type InternalTransferLineInsert = Omit<InternalTransferLine, 'id' | 'created_at'>;
