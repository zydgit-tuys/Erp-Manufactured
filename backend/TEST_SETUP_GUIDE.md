# ERP Integration Tests - Setup Guide

## 🎯 Quick Start

You have **4 integration test suites (16 tests)** ready to validate critical ERP business rules. Before running them, follow this setup:

### Step 1: Create Test Environment File

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create `.env.test` file (copy from example):
```bash
cpbackend\.env.test.example .env.test
```

3. Edit `.env.test` and add your **SUPABASE_SERVICE_ROLE_KEY**:

```bash
# backend/.env.test
SUPABASE_URL=https://kivwoupcuguiuwkxwphc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... # <-- PASTE YOUR KEY HERE
NODE_ENV=test
```

> **⚠️ CRITICAL SECURITY WARNING**
> - NEVER commit `.env.test` to git (it's already in `.gitignore`)
> - NEVER use service role key in frontend code
> - Service role key bypasses RLS - only for backend tests!

### Step 2: Verify Database Schema

Your tests require these tables to exist in Supabase:

**Core Tables:**
- `companies`
- `accounting_periods` (with `status` column: 'open' | 'closed')
- `warehouses`
- `bins`
- `materials`
- `products`

**Ledger Tables:**
- `raw_material_ledger`
- `wip_ledger`
- `finished_goods_ledger`

**Transaction Tables:**
- `inventory_adjustments`
- `inventory_adjustment_lines`
- `internal_transfers`  
- `internal_transfer_lines`
- `journals`
- `journal_lines`

**Views (optional but recommended):**
- `raw_material_balance_mv`
- `wip_balance_mv`
- `finished_goods_balance_mv`

### Step 3: Run Tests

```bash
# From project root
cd c:\Users\Bobing Corp\Downloads\fashion-forge-main\fashion-forge-main

# Run all tests (backend + frontend)
npm test

# Run only backend tests
npm run test:backend

# Run specific integration test
npx jest negative-stock.test.ts
npx jest period-lock.test.ts
npx jest journal-balance.test.ts
npx jest transaction-atomicity.test.ts

# Run with coverage
npm run test:backend:coverage
```

## 📊 What Gets Tested

### ✅ Negative Stock Prevention
- ✓ Allow transactions within stock limits
- ✓ Reject oversell (single transaction)
- ✓ Handle concurrent oversell (race condition)
- ✓ Maintain accurate balance calculations

### ✅ Period Lock Enforcement
- ✓ Allow transactions in open period
- ✓ Reject transactions in closed period
- ✓ Reject backdated transactions
- ✓ Enforce period close workflow

### ✅ Journal Balance Validation
- ✓ Accept balanced journal (debit = credit)
- ✓ Reject unbalanced journal
- ✓ Handle multi-line transactions
- ✓ Handle currency/rounding edge cases

### ✅ Transaction Atomicity
- ✓ Rollback on error
- ✓ Handle partial failures
- ✓ Simulate network interruptions
- ✓ Ensure concurrent integrity

## ⚙️ Service Layer Validations (Implemented)

The following business rules are now enforced:

**Period Validation:**
- `validatePeriodIsOpen()` - Throws error if period is closed
- `validateTransactionDateInPeriod()` - Validates dates
- `closePeriod()` / `reopenPeriod()` - Period management

**Journal Balance:**
- `validateJournalBalance()` - Ensures debit = credit
- `validateLinesBalance()` - Pre-insert validation
- `postJournal()` - Only posts balanced journals
- `reverseJournal()` - Automatic reversals

**Inventory Control:**
- Period checks before all inventory transactions
- Stock availability validation
- Concurrent transaction handling

## 🔍 Troubleshooting

### Tests Fail with "Cannot find module '../config/supabase'"
**Solution:** Make sure `.env.test` exists with correct `SUPABASE_SERVICE_ROLE_KEY`

### Tests Fail with "Period not found"
**Solution:** Database is missing `accounting_periods` table or test data creation failed

### Tests Fail with "Insufficient stock"
**Solution:** This might be expected! Check if it's the negative test case

### All Tests Time Out
**Solution:** 
1. Check Supabase connection
2. Verify service role key is correct
3. Ensure database is accessible

### Integration Tests Pass but Unit Tests Fail
**Solution:** The integration tests create test data, check `cleanupTestData()` is working

## 📝 Next Steps After Tests Pass

1. **Review Coverage Report:**
   ```bash
   npm run test:backend:coverage
   ```
   Target: ≥80% coverage on service layer

2. **Add More Scenarios:**
   - Multiple concurrent users
   - Large batch operations
   - Error recovery scenarios

3. **Setup CI/CD:**
   Add to your CI pipeline:
   ```yaml
   - name: Run Tests
     run: npm test
     env:
       SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
   ```

4. **Monitor in Production:**
   - Track period lock violations
   - Monitor negative stock attempts
   - Log unbalanced journal rejections

## 🎓 Understanding Test Structure

Each integration test follows this pattern:

```typescript
describe('Feature', () => {
  beforeAll(async () => {
    // Create test data: company, period, warehouse, etc.
  });

  afterAll(async () => {
    // Cleanup: delete all test data
  });

  it('should allow valid operation', async () => {
    // GIVEN: test setup
    // WHEN: perform action
    // THEN: assert success
  });

  it('should reject invalid operation', async () => {
    // GIVEN: test setup
    // WHEN: perform invalid action  
    // THEN: expect error with specific message
  });
});
```

## 🚨 Common Pitfalls

1. **Using Anon Key for Backend Tests** ❌
   - Backend tests MUST use service role key
   - Frontend uses anon key with RLS

2. **Not Cleaning Up Test Data** ❌
   - Always use `afterAll()` to cleanup
   - Prevents test pollution

3. **Hardcoding Test IDs** ❌
   - Use dynamic IDs: `TEST${Date.now()}`
   - Prevents ID collisions

4. **Skipping Period Validation** ❌
   - All transactions must validate period
   - Critical for audit compliance

## 🔐 Security Checklist

- ✓ `.env.test` in `.gitignore`
- ✓ Service role key never in frontend
- ✓ RLS enabled on all tables
- ✓ Test isolation (no cross-test pollution)
- ✓ Proper error messages (no sensitive data leak)

---

**Need Help?** Check the [Implementation Plan](file:///C:/Users/Bobing%20Corp/.gemini/antigravity/brain/83fc048a-65a6-4cf9-b73a-1134820492ef/implementation_plan.md) for detailed architecture.
