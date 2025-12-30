-- Migration: 057_release_production_logic.sql
-- Description: Implement logic for releasing production orders (Stock Validation)
-- Dependencies: 056_manufacturing_routing.sql

CREATE OR REPLACE FUNCTION public.release_production_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status TEXT;
  v_company_id UUID;
  v_line RECORD;
  v_balance DECIMAL;
  v_material_code TEXT;
  v_required_qty DECIMAL;
  v_missing_items TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. Get Order Details & Lock Row
  SELECT status, company_id INTO v_order_status, v_company_id
  FROM production_orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 2. Validations
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Production Order not found';
  END IF;

  IF v_order_status != 'planned' THEN
    RAISE EXCEPTION 'Only Planned orders can be released. Current status: %', v_order_status;
  END IF;

  -- 3. Check Stock Availability for ALL Ingredients
  -- logic: We iterate over lines, check 'raw_material_balances', and build error list if missing.
  
  FOR v_line IN 
    SELECT 
      pol.material_id, 
      pol.quantity as required_qty,
      m.code as material_code,
      m.name as material_name
    FROM production_order_lines pol
    JOIN materials m ON pol.material_id = m.id
    WHERE pol.production_order_id = p_order_id
  LOOP
    -- Get current total balance for this material across ALL warehouses (for simplicty V1)
    -- Or should we enforce a specific warehouse? 
    -- V1 Design: Check TOTAL company stock. The user will issue from specific WH later during 'Work Order'.
    -- If we want stricter check, we need to know WHICH warehouse updates come from. 
    -- Usually Production Order doesn't specify source warehouse yet, Work Order might.
    -- For now, we check GLOBAL availability to allow release.
    
    SELECT COALESCE(SUM(qty_in - qty_out), 0)
    INTO v_balance
    FROM raw_material_ledger
    WHERE material_id = v_line.material_id
      AND company_id = v_company_id;

    -- Compare
    IF v_balance < v_line.required_qty THEN
      v_missing_items := array_append(v_missing_items, 
        v_line.material_code || ' (Req: ' || v_line.required_qty || ', Avail: ' || v_balance || ')');
    END IF;
  END LOOP;

  -- 4. Handle Failures
  IF array_length(v_missing_items, 1) > 0 THEN
    RAISE EXCEPTION 'Insufficient Stock for: %', array_to_string(v_missing_items, ', ');
  END IF;

  -- 5. Update Status
  UPDATE production_orders
  SET 
    status = 'released', 
    updated_at = NOW()
  WHERE id = p_order_id;

  -- 6. (Optional) Auto-create Work Orders?
  -- For V1, the frontend calls 'create_work_orders' separately or we do it manually.
  -- Keeping RPC focused on "Release/Validation" only.

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Production Order released successfully',
    'id', p_order_id
  );
END;
$$;
