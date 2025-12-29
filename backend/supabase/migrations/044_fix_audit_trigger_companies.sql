-- Migration: 044_fix_audit_trigger_companies.sql
-- Description: Fix audit_trigger to handle companies table which uses id instead of company_id
-- Dependencies: 004_foundation_audit.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-29

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_changed_fields TEXT[];
  v_company_id UUID;
BEGIN
  -- Get company_id from the record
  -- Special handling for 'companies' table which is the root
  IF TG_TABLE_NAME = 'companies' THEN
      IF TG_OP = 'DELETE' THEN
        v_company_id := OLD.id;
      ELSE
        v_company_id := NEW.id;
      END IF;
  ELSE
      -- Standard tables have company_id
      IF TG_OP = 'DELETE' THEN
        v_company_id := OLD.company_id;
      ELSE
        v_company_id := NEW.company_id;
      END IF;
  END IF;

  -- Handle different operations
  IF TG_OP = 'DELETE' THEN
    v_old_values := to_jsonb(OLD);
    
    INSERT INTO audit_log (
      company_id, table_name, record_id, operation,
      old_values, changed_by, changed_at
    ) VALUES (
      v_company_id, TG_TABLE_NAME, OLD.id, 'DELETE',
      v_old_values, auth.uid(), NOW()
    );
    
    RETURN OLD;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_values := to_jsonb(OLD);
    v_new_values := to_jsonb(NEW);
    
    -- Calculate changed fields
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM jsonb_each(v_new_values)
    WHERE v_old_values->key IS DISTINCT FROM v_new_values->key;
    
    -- Only log if there are actual changes
    IF v_changed_fields IS NOT NULL AND array_length(v_changed_fields, 1) > 0 THEN
      INSERT INTO audit_log (
        company_id, table_name, record_id, operation,
        old_values, new_values, changed_fields, changed_by, changed_at
      ) VALUES (
        v_company_id, TG_TABLE_NAME, NEW.id, 'UPDATE',
        v_old_values, v_new_values, v_changed_fields, auth.uid(), NOW()
      );
    END IF;
    
    RETURN NEW;
    
  ELSIF TG_OP = 'INSERT' THEN
    v_new_values := to_jsonb(NEW);
    
    INSERT INTO audit_log (
      company_id, table_name, record_id, operation,
      new_values, changed_by, changed_at
    ) VALUES (
      v_company_id, TG_TABLE_NAME, NEW.id, 'INSERT',
      v_new_values, auth.uid(), NOW()
    );
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
