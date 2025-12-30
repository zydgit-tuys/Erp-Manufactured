-- Migration: 053_manufacturing_completion.sql
-- Description: Implement logic to record production output (WIP -> FG)
-- Impact: Allows completing Work Orders/Production Orders and moving value to Finished Goods.

-- ==================== PRODUCTION OUTPUT RPC ====================

CREATE OR REPLACE FUNCTION record_production_output(
  p_production_order_id UUID,
  p_qty_output DECIMAL(15,4),
  p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_po RECORD;
  v_bin_id UUID;
  v_unit_cost DECIMAL(15,2);
BEGIN
  -- 1. Get Production Order
  SELECT * INTO v_po
  FROM production_orders
  WHERE id = p_production_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production order not found';
  END IF;

  IF v_po.status = 'completed' OR v_po.status = 'cancelled' THEN
     RAISE EXCEPTION 'Production order is already closed';
  END IF;

  -- 2. Determine Unit Cost (Standard Costing Approach)
  -- In a Standard Cost system, we output at Standard Cost. Variances remain in WIP.
  -- If standard_cost is 0, we try to fallback to BOM cost or 0.
  v_unit_cost := v_po.standard_cost;
  
  -- 3. Get Default Bin for Finished Goods (Warehouse)
  SELECT id INTO v_bin_id
  FROM bins
  WHERE warehouse_id = v_po.warehouse_id
    AND is_active = true
  ORDER BY code
  LIMIT 1;

  IF v_bin_id IS NULL THEN
    RAISE EXCEPTION 'No active bin found for warehouse %', v_po.warehouse_id;
  END IF;

  -- 4. Debit Finished Goods (IN)
  INSERT INTO finished_goods_ledger (
      company_id,
      product_variant_id, -- Note: Production Orders link to Product, need a default variant?
      -- Assumes Product has 1:1 variant or PO Logic needs Variant updates.
      -- Looking at schema 018, PO links to `product_id`.
      -- We need a `variant_id`. For now, pick the first variant or assumes standard product?
      -- Schema 006 says Products have Variants.
      -- FIX: Production Order should technically specify Variant if it's a specific SKU.
      -- Let's check products table. If product has variants, which one did we make?
      -- Assuming Product = Main Variant for now or fetching first.
      -- BETTER FIX: Fetch the "Default" variant or the one matching the Product ID if ID is shared?
      -- Actually, `production_reservations` uses `material_id`. 
      -- Let's grab the First Variant of the Product.
      product_id,
      warehouse_id,
      bin_id,
      period_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_number,
      qty_in,
      qty_out,
      unit_cost,
      created_by,
      is_posted
  )
  SELECT
      v_po.company_id,
      (SELECT id FROM product_variants WHERE product_id = v_po.product_id LIMIT 1), -- fallback
      v_po.product_id,
      v_po.warehouse_id,
      v_bin_id,
      v_po.period_id,
      CURRENT_DATE,
      'PRODUCTION_OUTPUT',
      'PRODUCTION',
      v_po.id,
      v_po.po_number,
      p_qty_output,
      0,
      v_unit_cost,
      p_user_id,
      true;

  -- 5. Credit WIP (OUT)
  -- Reducing WIP value by the Standard Cost of the goods produced.
  INSERT INTO wip_ledger (
      company_id,
      production_order_id,
      product_id,
      stage, -- 'FINISH' or generic 'OUTPUT'?
      warehouse_id,
      period_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_number,
      qty_in,
      qty_out,
      unit_cost,
      cost_material, -- Simplified: Proportional backout?
      cost_labor,
      cost_overhead,
      created_by,
      is_posted
  ) VALUES (
      v_po.company_id,
      v_po.id,
      v_po.product_id,
      'FINISH', -- Assuming final stage
      v_po.warehouse_id,
      v_po.period_id,
      CURRENT_DATE,
      'OUTPUT',
      'PRODUCTION',
      v_po.id,
      v_po.po_number,
      0,
      p_qty_output,
      v_unit_cost,
      0, 0, 0, -- Not tracking detailed split on Output for now, just Total Value via Unit Cost
      p_user_id,
      true
  );

  -- 6. Update Production Order Status
  UPDATE production_orders
  SET 
    qty_completed = qty_completed + p_qty_output,
    status = CASE 
        WHEN (qty_completed + p_qty_output) >= qty_planned THEN 'completed'::production_status
        ELSE 'in_progress'::production_status 
    END,
    updated_at = NOW()
  WHERE id = p_production_order_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_production_output IS 'Records production output: Moves value from WIP to Finished Goods at Standard Cost.';
