-- Migration: 032_fix_permissions.sql
-- Description: Fix 403 Forbidden errors by granting permissions to authenticated role
-- Dependencies: All previous migrations
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant permissions on all sequences (for ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Ensure future tables get these permissions locally (optional but good practice)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

-- Specific fix for Materialized Views if any (M8)
-- GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA public TO authenticated;
-- (Postgres 14+ syntax might vary, keeping it simple for tables)
