-- Migration: 035_fix_view_security.sql
-- Description: Fix security_definer_view errors by enabling security_invoker on all views.
--              This ensures RLS policies on underlying tables are checked against the current user.
-- Dependencies: All previous migrations
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- Enable security_invoker for all public views identified in the linter
-- This forces the view to verify RLS policies based on the *invoking user* (the logged-in user),
-- preventing data leakage across tenants (companies).

ALTER VIEW public.sales_invoice_summary_vw SET (security_invoker = true);
ALTER VIEW public.outstanding_po_vw SET (security_invoker = true);
ALTER VIEW public.customer_credit_status_vw SET (security_invoker = true);
ALTER VIEW public.sales_order_summary_vw SET (security_invoker = true);
ALTER VIEW public.outstanding_sales_orders_vw SET (security_invoker = true);
ALTER VIEW public.customer_ar_balance_vw SET (security_invoker = true);
ALTER VIEW public.pending_deliveries_vw SET (security_invoker = true);
ALTER VIEW public.unallocated_payments_vw SET (security_invoker = true);
ALTER VIEW public.daily_pos_sales_vw SET (security_invoker = true);
ALTER VIEW public.ar_payment_summary_vw SET (security_invoker = true);
ALTER VIEW public.pos_return_rate_vw SET (security_invoker = true);
ALTER VIEW public.overdue_invoices_vw SET (security_invoker = true);
ALTER VIEW public.ar_aging_vw SET (security_invoker = true);
ALTER VIEW public.bom_summary_vw SET (security_invoker = true);
ALTER VIEW public.payment_allocation_details_vw SET (security_invoker = true);
ALTER VIEW public.work_order_summary_vw SET (security_invoker = true);
ALTER VIEW public.payment_summary_vw SET (security_invoker = true);
ALTER VIEW public.production_order_summary_vw SET (security_invoker = true);
ALTER VIEW public.production_cost_detail_vw SET (security_invoker = true);
ALTER VIEW public.pos_return_summary_vw SET (security_invoker = true);
ALTER VIEW public.ap_aging_vw SET (security_invoker = true);
ALTER VIEW public.delivery_note_summary_vw SET (security_invoker = true);

-- Note: Materialized Views do not support security_invoker directly in the same way,
-- but they store snapshot data. RLS on MVs was enabled in migration 029.
