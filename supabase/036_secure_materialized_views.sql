-- Migration: 036_secure_materialized_views.sql
-- Description: Revoke anon access from Materialized Views to address security warnings.
--              Ensure authenticated users can still access them (via RLS).
-- Dependencies: 029_analytics_mvs.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- Postgres uses 'ON TABLE' for Materialized Views permissions
-- Revoke all permissions from anon (unauthenticated users)
REVOKE ALL ON TABLE public.mv_sales_performance FROM anon;
REVOKE ALL ON TABLE public.mv_inventory_valuation FROM anon;
REVOKE ALL ON TABLE public.raw_material_balance_mv FROM anon;
REVOKE ALL ON TABLE public.mv_financial_summary FROM anon;
REVOKE ALL ON TABLE public.wip_balance_mv FROM anon;
REVOKE ALL ON TABLE public.finished_goods_balance_mv FROM anon;
REVOKE ALL ON TABLE public.finished_goods_summary_mv FROM anon;

-- Explicitly Grant SELECT to authenticated users (just in case)
GRANT SELECT ON TABLE public.mv_sales_performance TO authenticated;
GRANT SELECT ON TABLE public.mv_inventory_valuation TO authenticated;
GRANT SELECT ON TABLE public.raw_material_balance_mv TO authenticated;
GRANT SELECT ON TABLE public.mv_financial_summary TO authenticated;
GRANT SELECT ON TABLE public.wip_balance_mv TO authenticated;
GRANT SELECT ON TABLE public.finished_goods_balance_mv TO authenticated;
GRANT SELECT ON TABLE public.finished_goods_summary_mv TO authenticated;

-- Note: RLS was already enabled in 029/030, so authenticated users will still be restricted by Company ID.
