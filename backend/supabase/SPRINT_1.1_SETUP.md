# Sprint 1.1 Setup Guide

**Phase 1: Foundation - Core Schema Setup**  
**Estimated Time:** 2-3 hours  
**Prerequisites:** Supabase project access

---

## 📋 Pre-Flight Checklist

Before running migrations, ensure you have:

- [ ] Supabase project created (or existing project)
- [ ] Database connection string
- [ ] Service role key (for migrations)
- [ ] Supabase CLI installed (recommended) OR access to SQL Editor

---

## 🚀 Option A: Using Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Verify installation
supabase --version
```

### Step 2: Link to Your Project

```bash
cd backend

# Initialize Supabase (if not already)
supabase init

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Push Migrations

```bash
# Preview changes
supabase db diff

# Push all migrations
supabase db push

# Or run individually
supabase db execute --file supabase/migrations/001_foundation_companies.sql
supabase db execute --file supabase/migrations/002_foundation_coa.sql
supabase db execute --file supabase/migrations/003_foundation_periods.sql
supabase db execute --file supabase/migrations/004_foundation_audit.sql
supabase db execute --file supabase/migrations/005_seed_coa_template.sql
```

### Step 4: Verify Installation

```bash
# Check tables created
supabase db dump --schema public

# Should see: companies, chart_of_accounts, accounting_periods, audit_log, user_company_mapping
```

---

## 🖥️ Option B: Using Supabase Dashboard (SQL Editor)

### Step 1: Open SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query

### Step 2: Run Migrations in Order

Copy and execute each migration file in order:

1. **001_foundation_companies.sql** - Companies & tenant setup
2. **002_foundation_coa.sql** - Chart of Accounts
3. **003_foundation_periods.sql** - Accounting periods
4. **004_foundation_audit.sql** - Audit trail
5. **005_seed_coa_template.sql** - COA template function

**Important:** Run them sequentially due to dependencies!

### Step 3: Verify Tables

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN (
    'companies', 
    'chart_of_accounts', 
    'accounting_periods', 
    'audit_log',
    'user_company_mapping'
  );
```

Expected result: 5 tables

---

## 🧪 Post-Migration Testing

### Test 1: Create a Company

```sql
-- Insert test company
INSERT INTO companies (code, name, email, base_currency)
VALUES ('TEST01', 'Test Company', 'test@example.com', 'IDR')
RETURNING id;

-- Copy the returned ID for next steps
```

### Test 2: Seed COA Template

```sql
-- Replace 'YOUR_COMPANY_ID' with ID from previous step
SELECT seed_coa_template('YOUR_COMPANY_ID');

-- Should return 60+ (number of accounts created)
```

### Test 3: Verify COA Created

```sql
SELECT account_code, account_name, account_type 
FROM chart_of_accounts
WHERE company_id = 'YOUR_COMPANY_ID'
ORDER BY account_code
LIMIT 10;
```

Expected: Should see accounts starting with 1010, 1020, 1030, etc.

###Test 4: Create Accounting Period

```sql
INSERT INTO accounting_periods (
  company_id, 
  period_code, 
  name, 
  start_date, 
  end_date,
  fiscal_year,
  status
)
VALUES (
  'YOUR_COMPANY_ID',
  '2025-01',
  'January 2025',
  '2025-01-01',
  '2025-01-31',
  2025,
  'open'
)
RETURNING id;
```

### Test 5: Verify RLS Working

```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('companies', 'chart_of_accounts', 'accounting_periods');

-- All should have rowsecurity = true
```

---

## 🔒 Security Configuration

### Enable RLS on All Tables

RLS is already enabled via migrations, but verify:

```sql
-- Should all return 't' (true)
SELECT 
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('companies', 'chart_of_accounts', 'accounting_periods', 'audit_log')
  AND relnamespace = 'public'::regnamespace;
```

### Test Tenant Isolation

```bash
# Create two test users in Supabase Auth dashboard
# Map each to different companies via user_company_mapping
# Try querying as each user - they should only see their company's data
```

---

## 📊 Verification Queries

### Check All Tables

```sql
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check All Functions

```sql
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'seed_coa_template',
    'get_current_open_period',
    'get_audit_history',
    'check_period_overlap'
  );
```

### Check All Triggers

```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

Expected triggers:
- `trigger_audit_*` (audit logging)
- `trigger_check_period_overlap`
- `trigger_companies_updated_at`
- `trigger_coa_updated_at`

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Solution:** Tables already exist. Either:
1. Drop and recreate (WARNING: data loss!)
2. Skip migration and proceed

```sql
-- To drop all tables (use with caution!)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS accounting_periods CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS user_company_mapping CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
```

### Error: "permission denied for schema public"

**Solution:** Ensure you're using service_role key, not anon key.

### Error: "function seed_coa_template does not exist"

**Solution:** Run migration 005_seed_coa_template.sql

### RLS blocking queries

**Solution:** For development/testing, you can temporarily disable:

```sql
-- DANGER: Only for development!
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods DISABLE ROW LEVEL SECURITY;
```

Remember to re-enable before production!

---

## ✅ Success Criteria

Sprint 1.1 is complete when:

- [x] All 5 migration files executed successfully
- [x] 5 tables created and verified
- [x] COA template function works (60+ accounts created)  
- [x] RLS policies enabled and tested
- [ ] Audit trail capturing changes
- [x] At least one test company with COA created

---

## 📈 Next Steps

After completing Sprint 1.1:

1. Run backend tests: `npm run test:backend`
2. Proceed to **Sprint 1.2**: Master Data Management
3. Create frontend components for company/COA management

---

## 📞 Support

If you encounter issues:

1. Check Supabase logs (Dashboard → Database → Logs)
2. Verify migration order (dependencies matter!)
3. Test with service_role key first
4. Review RLS policies if queries return empty

---

**Estimated Completion Time:** 2-3 hours  
**Deliverable:** Fully functional foundation schema with 5 core tables
