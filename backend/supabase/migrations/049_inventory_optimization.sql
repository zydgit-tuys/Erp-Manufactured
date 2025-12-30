-- ══════════════════════════════════════════════════════════════════
-- Migration: 049_inventory_optimization.sql
-- Description: Optimize inventory validation using Summary Table Pattern
-- Addresses: "The SUM Trigger Trap" (Audit Report Item #1)
-- ══════════════════════════════════════════════════════════════════

-- 1. Create Summary Tables
-- These tables hold the "Current State" so we don't have to calculate it on fly.

CREATE TABLE IF NOT EXISTS raw_material_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    material_id uuid NOT NULL REFERENCES materials(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    bin_id uuid REFERENCES bins(id), -- Optional, depends on granularity
    current_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now(),
    
    CONSTRAINT uq_rm_balance UNIQUE (company_id, material_id, warehouse_id, bin_id)
);

CREATE TABLE IF NOT EXISTS finished_goods_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES companies(id),
    product_variant_id uuid NOT NULL REFERENCES product_variants(id),
    warehouse_id uuid NOT NULL REFERENCES warehouses(id),
    bin_id uuid REFERENCES bins(id),
    current_qty DECIMAL(15,4) NOT NULL DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now(),
    
    CONSTRAINT uq_fg_balance UNIQUE (company_id, product_variant_id, warehouse_id, bin_id)
);

-- WIP is trickier due to stages, keeping it simple for now or adding later if needed.
-- Focusing on high-volume material/FG movement first.

-- 2. Populate Initial Balances (Data Migration)
-- We need to sum up everything currently in the ledger to initialize our balance tables.

INSERT INTO raw_material_balances (company_id, material_id, warehouse_id, bin_id, current_qty)
SELECT 
    company_id, 
    material_id, 
    warehouse_id, 
    bin_id, 
    COALESCE(SUM(qty_in - qty_out), 0) as current_qty
FROM raw_material_ledger
GROUP BY company_id, material_id, warehouse_id, bin_id;

INSERT INTO finished_goods_balances (company_id, product_variant_id, warehouse_id, bin_id, current_qty)
SELECT 
    company_id, 
    product_variant_id, 
    warehouse_id, 
    bin_id, 
    COALESCE(SUM(qty_in - qty_out), 0) as current_qty
FROM finished_goods_ledger
GROUP BY company_id, product_variant_id, warehouse_id, bin_id;

-- 3. Create Maintenance Triggers (Keep Balances up to date)
-- Every time a ledger row is inserted, update the balance table.

CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- Raw Materials
    IF TG_TABLE_NAME = 'raw_material_ledger' THEN
        INSERT INTO raw_material_balances (
            company_id, material_id, warehouse_id, bin_id, current_qty
        ) VALUES (
            NEW.company_id, NEW.material_id, NEW.warehouse_id, NEW.bin_id, 
            (NEW.qty_in - NEW.qty_out)
        )
        ON CONFLICT (company_id, material_id, warehouse_id, bin_id)
        DO UPDATE SET 
            current_qty = raw_material_balances.current_qty + (NEW.qty_in - NEW.qty_out),
            last_updated = now();
    
    -- Finished Goods
    ELSIF TG_TABLE_NAME = 'finished_goods_ledger' THEN
        INSERT INTO finished_goods_balances (
            company_id, product_id, variant_id, warehouse_id, bin_id, current_qty
        ) VALUES (
            NEW.company_id, NEW.product_id, NEW.variant_id, NEW.warehouse_id, NEW.bin_id, 
            (NEW.qty_in - NEW.qty_out)
        )
        ON CONFLICT (company_id, product_id, variant_id, warehouse_id, bin_id)
        DO UPDATE SET 
            current_qty = finished_goods_balances.current_qty + (NEW.qty_in - NEW.qty_out),
            last_updated = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER maintain_balance_rm
AFTER INSERT ON raw_material_ledger
FOR EACH ROW EXECUTE FUNCTION update_inventory_balance();

CREATE TRIGGER maintain_balance_fg
AFTER INSERT ON finished_goods_ledger
FOR EACH ROW EXECUTE FUNCTION update_inventory_balance();

-- 4. Optimize Validation Function (O(1) Check)
-- Replace the O(N) function from migration 042 with this fast version.

CREATE OR REPLACE FUNCTION validate_stock_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_current_balance DECIMAL(15,4);
  v_material_code TEXT;
  v_warehouse_code TEXT;
BEGIN
  -- Only validate when issuing stock (qty_out > 0)
  IF NEW.qty_out > 0 THEN
    
    -- Optimized Check for Raw Material
    IF TG_TABLE_NAME = 'raw_material_ledger' THEN
      -- Direct lookup from balance table (O(1) using Unique Index)
      SELECT current_qty INTO v_current_balance
      FROM raw_material_balances
      WHERE material_id = NEW.material_id
        AND warehouse_id = NEW.warehouse_id
        AND company_id = NEW.company_id
        AND (bin_id = NEW.bin_id OR (bin_id IS NULL AND NEW.bin_id IS NULL));
      
      -- Handle case where no balance record exists yet (implies 0 stock)
      v_current_balance := COALESCE(v_current_balance, 0);
      
      -- Get info for error message (unchanged)
      SELECT m.code, w.code INTO v_material_code, v_warehouse_code
      FROM materials m, warehouses w
      WHERE m.id = NEW.material_id AND w.id = NEW.warehouse_id;
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient stock for material %. Available: %, Requested: %, Warehouse: %',
          v_material_code, v_current_balance, NEW.qty_out, v_warehouse_code
        USING HINT = 'Check stock balance before issuing',
              ERRCODE = '23514'; 
      END IF;
      
      -- OPTIONAL: Optimistic Locking Check
      -- The maintain_balance trigger runs AFTER this BEFORE trigger.
      -- If multiple transactions run concurrently, the balance table might update between this check and commit.
      -- However, the balance table UPDATE will lock the specific row, serializing modifications to the same item.
      -- We add a check constraint on the balance table itself as a safety net?
      -- "ALTER TABLE raw_material_balances ADD CONSTRAINT no_negative_balance CHECK (current_qty >= 0);"
      -- This is the robust solution mentioned in the audit. Let's add it below.

    END IF;
    
    -- Optimized Check for Finished Goods
    IF TG_TABLE_NAME = 'finished_goods_ledger' THEN
      SELECT current_qty INTO v_current_balance
      FROM finished_goods_balances
      WHERE product_variant_id = NEW.product_variant_id
        AND warehouse_id = NEW.warehouse_id
        AND company_id = NEW.company_id
        AND (bin_id = NEW.bin_id OR (bin_id IS NULL AND NEW.bin_id IS NULL));
      
      v_current_balance := COALESCE(v_current_balance, 0);
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient finished goods stock. Available: %, Requested: %',
          v_current_balance, NEW.qty_out
        USING HINT = 'Check finished goods balance before issuing',
              ERRCODE = '23514';
      END IF;
    END IF;
    
    -- WIP Ledger optimization skipped for now as user prioritized "Big 3" and WIP logic depends on stages
    -- Keeping original logic for WIP? No, validate_stock_availability is REPLACED.
    -- We must preserve the WIP logic from 042 (even if slow) or drop it.
    -- Better to preserve it as "Unoptimized Legacy" block inside the new function.
    
    IF TG_TABLE_NAME = 'wip_ledger' THEN
      -- LEGACY O(N) LOGIC PRESERVED FOR WIP
      SELECT COALESCE(SUM(qty_in - qty_out), 0)
      INTO v_current_balance
      FROM wip_ledger
      WHERE product_id = NEW.product_id
        AND stage = NEW.stage
        AND company_id = NEW.company_id
        AND (variant_id = NEW.variant_id OR (variant_id IS NULL AND NEW.variant_id IS NULL));
      
      IF v_current_balance < NEW.qty_out THEN
        RAISE EXCEPTION 'Insufficient WIP stock at stage %. Available: %, Requested: %',
          NEW.stage, v_current_balance, NEW.qty_out
        USING HINT = 'Check WIP balance before moving to next stage',
              ERRCODE = '23514';
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Hard Constraint on Balances (The Firewall)
-- Ideally we want the database to reject negative balances at the source of truth (the balance table).

ALTER TABLE raw_material_balances 
ADD CONSTRAINT check_positive_rm_balance CHECK (current_qty >= 0);

ALTER TABLE finished_goods_balances 
ADD CONSTRAINT check_positive_fg_balance CHECK (current_qty >= 0);

-- Enable RLS on new tables
ALTER TABLE raw_material_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE finished_goods_balances ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies (Read-only for users, System maintains)
CREATE POLICY "Users can view balances of their company" ON raw_material_balances
FOR SELECT USING (
    company_id IN (
        SELECT company_id FROM user_company_mapping
        WHERE user_id = auth.uid() AND is_active = true
    )
);

CREATE POLICY "Users can view fg balances of their company" ON finished_goods_balances
FOR SELECT USING (
    company_id IN (
        SELECT company_id FROM user_company_mapping
        WHERE user_id = auth.uid() AND is_active = true
    )
);

-- Note: We don't need INSERT/UPDATE policies for users because the modify is done by Trigger (superuser privilege usually, or SECURITY DEFINER if needed).
-- Standard triggers run as the user. So user needs permission to update balance table.
-- Let's grant it via policy or make the trigger function SECURITY DEFINER.
-- Making trigger function SECURITY DEFINER is safer for logic encapsulation.

CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
BEGIN
    -- (Same Logic as above)
    -- Raw Materials
    IF TG_TABLE_NAME = 'raw_material_ledger' THEN
        INSERT INTO raw_material_balances (
            company_id, material_id, warehouse_id, bin_id, current_qty
        ) VALUES (
            NEW.company_id, NEW.material_id, NEW.warehouse_id, NEW.bin_id, 
            (NEW.qty_in - NEW.qty_out)
        )
        ON CONFLICT (company_id, material_id, warehouse_id, bin_id)
        DO UPDATE SET 
            current_qty = raw_material_balances.current_qty + (NEW.qty_in - NEW.qty_out),
            last_updated = now();
    -- Finished Goods
    ELSIF TG_TABLE_NAME = 'finished_goods_ledger' THEN
        INSERT INTO finished_goods_balances (
            company_id, product_id, variant_id, warehouse_id, bin_id, current_qty
        ) VALUES (
            NEW.company_id, NEW.product_id, NEW.variant_id, NEW.warehouse_id, NEW.bin_id, 
            (NEW.qty_in - NEW.qty_out)
        )
        ON CONFLICT (company_id, product_id, variant_id, warehouse_id, bin_id)
        DO UPDATE SET 
            current_qty = finished_goods_balances.current_qty + (NEW.qty_in - NEW.qty_out),
            last_updated = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
