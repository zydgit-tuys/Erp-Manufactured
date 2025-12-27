-- ============================================
-- M1 INVENTORY CORE - Database Schema Migration
-- ============================================

-- ==================== ENUMS ====================
DO $$ BEGIN
  CREATE TYPE wip_stage AS ENUM ('CUT', 'SEW', 'FINISH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE ledger_type AS ENUM ('RAW', 'WIP', 'FG');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM (
    'RECEIPT', 'ISSUE', 
    'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 
    'TRANSFER_IN', 'TRANSFER_OUT',
    'PRODUCTION_IN', 'PRODUCTION_OUT', 
    'SALES_OUT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE adjustment_reason AS ENUM (
    'STOCK_OPNAME', 'DAMAGED', 'EXPIRED', 'THEFT', 'CORRECTION', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('draft', 'posted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==================== WAREHOUSES & BINS ====================
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, code)
);

-- ==================== RAW MATERIAL LEDGER (APPEND-ONLY) ====================
CREATE TABLE IF NOT EXISTS raw_material_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),
  warehouse_id UUID REFERENCES warehouses(id),
  bin_id UUID REFERENCES bins(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(50),
  qty_in NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_in >= 0),
  qty_out NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_out >= 0),
  unit_cost NUMERIC(18,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(18,4) NOT NULL,
  running_balance NUMERIC(15,4) NOT NULL DEFAULT 0,
  running_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent updates/deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be modified or deleted. Create an adjustment instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS raw_material_ledger_immutable ON raw_material_ledger;
CREATE TRIGGER raw_material_ledger_immutable
  BEFORE UPDATE OR DELETE ON raw_material_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

-- Calculate running balance on insert
CREATE OR REPLACE FUNCTION calc_raw_material_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  prev_balance NUMERIC(15,4);
  prev_cost NUMERIC(18,4);
BEGIN
  SELECT COALESCE(running_balance, 0), COALESCE(running_cost, 0)
  INTO prev_balance, prev_cost
  FROM raw_material_ledger
  WHERE company_id = NEW.company_id 
    AND material_id = NEW.material_id
    AND COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.warehouse_id, '00000000-0000-0000-0000-000000000000')
    AND COALESCE(bin_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.bin_id, '00000000-0000-0000-0000-000000000000')
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.running_balance := COALESCE(prev_balance, 0) + NEW.qty_in - NEW.qty_out;
  NEW.running_cost := COALESCE(prev_cost, 0) + (NEW.qty_in * NEW.unit_cost) - (NEW.qty_out * NEW.unit_cost);

  -- Prevent negative stock
  IF NEW.running_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', prev_balance, NEW.qty_out;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_raw_balance ON raw_material_ledger;
CREATE TRIGGER calc_raw_balance
  BEFORE INSERT ON raw_material_ledger
  FOR EACH ROW EXECUTE FUNCTION calc_raw_material_running_balance();

-- ==================== WIP LEDGER (APPEND-ONLY) ====================
CREATE TABLE IF NOT EXISTS wip_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  stage wip_stage NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(50),
  qty_in NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_in >= 0),
  qty_out NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_out >= 0),
  material_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (material_cost >= 0),
  labor_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  overhead_cost NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (overhead_cost >= 0),
  total_cost NUMERIC(18,4) NOT NULL,
  running_balance NUMERIC(15,4) NOT NULL DEFAULT 0,
  running_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS wip_ledger_immutable ON wip_ledger;
CREATE TRIGGER wip_ledger_immutable
  BEFORE UPDATE OR DELETE ON wip_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE OR REPLACE FUNCTION calc_wip_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  prev_balance NUMERIC(15,4);
  prev_cost NUMERIC(18,4);
BEGIN
  SELECT COALESCE(running_balance, 0), COALESCE(running_cost, 0)
  INTO prev_balance, prev_cost
  FROM wip_ledger
  WHERE company_id = NEW.company_id 
    AND product_id = NEW.product_id
    AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.variant_id, '00000000-0000-0000-0000-000000000000')
    AND stage = NEW.stage
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.running_balance := COALESCE(prev_balance, 0) + NEW.qty_in - NEW.qty_out;
  NEW.running_cost := COALESCE(prev_cost, 0) + NEW.total_cost;

  IF NEW.running_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient WIP stock at stage %. Available: %, Requested: %', NEW.stage, prev_balance, NEW.qty_out;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_wip_balance ON wip_ledger;
CREATE TRIGGER calc_wip_balance
  BEFORE INSERT ON wip_ledger
  FOR EACH ROW EXECUTE FUNCTION calc_wip_running_balance();

-- ==================== FINISHED GOODS LEDGER (APPEND-ONLY) ====================
CREATE TABLE IF NOT EXISTS finished_goods_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id UUID REFERENCES warehouses(id),
  bin_id UUID REFERENCES bins(id),
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  transaction_date DATE NOT NULL,
  transaction_type transaction_type NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  reference_number VARCHAR(50),
  qty_in NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_in >= 0),
  qty_out NUMERIC(15,4) NOT NULL DEFAULT 0 CHECK (qty_out >= 0),
  unit_cost NUMERIC(18,4) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(18,4) NOT NULL,
  running_balance NUMERIC(15,4) NOT NULL DEFAULT 0,
  running_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

DROP TRIGGER IF EXISTS fg_ledger_immutable ON finished_goods_ledger;
CREATE TRIGGER fg_ledger_immutable
  BEFORE UPDATE OR DELETE ON finished_goods_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();

CREATE OR REPLACE FUNCTION calc_fg_running_balance()
RETURNS TRIGGER AS $$
DECLARE
  prev_balance NUMERIC(15,4);
  prev_cost NUMERIC(18,4);
BEGIN
  SELECT COALESCE(running_balance, 0), COALESCE(running_cost, 0)
  INTO prev_balance, prev_cost
  FROM finished_goods_ledger
  WHERE company_id = NEW.company_id 
    AND product_id = NEW.product_id
    AND variant_id = NEW.variant_id
    AND COALESCE(warehouse_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.warehouse_id, '00000000-0000-0000-0000-000000000000')
    AND COALESCE(bin_id, '00000000-0000-0000-0000-000000000000') = COALESCE(NEW.bin_id, '00000000-0000-0000-0000-000000000000')
  ORDER BY created_at DESC
  LIMIT 1;

  NEW.running_balance := COALESCE(prev_balance, 0) + NEW.qty_in - NEW.qty_out;
  NEW.running_cost := COALESCE(prev_cost, 0) + (NEW.qty_in * NEW.unit_cost) - (NEW.qty_out * NEW.unit_cost);

  IF NEW.running_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient FG stock. Available: %, Requested: %', prev_balance, NEW.qty_out;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_fg_balance ON finished_goods_ledger;
CREATE TRIGGER calc_fg_balance
  BEFORE INSERT ON finished_goods_ledger
  FOR EACH ROW EXECUTE FUNCTION calc_fg_running_balance();

-- ==================== INVENTORY ADJUSTMENTS ====================
CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  adjustment_number VARCHAR(50) NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  adjustment_date DATE NOT NULL,
  ledger_type ledger_type NOT NULL,
  reason adjustment_reason NOT NULL,
  reason_detail TEXT,
  status document_status NOT NULL DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, adjustment_number)
);

CREATE TABLE IF NOT EXISTS inventory_adjustment_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  warehouse_id UUID REFERENCES warehouses(id),
  bin_id UUID REFERENCES bins(id),
  wip_stage wip_stage,
  system_qty NUMERIC(15,4) NOT NULL,
  actual_qty NUMERIC(15,4) NOT NULL,
  variance_qty NUMERIC(15,4) NOT NULL,
  unit_cost NUMERIC(18,4) NOT NULL,
  variance_amount NUMERIC(18,4) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate adjustment number
CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  year_str VARCHAR(4);
BEGIN
  year_str := to_char(NEW.adjustment_date, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(adjustment_number FROM 'ADJ-' || year_str || '-(\d+)') AS INT)), 0) + 1
  INTO next_num
  FROM inventory_adjustments
  WHERE company_id = NEW.company_id
    AND adjustment_number LIKE 'ADJ-' || year_str || '-%';
  
  NEW.adjustment_number := 'ADJ-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_adjustment_num ON inventory_adjustments;
CREATE TRIGGER gen_adjustment_num
  BEFORE INSERT ON inventory_adjustments
  FOR EACH ROW
  WHEN (NEW.adjustment_number IS NULL OR NEW.adjustment_number = '')
  EXECUTE FUNCTION generate_adjustment_number();

-- ==================== INTERNAL TRANSFERS ====================
CREATE TABLE IF NOT EXISTS internal_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transfer_number VARCHAR(50) NOT NULL,
  period_id UUID NOT NULL REFERENCES accounting_periods(id),
  transfer_date DATE NOT NULL,
  ledger_type ledger_type NOT NULL,
  from_warehouse_id UUID REFERENCES warehouses(id),
  from_bin_id UUID REFERENCES bins(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  to_bin_id UUID REFERENCES bins(id),
  status document_status NOT NULL DEFAULT 'draft',
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, transfer_number)
);

CREATE TABLE IF NOT EXISTS internal_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES internal_transfers(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials(id),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  wip_stage wip_stage,
  qty NUMERIC(15,4) NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(18,4) NOT NULL CHECK (unit_cost >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generate transfer number
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
  year_str VARCHAR(4);
BEGIN
  year_str := to_char(NEW.transfer_date, 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(transfer_number FROM 'TRF-' || year_str || '-(\d+)') AS INT)), 0) + 1
  INTO next_num
  FROM internal_transfers
  WHERE company_id = NEW.company_id
    AND transfer_number LIKE 'TRF-' || year_str || '-%';
  
  NEW.transfer_number := 'TRF-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gen_transfer_num ON internal_transfers;
CREATE TRIGGER gen_transfer_num
  BEFORE INSERT ON internal_transfers
  FOR EACH ROW
  WHEN (NEW.transfer_number IS NULL OR NEW.transfer_number = '')
  EXECUTE FUNCTION generate_transfer_number();

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_raw_ledger_company ON raw_material_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_raw_ledger_material ON raw_material_ledger(material_id);
CREATE INDEX IF NOT EXISTS idx_raw_ledger_date ON raw_material_ledger(transaction_date);
CREATE INDEX IF NOT EXISTS idx_raw_ledger_period ON raw_material_ledger(period_id);

CREATE INDEX IF NOT EXISTS idx_wip_ledger_company ON wip_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_wip_ledger_product ON wip_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_wip_ledger_stage ON wip_ledger(stage);
CREATE INDEX IF NOT EXISTS idx_wip_ledger_date ON wip_ledger(transaction_date);

CREATE INDEX IF NOT EXISTS idx_fg_ledger_company ON finished_goods_ledger(company_id);
CREATE INDEX IF NOT EXISTS idx_fg_ledger_product ON finished_goods_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_fg_ledger_variant ON finished_goods_ledger(variant_id);
CREATE INDEX IF NOT EXISTS idx_fg_ledger_date ON finished_goods_ledger(transaction_date);

CREATE INDEX IF NOT EXISTS idx_adjustments_company ON inventory_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_status ON inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_transfers_company ON internal_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON internal_transfers(status);

-- ==================== RLS POLICIES ====================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_material_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE wip_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_transfer_lines ENABLE ROW LEVEL SECURITY;

-- Warehouses
CREATE POLICY "Users can view company warehouses" ON warehouses
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company warehouses" ON warehouses
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

-- Bins
CREATE POLICY "Users can view warehouse bins" ON bins
  FOR SELECT TO authenticated
  USING (warehouse_id IN (
    SELECT w.id FROM warehouses w 
    JOIN user_profiles up ON up.company_id = w.company_id 
    WHERE up.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage warehouse bins" ON bins
  FOR ALL TO authenticated
  USING (warehouse_id IN (
    SELECT w.id FROM warehouses w 
    JOIN user_profiles up ON up.company_id = w.company_id 
    WHERE up.user_id = auth.uid()
  ));

-- Raw Material Ledger
CREATE POLICY "Users can view company raw ledger" ON raw_material_ledger
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert raw ledger" ON raw_material_ledger
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()) AND created_by = auth.uid());

-- WIP Ledger
CREATE POLICY "Users can view company wip ledger" ON wip_ledger
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert wip ledger" ON wip_ledger
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()) AND created_by = auth.uid());

-- Finished Goods Ledger
CREATE POLICY "Users can view company fg ledger" ON finished_goods_ledger
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert fg ledger" ON finished_goods_ledger
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()) AND created_by = auth.uid());

-- Adjustments
CREATE POLICY "Users can view company adjustments" ON inventory_adjustments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company adjustments" ON inventory_adjustments
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view adjustment lines" ON inventory_adjustment_lines
  FOR SELECT TO authenticated
  USING (adjustment_id IN (
    SELECT ia.id FROM inventory_adjustments ia 
    JOIN user_profiles up ON up.company_id = ia.company_id 
    WHERE up.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage adjustment lines" ON inventory_adjustment_lines
  FOR ALL TO authenticated
  USING (adjustment_id IN (
    SELECT ia.id FROM inventory_adjustments ia 
    JOIN user_profiles up ON up.company_id = ia.company_id 
    WHERE up.user_id = auth.uid()
  ));

-- Transfers
CREATE POLICY "Users can view company transfers" ON internal_transfers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage company transfers" ON internal_transfers
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view transfer lines" ON internal_transfer_lines
  FOR SELECT TO authenticated
  USING (transfer_id IN (
    SELECT it.id FROM internal_transfers it 
    JOIN user_profiles up ON up.company_id = it.company_id 
    WHERE up.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage transfer lines" ON internal_transfer_lines
  FOR ALL TO authenticated
  USING (transfer_id IN (
    SELECT it.id FROM internal_transfers it 
    JOIN user_profiles up ON up.company_id = it.company_id 
    WHERE up.user_id = auth.uid()
  ));
