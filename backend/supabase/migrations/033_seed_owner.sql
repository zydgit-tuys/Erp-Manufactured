-- Migration: 033_seed_owner.sql
-- Description: Seed initial company and assign Owner role to a specific user
-- Usage: Replace 'owner@demo.com' with your login email before running!

DO $$
DECLARE
    target_email TEXT := 'owner@demo.com'; -- << GANTI EMAIL INI
    v_user_id UUID;
    v_company_id UUID;
BEGIN
    -- 1. Get User ID from Auth
    SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;

    IF v_user_id IS NULL THEN
        RAISE NOTICE 'User % not found. Please sign up first.', target_email;
        RETURN;
    END IF;

    -- 2. Create Company if not exists
    SELECT id INTO v_company_id FROM companies WHERE code = 'ZIYADA';
    
    IF v_company_id IS NULL THEN
        -- Disable Audit Trigger temporarily because generic audit_trigger expects 'company_id' column which 'companies' table lacks
        ALTER TABLE companies DISABLE TRIGGER trigger_audit_companies;
        
        -- Insert Company
        INSERT INTO companies (name, code, settings)
        VALUES (
            'Ziyada Sport', 
            'ZIYADA', 
            '{"modules": {"finance": true, "marketplace": true, "analytics": true, "manufacturing": true}}'
        )
        RETURNING id INTO v_company_id;
        
        -- Re-enable Audit Trigger
        ALTER TABLE companies ENABLE TRIGGER trigger_audit_companies;
        
        RAISE NOTICE 'Created new company Ziyada Sport with ID %', v_company_id;
    ELSE
        RAISE NOTICE 'Company Ziyada Sport already exists (ID %)', v_company_id;
    END IF;

    -- 3. Assign Owner Role
    IF NOT EXISTS (SELECT 1 FROM user_company_mapping WHERE user_id = v_user_id AND company_id = v_company_id) THEN
        INSERT INTO user_company_mapping (user_id, company_id, role, is_active)
        VALUES (v_user_id, v_company_id, 'owner', true);
        RAISE NOTICE 'Assigned OWNER role to %', target_email;
    ELSE
        UPDATE user_company_mapping 
        SET role = 'owner', is_active = true 
        WHERE user_id = v_user_id AND company_id = v_company_id;
        RAISE NOTICE 'Updated existing mapping to OWNER role for %', target_email;
    END IF;

END $$;
