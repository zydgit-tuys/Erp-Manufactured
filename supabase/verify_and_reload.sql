-- Verify tables exist and reload schema
SELECT 'Checking work_centers table...' as status;
SELECT COUNT(*) as work_centers_count FROM work_centers;

SELECT 'Checking production_operations table...' as status;
SELECT COUNT(*) as production_operations_count FROM production_operations;

-- Reload PostgREST schema cache
SELECT 'Reloading PostgREST schema...' as status;
NOTIFY pgrst, 'reload schema';

SELECT 'Schema reload complete!' as status;
