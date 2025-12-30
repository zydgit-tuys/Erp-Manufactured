import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handleSupabaseError } from '@/utils/errorHandler';
import * as inventoryService from '@/services/inventory.service';
import type {
  RawMaterialLedgerInsert,
  WipLedgerInsert,
  FinishedGoodsLedgerInsert,
  InventoryAdjustmentInsert,
  InventoryAdjustmentLineInsert,
  InternalTransferInsert,
  InternalTransferLineInsert,
  WipStage,
} from '@/types/inventory';

// ==================== RAW MATERIAL HOOKS ====================

export function useRawMaterialLedger(
  companyId: string,
  materialId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['raw-material-ledger', companyId, materialId, startDate, endDate],
    queryFn: () => inventoryService.getRawMaterialLedger(companyId, materialId, startDate, endDate),
    enabled: !!companyId,
  });
}

export function useRawMaterialBalances(companyId: string) {
  return useQuery({
    queryKey: ['raw-material-balances', companyId],
    queryFn: () => inventoryService.getAllRawMaterialBalances(companyId),
    enabled: !!companyId,
  });
}

export function useReceiveRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_out' | 'total_cost'>) =>
      inventoryService.receiveRawMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-balances'] });
      toast({ title: 'Material received successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to receive material', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useIssueRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<RawMaterialLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>) =>
      inventoryService.issueRawMaterial(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-material-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-balances'] });
      toast({ title: 'Material issued successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to issue material', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== WIP HOOKS ====================

export function useWipLedger(
  companyId: string,
  productId?: string,
  stage?: WipStage,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['wip-ledger', companyId, productId, stage, startDate, endDate],
    queryFn: () => inventoryService.getWipLedger(companyId, productId, stage, startDate, endDate),
    enabled: !!companyId,
  });
}

export function useWipBalances(companyId: string) {
  return useQuery({
    queryKey: ['wip-balances', companyId],
    queryFn: () => inventoryService.getAllWipBalances(companyId),
    enabled: !!companyId,
  });
}

export function useRecordWipIn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<WipLedgerInsert, 'transaction_type' | 'qty_out'>) =>
      inventoryService.recordWipIn({ ...data, transaction_type: 'PRODUCTION_IN' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['wip-balances'] });
      toast({ title: 'WIP recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record WIP', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useRecordWipOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<WipLedgerInsert, 'transaction_type' | 'qty_in'>) =>
      inventoryService.recordWipOut({ ...data, transaction_type: 'PRODUCTION_OUT' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wip-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['wip-balances'] });
      toast({ title: 'WIP output recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record WIP output', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== FINISHED GOODS HOOKS ====================

export function useFinishedGoodsLedger(
  companyId: string,
  productId?: string,
  variantId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ['fg-ledger', companyId, productId, variantId, startDate, endDate],
    queryFn: () => inventoryService.getFinishedGoodsLedger(companyId, productId, variantId, startDate, endDate),
    enabled: !!companyId,
  });
}

export function useFinishedGoodsBalances(companyId: string) {
  return useQuery({
    queryKey: ['fg-balances', companyId],
    queryFn: () => inventoryService.getAllFinishedGoodsBalances(companyId),
    enabled: !!companyId,
  });
}

export function useReceiveFinishedGoods() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<FinishedGoodsLedgerInsert, 'transaction_type' | 'qty_out' | 'total_cost'>) =>
      inventoryService.receiveFinishedGoods(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fg-balances'] });
      toast({ title: 'Finished goods received successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to receive finished goods', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function useIssueFinishedGoods() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Omit<FinishedGoodsLedgerInsert, 'transaction_type' | 'qty_in' | 'total_cost'>) =>
      inventoryService.issueFinishedGoods(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fg-balances'] });
      toast({ title: 'Finished goods issued successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to issue finished goods', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== ADJUSTMENT HOOKS ====================

export function useInventoryAdjustments(companyId: string, status?: 'draft' | 'posted' | 'cancelled') {
  return useQuery({
    queryKey: ['adjustments', companyId, status],
    queryFn: () => inventoryService.getAdjustments(companyId, status),
    enabled: !!companyId,
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ data, lines }: { data: InventoryAdjustmentInsert; lines: InventoryAdjustmentLineInsert[] }) =>
      inventoryService.createAdjustment(data, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      toast({ title: 'Adjustment created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create adjustment', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function usePostAdjustment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ adjustmentId, userId }: { adjustmentId: string; userId: string }) =>
      inventoryService.postAdjustment(adjustmentId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-balances'] });
      queryClient.invalidateQueries({ queryKey: ['wip-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['wip-balances'] });
      queryClient.invalidateQueries({ queryKey: ['fg-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fg-balances'] });
      toast({ title: 'Adjustment posted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to post adjustment', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== TRANSFER HOOKS ====================

export function useInternalTransfers(companyId: string, status?: 'draft' | 'posted' | 'cancelled') {
  return useQuery({
    queryKey: ['transfers', companyId, status],
    queryFn: () => inventoryService.getTransfers(companyId, status),
    enabled: !!companyId,
  });
}

export function useInternalTransfer(id: string) {
  return useQuery({
    queryKey: ['transfer', id],
    queryFn: () => inventoryService.getTransferById(id),
    enabled: !!id,
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ data, lines }: { data: InternalTransferInsert; lines: InternalTransferLineInsert[] }) => {
      // Find open period if not provided
      if (!data.period_id || data.period_id === '00000000-0000-0000-0000-000000000000') {
        const { data: period, error: periodError } = await supabase
          .from('accounting_periods')
          .select('id')
          .eq('company_id', data.company_id)
          .lte('start_date', data.transfer_date)
          .gte('end_date', data.transfer_date)
          .eq('status', 'open')
          .single();

        if (periodError || !period) {
          throw new Error(`No open accounting period found for date ${data.transfer_date}`);
        }
        data.period_id = period.id;
      }

      return inventoryService.createTransfer(data, lines);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: 'Transfer created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create transfer', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

export function usePostTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ transferId, userId }: { transferId: string; userId: string }) =>
      inventoryService.postTransfer(transferId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-balances'] });
      queryClient.invalidateQueries({ queryKey: ['fg-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['fg-balances'] });
      toast({ title: 'Transfer posted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to post transfer', description: handleSupabaseError(error), variant: 'destructive' });
    },
  });
}

// ==================== AUTOMATION HOOKS ====================

export interface LowStockAlert {
  variant_id: string;
  company_id: string;
  product_name: string;
  sku: string;
  procurement_method: 'buy' | 'make' | 'both';
  reorder_point: number;
  reorder_qty: number;
  current_stock: number;
  preferred_vendor_id?: string;
  vendor_name?: string;
  unit_of_measure: string;
}

export function useLowStockAlerts(companyId: string) {
  return useQuery({
    queryKey: ['low-stock-alerts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('low_stock_alerts_vw')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;
      return data as LowStockAlert[];
    },
    enabled: !!companyId,
  });
}

// Hook to fetch product stock summary (company wide)
export function useProductStocks(companyId: string) {
  return useQuery({
    queryKey: ['product-stocks', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('finished_goods_summary_mv')
        .select('product_variant_id, total_current_qty')
        .eq('company_id', companyId);

      if (error) throw error;
      return data as { product_variant_id: string; total_current_qty: number }[];
    },
    enabled: !!companyId
  });
}
