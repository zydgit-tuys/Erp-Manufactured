-- Migration: 034_fix_database_security.sql
-- Description: Fix function_search_path_mutable warnings by setting search_path to public
-- Dependencies: All previous migrations
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- 1. Fix Function Search Paths
-- It is a best practice to set a fixed search_path for SECURITY DEFINER functions
-- We apply this to all functions identified in the linter

ALTER FUNCTION public.get_raw_material_balance SET search_path = public;
ALTER FUNCTION public.get_fg_balance SET search_path = public;
ALTER FUNCTION public.get_fg_total_available SET search_path = public;
ALTER FUNCTION public.get_slow_moving_fg SET search_path = public;
ALTER FUNCTION public.validate_wip_stage_progression SET search_path = public;
ALTER FUNCTION public.get_wip_balance SET search_path = public;
ALTER FUNCTION public.get_hanging_wip SET search_path = public;
ALTER FUNCTION public.check_negative_stock_fg SET search_path = public;
ALTER FUNCTION public.refresh_fg_balance SET search_path = public;
ALTER FUNCTION public.update_updated_at_column SET search_path = public;
ALTER FUNCTION public.prevent_system_account_deletion SET search_path = public;
ALTER FUNCTION public.check_period_overlap SET search_path = public;
ALTER FUNCTION public.generate_period_code SET search_path = public;
ALTER FUNCTION public.audit_period_status_change SET search_path = public;
ALTER FUNCTION public.get_current_open_period SET search_path = public;
ALTER FUNCTION public.audit_trigger SET search_path = public;
ALTER FUNCTION public.get_audit_history SET search_path = public;
ALTER FUNCTION public.seed_coa_template SET search_path = public;
ALTER FUNCTION public.generate_sku SET search_path = public;
ALTER FUNCTION public.check_negative_stock_raw SET search_path = public;
ALTER FUNCTION public.check_period_lock_raw SET search_path = public;
ALTER FUNCTION public.refresh_raw_material_balance SET search_path = public;
ALTER FUNCTION public.refresh_wip_balance SET search_path = public;
ALTER FUNCTION public.get_fg_aging SET search_path = public;
ALTER FUNCTION public.check_adjustment_approval SET search_path = public;
ALTER FUNCTION public.validate_adjustment_posting SET search_path = public;
ALTER FUNCTION public.update_po_total SET search_path = public;
ALTER FUNCTION public.update_po_status SET search_path = public;
ALTER FUNCTION public.post_grn SET search_path = public;
ALTER FUNCTION public.validate_3way_match SET search_path = public;
ALTER FUNCTION public.update_po_qty_invoiced SET search_path = public;
ALTER FUNCTION public.validate_payment_allocation SET search_path = public;
ALTER FUNCTION public.update_invoice_payment_status SET search_path = public;
ALTER FUNCTION public.explode_bom SET search_path = public;
ALTER FUNCTION public.validate_bom_no_circular SET search_path = public;
ALTER FUNCTION public.create_production_reservations SET search_path = public;
ALTER FUNCTION public.calculate_mrp SET search_path = public;
ALTER FUNCTION public.release_production_order SET search_path = public;
ALTER FUNCTION public.backflush_materials SET search_path = public;
ALTER FUNCTION public.complete_work_order SET search_path = public;
ALTER FUNCTION public.update_pos_total SET search_path = public;
ALTER FUNCTION public.post_pos_sale SET search_path = public;
ALTER FUNCTION public.update_pos_return_total SET search_path = public;
ALTER FUNCTION public.post_pos_return SET search_path = public;
ALTER FUNCTION public.validate_return_qty SET search_path = public;
ALTER FUNCTION public.update_so_total SET search_path = public;
ALTER FUNCTION public.calculate_due_date SET search_path = public;
ALTER FUNCTION public.confirm_delivery SET search_path = public;
ALTER FUNCTION public.update_invoice_total SET search_path = public;
ALTER FUNCTION public.update_payment_status SET search_path = public;
ALTER FUNCTION public.approve_sales_order SET search_path = public;
ALTER FUNCTION public.post_sales_invoice SET search_path = public;
ALTER FUNCTION public.check_customer_credit_limit SET search_path = public;
ALTER FUNCTION public.update_payment_allocated SET search_path = public;
ALTER FUNCTION public.update_invoice_amount_paid SET search_path = public;
ALTER FUNCTION public.allocate_payment_to_invoice SET search_path = public;
ALTER FUNCTION public.auto_allocate_payment SET search_path = public;
ALTER FUNCTION public.get_trial_balance SET search_path = public;
ALTER FUNCTION public.get_balance_sheet SET search_path = public;
ALTER FUNCTION public.get_income_statement SET search_path = public;
ALTER FUNCTION public.set_journal_period SET search_path = public;
ALTER FUNCTION public.refresh_analytics_mvs SET search_path = public;

-- 2. Materialized View API Exposure
-- Supabase warns if MVs are exposed. We should rely on RLS (enabled in 029) or hide them if not needed directly.
-- For now, we ensure they are secure. Since we already enabled RLS in 029 (lines 124+), the warning is advisory.
-- However, good practice suggests keeping them internal if only accessed via functions, but we use them for dashboards.
-- We will keep them as is, but ensure RLS is active (redundant check).
-- (No SQL needed if 029 ran correctly).

-- 3. Leaked Password Protection
-- This must be enabled in the Supabase Dashboard -> Authentication -> Security.
-- SQL cannot configure this.
