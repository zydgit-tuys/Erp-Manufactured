-- Migration: 038_reload_postgrest_schema.sql
-- Description: Function to manually reload PostgREST schema cache
-- This is needed when new tables are added to force the API to recognize them

CREATE OR REPLACE FUNCTION public.reload_postgrest_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reload_postgrest_schema() TO authenticated;

COMMENT ON FUNCTION public.reload_postgrest_schema() IS 'Manually reload PostgREST schema cache when new tables are added';
