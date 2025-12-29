
-- Migration: 048_product_categories.sql
-- Description: Create product_categories table for dynamic master data
-- TIMESTAMP: 2025-12-29 05:25:00

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, name)
);

CREATE INDEX idx_product_categories_company ON product_categories(company_id);
CREATE INDEX idx_product_categories_active ON product_categories(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY product_categories_isolation ON product_categories
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY product_categories_service_role ON product_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default categories for existing companies (optional, simplified for now to just be empty or let user add)
-- But we can insert some defaults if we want, similar to seed_coa. 
-- For now, we leave it empty or user adds them.
