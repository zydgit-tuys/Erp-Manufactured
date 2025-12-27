-- Migration: 031_company_settings.sql
-- Description: Add settings column to companies table for module configuration
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'settings'
    ) THEN
        ALTER TABLE companies ADD COLUMN settings JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN companies.settings IS 'Configuration for modules (e.g. {modules: {marketplace: true}})';

-- Ensure new column is accessible
GRANT ALL ON companies TO service_role;
GRANT SELECT, UPDATE ON companies TO authenticated;
