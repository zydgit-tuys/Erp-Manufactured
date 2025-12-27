-- Migration: 004_foundation_audit.sql
-- Description: Comprehensive audit trail system
-- Dependencies: 001_foundation_companies.sql
-- Author: Ziyada ERP Team
-- Date: 2025-12-27

-- ==================== ENUMS ====================

CREATE TYPE audit_operation AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ==================== AUDIT LOG TABLE ====================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operation audit_operation NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  
  -- Ensure at least one value is present
  CONSTRAINT check_values CHECK (
    (operation = 'DELETE' AND old_values IS NOT NULL) OR
    (operation = 'INSERT' AND new_values IS NOT NULL) OR
    (operation = 'UPDATE' AND old_values IS NOT NULL AND new_values IS NOT NULL)
  )
);

-- Indexes for fast querying
CREATE INDEX idx_audit_company ON audit_log(company_id);
CREATE INDEX idx_audit_table ON audit_log(table_name);
CREATE INDEX idx_audit_record ON audit_log(record_id);
CREATE INDEX idx_audit_operation ON audit_log(operation);
CREATE INDEX idx_audit_user ON audit_log(changed_by);
CREATE INDEX idx_audit_timestamp ON audit_log(changed_at DESC);
CREATE INDEX idx_audit_company_table_record ON audit_log(company_id, table_name, record_id);

-- Composite index for common queries
CREATE INDEX idx_audit_table_record_timestamp ON audit_log(table_name, record_id, changed_at DESC);

-- Comments
COMMENT ON TABLE audit_log IS 'Immutable audit trail for all data changes across the system';
COMMENT ON COLUMN audit_log.changed_fields IS 'Array of field names that changed (for UPDATE operations)';
COMMENT ON COLUMN audit_log.old_values IS 'Complete record before change (for UPDATE and DELETE)';
COMMENT ON COLUMN audit_log.new_values IS 'Complete record after change (for INSERT and UPDATE)';

-- ==================== AUDIT TRIGGER FUNCTION ====================

CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_changed_fields TEXT[];
  v_company_id UUID;
BEGIN
  -- Get company_id from the record
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
  ELSE
    v_company_id := NEW.company_id;
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

COMMENT ON FUNCTION audit_trigger IS 'Generic trigger function to capture INSERT/UPDATE/DELETE operations';

-- ==================== APPLY AUDIT TO FOUNDATION TABLES ====================

-- Audit companies table
CREATE TRIGGER trigger_audit_companies
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Audit COA
CREATE TRIGGER trigger_audit_coa
  AFTER INSERT OR UPDATE OR DELETE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Audit periods
CREATE TRIGGER trigger_audit_periods
  AFTER INSERT OR UPDATE OR DELETE ON accounting_periods
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- ==================== RLS POLICIES ====================

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read audit logs for their company
CREATE POLICY audit_read_own_company ON audit_log
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM user_company_mapping
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Only trigger can insert (not users directly)
CREATE POLICY audit_insert_trigger ON audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Audit log is immutable (no updates or deletes by users)
CREATE POLICY audit_no_update ON audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY audit_no_delete ON audit_log
  FOR DELETE
  USING (false);

-- Service role can do anything (for maintenance)
CREATE POLICY audit_service_role ON audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==================== HELPER FUNCTIONS ====================

-- Get audit history for a specific record
CREATE OR REPLACE FUNCTION get_audit_history(
  p_table_name TEXT,
  p_record_id UUID,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  operation audit_operation,
  changed_at TIMESTAMPTZ,
  changed_by UUID,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.operation,
    a.changed_at,
    a.changed_by,
    a.changed_fields,
    a.old_values,
    a.new_values
  FROM audit_log a
  WHERE a.table_name = p_table_name
    AND a.record_id = p_record_id
  ORDER BY a.changed_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_audit_history IS 'Returns audit history for a specific record';
