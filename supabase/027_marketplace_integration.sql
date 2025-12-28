-- Migration: 027_marketplace_integration.sql
-- Description: Marketplace integration (Shopee, Tokopedia, TikTok)
-- Dependencies: 022_sales_orders.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE marketplace_platform AS ENUM ('Shopee', 'Tokopedia', 'TikTok', 'Lazada');
CREATE TYPE marketplace_order_status AS ENUM ('pending', 'ready_to_ship', 'in_transit', 'delivered', 'cancelled', 'returned');
CREATE TYPE marketplace_sync_status AS ENUM ('pending', 'synced', 'failed', 'ignored');

-- ==================== MARKETPLACE ACCOUNTS ====================

CREATE TABLE IF NOT EXISTS marketplace_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  platform marketplace_platform NOT NULL,
  account_name VARCHAR(100) NOT NULL, -- e.g. "Ziyada Shopee Official"
  shop_id VARCHAR(100) NOT NULL,
  
  -- Credentials (store encrypted in real app, plain for now/demo)
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TIMESTAMPTZ,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  auto_sync_orders BOOLEAN DEFAULT true,
  auto_sync_inventory BOOLEAN DEFAULT true,
  warehouse_id UUID REFERENCES warehouses(id), -- Default warehouse for this shop
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(company_id, platform, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_account_company ON marketplace_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_mp_account_platform ON marketplace_accounts(platform);

COMMENT ON TABLE marketplace_accounts IS 'Connected marketplace accounts (shops)';

-- ==================== MARKETPLACE ORDERS ====================

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES marketplace_accounts(id) ON DELETE CASCADE NOT NULL,
  
  -- External Data
  external_order_id VARCHAR(100) NOT NULL,
  external_status VARCHAR(50) NOT NULL, -- Raw status from platform
  mapped_status marketplace_order_status NOT NULL,
  
  order_date TIMESTAMPTZ NOT NULL,
  
  -- Customer Info (Usually masked)
  customer_name VARCHAR(200),
  
  -- Financials
  currency VARCHAR(10) DEFAULT 'IDR',
  total_amount DECIMAL(15,2) DEFAULT 0,
  shipping_fee DECIMAL(15,2) DEFAULT 0,
  platform_fee DECIMAL(15,2) DEFAULT 0,
  commission_fee DECIMAL(15,2) DEFAULT 0,
  seller_rebate DECIMAL(15,2) DEFAULT 0,
  
  -- Internal Link
  so_id UUID REFERENCES sales_orders(id), -- Linked internal Sales Order
  sync_status marketplace_sync_status DEFAULT 'pending',
  sync_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(account_id, external_order_id)
);

CREATE INDEX IF NOT EXISTS idx_mp_order_account ON marketplace_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_external ON marketplace_orders(external_order_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_so ON marketplace_orders(so_id);
CREATE INDEX IF NOT EXISTS idx_mp_order_date ON marketplace_orders(order_date DESC);

COMMENT ON TABLE marketplace_orders IS 'Orders synced from external marketplaces';

-- ==================== MARKETPLACE ORDER ITEMS ====================

CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES marketplace_orders(id) ON DELETE CASCADE NOT NULL,
  
  external_item_id VARCHAR(100),
  sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  original_price DECIMAL(15,2) NOT NULL,
  deal_price DECIMAL(15,2) NOT NULL, -- Actual price paid
  
  -- Link to internal product
  product_variant_id UUID REFERENCES product_variants(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mp_item_order ON marketplace_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_mp_item_sku ON marketplace_order_items(sku);

COMMENT ON TABLE marketplace_order_items IS 'Line items for marketplace orders';

-- ==================== MARKETPLACE SETTLEMENTS ====================

CREATE TABLE IF NOT EXISTS marketplace_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES marketplace_accounts(id) NOT NULL,
  
  settlement_ref VARCHAR(100) NOT NULL, -- Payout/Withdrawal ID
  start_date DATE,
  end_date DATE,
  payout_date DATE NOT NULL,
  
  amount_gross DECIMAL(15,2) NOT NULL,
  amount_fees DECIMAL(15,2) NOT NULL, -- Total deductions
  amount_net DECIMAL(15,2) NOT NULL, -- Final payout
  
  status VARCHAR(20) DEFAULT 'processed',
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(account_id, settlement_ref)
);

CREATE INDEX IF NOT EXISTS idx_mp_settlement_account ON marketplace_settlements(account_id);
CREATE INDEX IF NOT EXISTS idx_mp_settlement_date ON marketplace_settlements(payout_date DESC);

COMMENT ON TABLE marketplace_settlements IS 'Financial settlements/payouts from marketplaces';

-- ==================== RLS POLICIES ====================

ALTER TABLE marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_settlements ENABLE ROW LEVEL SECURITY;

-- Accounts
CREATE POLICY mp_accounts_tenant_isolation ON marketplace_accounts
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- Orders
CREATE POLICY mp_orders_tenant_isolation ON marketplace_orders
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- Order Items
CREATE POLICY mp_items_tenant_isolation ON marketplace_order_items
  FOR ALL USING (order_id IN (
    SELECT id FROM marketplace_orders WHERE company_id IN (
      SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- Settlements
CREATE POLICY mp_settlements_tenant_isolation ON marketplace_settlements
  FOR ALL USING (company_id IN (
    SELECT company_id FROM user_company_mapping WHERE user_id = auth.uid() AND is_active = true
  ));

-- Service Role Bypass
CREATE POLICY mp_accounts_service ON marketplace_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mp_orders_service ON marketplace_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mp_items_service ON marketplace_order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY mp_settlements_service ON marketplace_settlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==================== AUDIT TRIGGERS ====================

CREATE TRIGGER trigger_audit_mp_accounts
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER trigger_audit_mp_orders
  AFTER INSERT OR UPDATE OR DELETE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

