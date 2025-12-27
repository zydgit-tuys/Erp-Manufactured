-- ============================================
-- M0 FOUNDATION - Database Schema Migration
-- Run this BEFORE M1_inventory_core.sql
-- ============================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE period_status AS ENUM ('open', 'closed', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== COMPANIES ====================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  tax_id VARCHAR(50),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==================== USER PROFILES ====================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name VARCHAR(200),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== USER ROLES ====================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- ==================== MATERIALS ====================
CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  min_stock_level NUMERIC(15,4) DEFAULT 0,
  standard_cost NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Auto-generate material code
CREATE OR REPLACE FUNCTION generate_material_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'MAT-(\d+)') AS INT)), 0) + 1
    INTO next_num
    FROM materials
    WHERE company_id = NEW.company_id;
    
    NEW.code := 'MAT-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_material_code ON materials;
CREATE TRIGGER gen_material_code
  BEFORE INSERT ON materials
  FOR EACH ROW EXECUTE FUNCTION generate_material_code();

-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  base_price NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Auto-generate product code
CREATE OR REPLACE FUNCTION generate_product_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'PRD-(\d+)') AS INT)), 0) + 1
    INTO next_num
    FROM products
    WHERE company_id = NEW.company_id;
    
    NEW.code := 'PRD-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_product_code ON products;
CREATE TRIGGER gen_product_code
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION generate_product_code();

-- ==================== PRODUCT VARIANTS ====================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  size VARCHAR(20),
  color VARCHAR(50),
  additional_price NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, sku)
);

-- Auto-generate SKU
CREATE OR REPLACE FUNCTION generate_variant_sku()
RETURNS TRIGGER AS $$
DECLARE
  product_code VARCHAR(50);
BEGIN
  IF NEW.sku IS NULL OR NEW.sku = '' THEN
    SELECT code INTO product_code FROM products WHERE id = NEW.product_id;
    NEW.sku := product_code || '-' || COALESCE(NEW.size, 'OS') || '-' || COALESCE(SUBSTRING(NEW.color, 1, 3), 'STD');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_variant_sku ON product_variants;
CREATE TRIGGER gen_variant_sku
  BEFORE INSERT ON product_variants
  FOR EACH ROW EXECUTE FUNCTION generate_variant_sku();

-- ==================== VENDORS ====================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  contact_person VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Auto-generate vendor code
CREATE OR REPLACE FUNCTION generate_vendor_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'VND-(\d+)') AS INT)), 0) + 1
    INTO next_num
    FROM vendors
    WHERE company_id = NEW.company_id;
    
    NEW.code := 'VND-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_vendor_code ON vendors;
CREATE TRIGGER gen_vendor_code
  BEFORE INSERT ON vendors
  FOR EACH ROW EXECUTE FUNCTION generate_vendor_code();

-- ==================== CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(100),
  contact_person VARCHAR(200),
  credit_limit NUMERIC(18,4) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- Auto-generate customer code
CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 'CUS-(\d+)') AS INT)), 0) + 1
    INTO next_num
    FROM customers
    WHERE company_id = NEW.company_id;
    
    NEW.code := 'CUS-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_customer_code ON customers;
CREATE TRIGGER gen_customer_code
  BEFORE INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION generate_customer_code();

-- ==================== CHART OF ACCOUNTS ====================
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  is_header BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  normal_balance VARCHAR(10) NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

-- ==================== ACCOUNTING PERIODS ====================
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status period_status NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name),
  CHECK (end_date >= start_date)
);

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_company ON materials(company_id);
CREATE INDEX IF NOT EXISTS idx_materials_code ON materials(code);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_vendors_company ON vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_company ON accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
CREATE INDEX IF NOT EXISTS idx_periods_company ON accounting_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_periods_status ON accounting_periods(status);

-- ==================== RLS POLICIES ====================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

-- Companies
CREATE POLICY "Users can view their company" ON companies
  FOR SELECT TO authenticated
  USING (id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage companies" ON companies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User Profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view company profiles" ON user_profiles
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- User Roles
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Materials
CREATE POLICY "Users can view company materials" ON materials
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company materials" ON materials
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Products
CREATE POLICY "Users can view company products" ON products
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company products" ON products
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Product Variants
CREATE POLICY "Users can view company variants" ON product_variants
  FOR SELECT TO authenticated
  USING (product_id IN (
    SELECT p.id FROM products p 
    JOIN user_profiles up ON up.company_id = p.company_id 
    WHERE up.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage company variants" ON product_variants
  FOR ALL TO authenticated
  USING (product_id IN (
    SELECT p.id FROM products p 
    JOIN user_profiles up ON up.company_id = p.company_id 
    WHERE up.user_id = auth.uid()
  ));

-- Vendors
CREATE POLICY "Users can view company vendors" ON vendors
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company vendors" ON vendors
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Customers
CREATE POLICY "Users can view company customers" ON customers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company customers" ON customers
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Accounts
CREATE POLICY "Users can view company accounts" ON accounts
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company accounts" ON accounts
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Accounting Periods
CREATE POLICY "Users can view company periods" ON accounting_periods
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company periods" ON accounting_periods
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- ==================== SEED DATA: DEFAULT CHART OF ACCOUNTS (Konveksi) ====================
-- Note: Run this after creating a company, replacing the company_id

/*
-- Example seed for Chart of Accounts (Indonesian Konveksi template)
INSERT INTO accounts (company_id, code, name, account_type, is_header, normal_balance) VALUES
-- ASSETS
('YOUR_COMPANY_ID', '1-0000', 'ASET', 'asset', true, 'debit'),
('YOUR_COMPANY_ID', '1-1000', 'Aset Lancar', 'asset', true, 'debit'),
('YOUR_COMPANY_ID', '1-1100', 'Kas & Bank', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-1200', 'Piutang Usaha', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-1300', 'Persediaan Bahan Baku', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-1400', 'Persediaan Barang Dalam Proses', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-1500', 'Persediaan Barang Jadi', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-2000', 'Aset Tetap', 'asset', true, 'debit'),
('YOUR_COMPANY_ID', '1-2100', 'Mesin & Peralatan', 'asset', false, 'debit'),
('YOUR_COMPANY_ID', '1-2200', 'Akumulasi Penyusutan', 'asset', false, 'credit'),

-- LIABILITIES
('YOUR_COMPANY_ID', '2-0000', 'KEWAJIBAN', 'liability', true, 'credit'),
('YOUR_COMPANY_ID', '2-1000', 'Kewajiban Lancar', 'liability', true, 'credit'),
('YOUR_COMPANY_ID', '2-1100', 'Hutang Usaha', 'liability', false, 'credit'),
('YOUR_COMPANY_ID', '2-1200', 'Hutang Pajak', 'liability', false, 'credit'),
('YOUR_COMPANY_ID', '2-1300', 'Hutang Gaji', 'liability', false, 'credit'),

-- EQUITY
('YOUR_COMPANY_ID', '3-0000', 'EKUITAS', 'equity', true, 'credit'),
('YOUR_COMPANY_ID', '3-1000', 'Modal Disetor', 'equity', false, 'credit'),
('YOUR_COMPANY_ID', '3-2000', 'Laba Ditahan', 'equity', false, 'credit'),
('YOUR_COMPANY_ID', '3-3000', 'Laba Tahun Berjalan', 'equity', false, 'credit'),

-- REVENUE
('YOUR_COMPANY_ID', '4-0000', 'PENDAPATAN', 'revenue', true, 'credit'),
('YOUR_COMPANY_ID', '4-1000', 'Penjualan', 'revenue', false, 'credit'),
('YOUR_COMPANY_ID', '4-2000', 'Diskon Penjualan', 'revenue', false, 'debit'),
('YOUR_COMPANY_ID', '4-3000', 'Retur Penjualan', 'revenue', false, 'debit'),

-- EXPENSES
('YOUR_COMPANY_ID', '5-0000', 'HARGA POKOK PENJUALAN', 'expense', true, 'debit'),
('YOUR_COMPANY_ID', '5-1000', 'HPP - Bahan Baku', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '5-2000', 'HPP - Tenaga Kerja Langsung', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '5-3000', 'HPP - Overhead Pabrik', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '5-4000', 'Selisih Persediaan', 'expense', false, 'debit'),

('YOUR_COMPANY_ID', '6-0000', 'BEBAN OPERASIONAL', 'expense', true, 'debit'),
('YOUR_COMPANY_ID', '6-1000', 'Beban Gaji & Upah', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '6-2000', 'Beban Listrik & Air', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '6-3000', 'Beban Sewa', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '6-4000', 'Beban Penyusutan', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '6-5000', 'Beban Administrasi', 'expense', false, 'debit'),
('YOUR_COMPANY_ID', '6-6000', 'Beban Pengiriman', 'expense', false, 'debit');
*/
