# Backend Architecture Analysis - Hybrid Approach

**Date:** 2025-12-29  
**Based on:** Updated RULES.md (Hybrid Selective Architecture)

---

## 🎯 Workflow Classification

### ✅ **EDGE FUNCTIONS** (Fast, I/O Bound, < 2-3 sec)

#### 1. **Inventory Workflows**
- ✅ `receiveRawMaterial()` - Simple insert + validation
- ✅ `issueRawMaterial()` - Stock check + insert
- ✅ `receiveFinishedGoods()` - Simple insert
- ✅ `issueFinishedGoods()` - Stock check + insert
- ✅ `recordWipIn()` - Simple insert
- ✅ `recordWipOut()` - Stock check + insert

**Why Edge?**
- Q1: < 2-3 detik? ✅ YES (single record, simple validation)
- Q2: Need queue/retry? ❌ NO (idempotent)
- Q3: Touch ribuan records? ❌ NO (single transaction)

#### 2. **Adjustment Workflows**
- ✅ `createAdjustment()` - Create header + lines
- ⚠️ `postAdjustment()` - Transform lines → ledger entries

**Analysis `postAdjustment()`:**
- Q1: < 2-3 detik? ✅ YES (typically 5-20 lines max)
- Q2: Need queue/retry? ❌ NO (atomic transaction)
- Q3: Touch ribuan records? ❌ NO (batch < 100 lines)
- **Decision:** ✅ EDGE (with transaction)

#### 3. **Transfer Workflows**
- ✅ `createTransfer()` - Create header + lines
- ✅ `postTransfer()` - Create OUT + IN entries

**Why Edge?**
- Same as adjustment (small batch, atomic)

#### 4. **Journal Workflows**
- ✅ `createJournalEntry()` - Create header + lines
- ✅ `postJournal()` - Validate balance + update status

**Why Edge?**
- Simple validation + update

#### 5. **Purchase Workflows**
- ✅ `createPurchaseOrder()` - Create PO
- ✅ `postGoodsReceipt()` - Create GRN + update inventory
- ✅ `createVendorInvoice()` - Create invoice
- ✅ `allocatePayment()` - Allocate payment to invoices

**Why Edge?**
- All I/O bound, decision-heavy but light

#### 6. **Sales Workflows**
- ✅ `createSalesOrder()` - Create SO
- ✅ `postDeliveryOrder()` - Create DO + update inventory
- ✅ `createSalesInvoice()` - Create invoice
- ✅ `allocateARPayment()` - Allocate payment

**Why Edge?**
- Same pattern as purchase

#### 7. **Manufacturing Workflows**
- ✅ `createProductionOrder()` - Create PO
- ✅ `startProduction()` - Issue materials
- ✅ `completeStage()` - Move WIP between stages
- ✅ `completeProduction()` - Receive finished goods

**Why Edge?**
- Sequential but fast (< 2 sec per stage)

---

### ⚠️ **NODE.JS WORKERS** (Heavy, Batch, Async)

#### 1. **Period Closing** ❌ NOT EDGE
- `closePeriod()` - Validate all transactions, create snapshots

**Why Node.js?**
- Q1: < 2-3 detik? ❌ NO (could be 10-30 sec for large data)
- Q2: Need queue/retry? ✅ YES (complex validation)
- Q3: Touch ribuan records? ✅ YES (all transactions in period)

#### 2. **Marketplace Sync** ❌ NOT EDGE
- `syncMarketplaceOrders()` - Bulk import from Shopee/Tiktok
- `syncMarketplaceStock()` - Bulk export inventory

**Why Node.js?**
- Q1: < 2-3 detik? ❌ NO (API calls + bulk processing)
- Q2: Need queue/retry? ✅ YES (external API, need retry)
- Q3: Touch ribuan records? ✅ YES (bulk sync)

#### 3. **Historical Recomputation** ❌ NOT EDGE
- `recomputeCOGS()` - Recalculate COGS for period
- `rebuildStockHistory()` - Rebuild stock balances

**Why Node.js?**
- Q1: < 2-3 detik? ❌ NO (batch processing)
- Q3: Touch ribuan records? ✅ YES (historical data)

---

## 📋 **MVP Implementation Plan (Day 2-3)**

### **Phase 2A: Edge Functions** (Day 2 - 8 hours)

**Priority 1: Inventory** (2h)
- [ ] `receive-raw-material`
- [ ] `issue-raw-material`
- [ ] `receive-finished-goods`
- [ ] `issue-finished-goods`

**Priority 2: Adjustments & Transfers** (2h)
- [ ] `post-adjustment`
- [ ] `post-transfer`

**Priority 3: Purchase** (2h)
- [ ] `post-goods-receipt`
- [ ] `create-vendor-invoice`

**Priority 4: Sales** (2h)
- [ ] `post-delivery-order`
- [ ] `create-sales-invoice`

### **Phase 2B: Node.js Workers** (SKIP for MVP)

**Out of Scope for 1-week MVP:**
- ❌ Period closing (manual for MVP)
- ❌ Marketplace sync (manual import/export for MVP)
- ❌ Historical recomputation (not needed for MVP)

**Rationale:**
- MVP fokus ke core transactions
- Heavy workflows bisa manual dulu
- Node.js workers added in Phase 2 (post-MVP)

---

## 🏗️ **Architecture Diagram**

```
Frontend (React)
   │
   ├─ Simple CRUD ──► Supabase (direct)
   │
   └─ Complex Workflows ──► Edge Functions ──► PostgreSQL
                              │
                              ├─ receive-raw-material
                              ├─ post-adjustment
                              ├─ post-goods-receipt
                              └─ post-delivery-order

Node.js Workers (Future - Post MVP)
   │
   ├─ close-period
   ├─ sync-marketplace
   └─ recompute-cogs
```

---

## ✅ **Decision Matrix**

| Workflow | Q1 (<2s) | Q2 (Queue) | Q3 (Bulk) | Decision |
|----------|----------|------------|-----------|----------|
| Receive Material | ✅ | ❌ | ❌ | **Edge** |
| Issue Material | ✅ | ❌ | ❌ | **Edge** |
| Post Adjustment | ✅ | ❌ | ❌ | **Edge** |
| Post Transfer | ✅ | ❌ | ❌ | **Edge** |
| Post GRN | ✅ | ❌ | ❌ | **Edge** |
| Post DO | ✅ | ❌ | ❌ | **Edge** |
| Close Period | ❌ | ✅ | ✅ | **Node** |
| Marketplace Sync | ❌ | ✅ | ✅ | **Node** |

---

## 📊 **Effort Estimation**

### Edge Functions (MVP)
- Setup Supabase Edge Functions: 1h
- Implement 8 core functions: 6h
- Testing: 1h
- **Total: 8 hours (Day 2)**

### Node.js Workers (Post-MVP)
- Setup Node.js backend: 2h
- Implement 3 workers: 4h
- Queue setup: 2h
- **Total: 8 hours (Future)**

---

## 🎯 **Next Steps**

1. ✅ Create Edge Functions structure
2. ✅ Implement Priority 1-4 functions
3. ✅ Update frontend to call Edge Functions
4. ✅ Test all workflows
5. ❌ Skip Node.js workers (post-MVP)

**Ready to proceed with Edge Functions?** 🚀
