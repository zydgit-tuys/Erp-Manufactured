# 🚀 Quick Start Guide - Phase 4 Testing

## ✅ Setup Complete

**Status:** Ready for Testing  
**Application URL:** http://localhost:5173  
**Supabase Project:** kivwoupcuguiuwkxwphc  
**Edge Functions Deployed:** 8/8 ✅

---

## 📦 Deployed Edge Functions

| Function | Status | Purpose |
|----------|--------|---------|
| `receive-raw-material` | ✅ Deployed | Receive materials into inventory |
| `issue-raw-material` | ✅ Deployed | Issue materials with stock validation |
| `receive-finished-goods` | ✅ Deployed | Receive FG from production |
| `issue-finished-goods` | ✅ Deployed | Issue FG for sales |
| `post-adjustment` | ✅ Deployed | Post inventory adjustments |
| `post-transfer` | ✅ Deployed | Post inventory transfers |
| `post-goods-receipt` | ✅ Deployed | Post GRN from PO |
| `post-delivery-order` | ✅ Deployed | Post DO for sales |

---

## 🧪 Testing Flow (Recommended Order)

### Step 1: Foundation Setup (M0)
1. Open http://localhost:5173
2. Login to the application
3. **Create Master Data:**
   - Products: `/products/new`
   - Materials: `/materials/new`
   - Vendors: `/vendors/new`
   - Customers: `/customers/new`
4. **Setup Chart of Accounts:** `/coa`
5. **Create Accounting Period:** `/periods`

### Step 2: Inventory Testing (M1)
1. **Raw Material Receipt:** `/inventory/raw`
   - Click "Receive Material"
   - Fill in details
   - Verify Edge Function called
2. **Raw Material Issue:** `/inventory/raw`
   - Click "Issue Material"
   - Test stock validation
3. **Finished Goods Receipt:** `/inventory/fg`
4. **Finished Goods Issue:** `/inventory/fg`
5. **Stock Adjustment:** `/inventory/adjustments`
6. **Inventory Transfer:** `/inventory/transfers`

### Step 3: Purchasing Testing (M2)
1. **Create PO:** `/purchasing/new`
2. **Receive Goods (GRN):** `/purchasing/receipts`
3. **Vendor Invoice:** `/purchasing/invoices`

### Step 4: Manufacturing Testing (M3)
1. **Create BOM:** `/production/boms`
2. **Work Order:** `/production/work-orders`

### Step 5: Sales Testing (M4 & M5)
1. **POS Transaction:** `/sales/pos`
2. **Sales Order:** `/sales/new`
3. **Delivery Order:** `/sales/shipments`
4. **Sales Invoice:** `/sales/invoices`

### Step 6: Finance Verification (M6)
1. **Check Auto Journals:** Verify all transactions created journals
2. **Close Period:** `/periods`
3. **Test Period Lock:** Try to post to closed period
4. **View Reports:** `/analytics`

### Step 7: Marketplace (M7)
1. **Marketplace Integration:** `/marketplace`

---

## 🔍 Key Tests to Verify

### Database Constraints
- [ ] **Ledger Immutability:** Try to edit posted ledger entry (should fail)
- [ ] **Period Lock:** Post to closed period (should fail)
- [ ] **Negative Stock:** Issue more than available (should fail)
- [ ] **Journal Balance:** Create unbalanced entry (should fail)

### Edge Functions
- [ ] All 8 functions callable from frontend
- [ ] Proper error messages returned
- [ ] Auto-journaling works
- [ ] Stock validation works

---

## 📝 How to Test

1. **Open browser:** http://localhost:5173
2. **Follow test scenarios** in `docs/phase4_module_completion.md`
3. **Check browser console** for any errors
4. **Verify database** after each transaction
5. **Document issues** found

---

## 🐛 Common Issues to Watch For

1. **Edge Function Errors:**
   - Check browser console for 500 errors
   - Verify function deployed correctly
   - Check Supabase logs

2. **Database Errors:**
   - Period lock violations
   - Stock validation failures
   - Immutability violations

3. **Frontend Errors:**
   - API call failures
   - Authentication issues
   - Form validation errors

---

## 📊 Testing Progress

Track your progress in `task.md` artifact.

**Next Steps:**
1. Start with M0 (Foundation)
2. Move to M1 (Inventory)
3. Continue through M2-M7
4. Document all findings

---

## 🔗 Useful Links

- **Application:** http://localhost:5173
- **Supabase Dashboard:** https://supabase.com/dashboard/project/kivwoupcuguiuwkxwphc
- **Edge Functions:** https://supabase.com/dashboard/project/kivwoupcuguiuwkxwphc/functions
- **Database:** https://supabase.com/dashboard/project/kivwoupcuguiuwkxwphc/editor

---

**Ready to start testing!** 🎉
