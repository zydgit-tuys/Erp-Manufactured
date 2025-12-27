# 📋 ZIYADA ERP - PROJECT SCOPE & ARCHITECTURE

**Status:** Design Phase (Blueprint Production-Ready)  
**Date:** 27 December 2025  
**Author:** Architecture Design Team  
**Version:** 1.0  

---

## 📑 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Project Overview](#project-overview)
3. [Problem Statement](#problem-statement)
4. [Solution & Objectives](#solution--objectives)
5. [Scope Definition](#scope-definition)
6. [Technology Stack](#technology-stack)
7. [System Architecture](#system-architecture)
8. [Data Model](#data-model)
9. [Modules & Features](#modules--features)
10. [Implementation Timeline](#implementation-timeline)
11. [Critical Success Factors](#critical-success-factors)
12. [Risk & Mitigation](#risk--mitigation)
13. [Team & Resources](#team--resources)
14. [Deliverables](#deliverables)

---

## EXECUTIVE SUMMARY

### Client Profile
- **Company:** Ziyada Sport (Bobing Shop)
- **Industry:** Fashion/Konveksi E-commerce
- **Business Model:** Multi-channel retail (POS + Distributor + Marketplace)
- **Current Scale:** Single warehouse, 100+ SKU (size+warna variants)
- **Growth Target:** Scalable untuk 5+ tahun ke depan

### Project Goal
**Build a production-grade ERP system** that:
- Integrates purchase → manufacturing → sales in a single, audit-ready system
- Ensures 100% inventory accuracy across all channels
- Automates double-entry accounting for all transactions
- Provides reliable cost-of-goods-sold (COGS) and margin reporting
- Locks down period closing with financial controls

### Key Deliverables
| Deliverable | Status | Ownership |
|-------------|--------|-----------|
| Complete Supabase Schema (DDL) | Pending | Backend |
| Node.js Service Layer (Contract) | Pending | Backend |
| React/Vite Frontend (Forms + Dashboard) | Pending | Frontend |
| Test Suite (Unit + Integration + Chaos) | Pending | QA + Backend |
| Go-Live Checklist & Runbook | Pending | DevOps + PM |

### Investment & Timeline
- **Estimated Timeline:** 13 weeks (3+ months)
- **Team Size:** 4-5 people (1 DBA, 2 Backend, 1 Frontend, 1 QA/PM)
- **MVP Release:** Single warehouse, core modules (M0-M7)
- **Phase 2 (Future):** Multi-warehouse, advanced analytics

---

## PROJECT OVERVIEW

### Vision Statement
> **"A single source of truth for inventory, manufacturing, and finance that enables Ziyada Sport to make real-time pricing decisions, detect cost anomalies, and scale operations without manual intervention."**

### Strategic Alignment
```
Business Outcomes          ← Technical Enablers
├─ Prevent overselling    ← Single inventory ledger
├─ Accurate COGS          ← Auto journal posting
├─ Margin per SKU         ← Period-based MV
├─ Fast period closing    ← Immutable ledger
├─ Audit-ready            ← Source traceability
└─ Scalable to multi-WH   ← Tenant-based RLS, modular architecture
```

### In-Scope vs Out-of-Scope

**IN SCOPE (MVP):**
- ✅ Single warehouse
- ✅ 3-channel sales (POS, Distributor, Marketplace)
- ✅ Manufacturing (BOM, WIP per 3 stages, production order)
- ✅ Purchase & AP
- ✅ Finance (double-entry, period closing)
- ✅ Reporting (inventory, COGS, margin, aging)

**OUT OF SCOPE (Future Phases):**
- ❌ Multi-warehouse (Phase 2)
- ❌ Advanced demand planning
- ❌ Full payroll/HR module
- ❌ Complex shipping carrier integration (basic manual input only)
- ❌ Consignment management
- ❌ Real-time multi-tenant dashboard (can be added later)

---

## PROBLEM STATEMENT

### Current State Issues

#### 🔴 Operational Problems

**1. Inventory Misalignment**
```
Symptoms:
├─ Overselling: item shows available in 1 channel, sold out in reality
├─ Dead stock: slow-moving items hidden in warehouse
├─ Phantom inventory: stok report ≠ stok fisik
├─ Manual channel sync: copy-paste between systems

Root Cause:
├─ Per-channel inventory tracking (Shopee, TikTok, Tokopedia separate)
├─ No single source of truth
├─ Manual reconciliation every month

Impact:
├─ Lost sales (can't fulfill orders)
├─ Excess inventory (capital locked)
├─ Customer complaints (order delayed/cancelled)
└─ Operational overhead (reconciliation staff)
```

**2. Production Cost Opacity**
```
Symptoms:
├─ BOM exists only in Excel, changes mid-production
├─ WIP (Work-in-Progress) not tracked by stage
├─ Reject/scrap rate unknown
├─ Margin per SKU impossible to calculate

Root Cause:
├─ No production order system
├─ No WIP ledger (stage: Cut → Sew → Finish)
├─ Biaya masuk semua di akhir, tidak bertahap
├─ BOM can be edited, affecting in-flight orders

Impact:
├─ COGS unpredictable
├─ Pricing decisions guesswork
├─ No margin visibility per style/size/color
└─ Impossible to detect production inefficiency
```

#### 🔴 Financial Problems

**3. COGS & Margin Not Trustworthy**
```
Symptoms:
├─ Monthly P&L reconciliation takes 3-5 days
├─ COGS doesn't match inventory movement
├─ Margin reports conflict with management intuition
├─ Variance analysis requires Excel manual work

Root Cause:
├─ COGS posted manually after inventory close
├─ No automatic costing engine
├─ Standard vs actual cost not tracked
├─ Overhead allocation ad-hoc

Impact:
├─ Delayed business decisions
├─ Inaccurate pricing (pricing older cost)
├─ Tax compliance risk (understated/overstated COGS)
└─ Cannot quickly detect cost anomalies
```

**4. Period Closing Headaches**
```
Symptoms:
├─ Manual journal entry fixes (after close)
├─ Closing timeline: 2-3 weeks
├─ Cannot quickly reopen period for fixes
├─ Audit questions about backdated entries

Root Cause:
├─ No period lock enforcement at schema level
├─ Journal entries scattered (manual + system)
├─ No immutable ledger
├─ Missing traceability

Impact:
├─ Audit risk (data integrity questioned)
├─ Finance team burnout (month-end crunch)
├─ Cannot forecast/analyze quickly
└─ No snapshots for historical comparison
```

#### 🔴 Strategic Problems

**5. Cannot Scale**
```
Symptoms:
├─ Manual inventory tracking = not feasible with 2+ warehouses
├─ Team cannot expand (each person handles one process)
├─ Cannot launch new product lines quickly
├─ Cannot negotiate supplier contracts (no cost visibility)

Root Cause:
├─ Systems are manual/semi-automated
├─ No automation for repetitive tasks
├─ Knowledge siloed in individuals

Impact:
├─ Growth ceiling at current capacity
├─ High operational risk (key person dependency)
├─ Cannot compete on real-time pricing/promo
└─ Expansion plans stalled
```

---

## SOLUTION & OBJECTIVES

### High-Level Solution

**Build Ziyada ERP** — a fully integrated, audit-ready manufacturing ERP that:

```
Purchase Cycle          Manufacturing Cycle       Sales Cycle        Finance
   ↓                        ↓                         ↓                ↓
  PO                    Production Order          Sales Order      Journal
  ↓                        ↓                         ↓                ↓
 GRN          ←→    WIP (3 stages)      ←→    Invoice/DO      ←    Auto-posting
  ↓                        ↓                         ↓
Vendor Invoice        Finished Goods         Cash/AR/Marketplace   Period Closing
  ↓                        ↓                         ↓                ↓
  AP                    COGS                      Settlement        Trial Balance

🔗 Single Source of Truth: All inventory & finance transactions immutable & traceable
```

### Primary Objectives

| # | Objective | Success Metric | Priority |
|---|-----------|---|---|
| 1 | **Single Inventory Truth** | 100% inventory sync across channels; 0 oversells | P0 |
| 2 | **Auto COGS Posting** | 100% of COGS auto-journaled; 0 manual entries | P0 |
| 3 | **Accurate Costing** | Margin variance < 2% from expected | P0 |
| 4 | **Period Lock** | 0 backdated edits after period close | P0 |
| 5 | **Fast Closing** | Period close ≤ 1 business day (from 2-3 weeks) | P1 |
| 6 | **Real-time Dashboard** | KPI available within 5 minutes of posting | P1 |
| 7 | **Audit-Ready** | 100% transactions traceable to source | P1 |
| 8 | **Scale to Multi-WH** | Architecture ready for 3+ warehouses (Phase 2) | P2 |

---

## SCOPE DEFINITION

### MVP Scope (Ziyada ERP v1.0)

#### Module M0: Foundation
**Duration:** 1 week  
**Dependencies:** None  
**Description:** Schema, auth, core infrastructure

**Features:**
- [ ] Supabase project setup (Auth, RLS, Database)
- [ ] Product & Product Variant master (SKU = size + warna)
- [ ] Material/Raw material master
- [ ] Vendor & Customer master
- [ ] Chart of Accounts (COA template for konveksi)
- [ ] Accounting Period setup (first month)
- [ ] Role-based access control (Purchasing, Production, Sales, Finance)
- [ ] Audit trail (who changed what, when)

**Deliverables:**
```
├─ schema.sql (complete DDL)
├─ rls_policies.sql (row-level security)
├─ seeds/initial_data.sql (COA, roles, first period)
└─ docs/M0_SETUP.md (implementation guide)
```

---

#### Module M1: Inventory Core
**Duration:** 2 weeks  
**Dependencies:** M0  
**Description:** Foundation for all inventory tracking (raw, WIP, FG)

**Features:**
- [ ] **Raw Material Ledger** (append-only)
  - Material receipt from purchase
  - Issue to production
  - Stock balance MV
  - Unit cost snapshot per transaction

- [ ] **WIP Ledger** (append-only, per stage)
  - Stage: CUT, SEW, FINISH
  - Qty in/out per stage
  - Cost accumulation per stage
  - WIP balance MV (detect hanging WIP)

- [ ] **Finished Goods Ledger** (append-only, per SKU)
  - Receipt from production
  - Issue from sales
  - Stock balance MV
  - Unit cost snapshot (immutable once posted)

- [ ] **Inventory Adjustment**
  - Stock opname input
  - Variance accounting (Dr. Loss / Cr. FG)
  - Reason code tracking

- [ ] **Internal Transfers** (bin-to-bin)
  - Transfer header + lines
  - No cost change
  - Ledger entry for audit

- [ ] **Safety Constraints**
  - No negative stock at transaction-time
  - Cost always ≥ 0
  - Source traceability mandatory
  - Period enforcement

**Deliverables:**
```
├─ schema/inventory_*.sql
├─ migrations/M1_*.sql
├─ service/inventory.service.ts (receiveRaw, adjustStock)
├─ api/inventory.routes.ts
├─ components/Inventory* (React forms)
├─ tests/M1_*.test.ts (unit + integration)
└─ docs/M1_INVENTORY.md
```

---

#### Module M2: Purchase & Accounts Payable
**Duration:** 1 week  
**Dependencies:** M0, M1  
**Description:** PO → GRN → Vendor Invoice → AP payment

**Features:**
- [ ] **Purchase Order (PO)**
  - Create PO (vendor, items, qty, price, ETA)
  - Status: Draft → Approved → Sent → Closed
  - Multi-item support
  - Tax calculation

- [ ] **Goods Receipt Note (GRN)**
  - Partial receipt (can receive qty < PO qty)
  - Auto-map to PO
  - Trigger: Raw Material Ledger +qty, +cost

- [ ] **Vendor Invoice**
  - Match to PO/GRN
  - Tax treatment (regular/simplified)
  - Payment terms (due date calculation)
  - Auto journal: Dr. Inventory Raw / Cr. AP

- [ ] **AP Aging**
  - Track unpaid invoices
  - Due date alerts

- [ ] **AP Payment**
  - Record payment (cash/bank)
  - Auto journal: Dr. AP / Cr. Bank
  - Apply to invoice(s)

**Journal Mapping:**
```
Transaction              Debit             Credit
GRN + Vendor Invoice  → Inventory Raw     Accounts Payable
AP Payment            → Accounts Payable  Bank
```

**Deliverables:**
```
├─ schema/purchase_*.sql
├─ service/purchase.service.ts
├─ api/purchase.routes.ts
├─ components/PO*, VendorInvoice*, APPayment* (React)
├─ tests/M2_*.test.ts
└─ docs/M2_PURCHASE.md
```

---

#### Module M3: Manufacturing (CORE KONVEKSI)
**Duration:** 2 weeks  
**Dependencies:** M0, M1, M2  
**Description:** BOM → Production Order → WIP → FG with cost tracking

**Features:**
- [ ] **Bill of Materials (BOM)** (IMMUTABLE & VERSIONED)
  - BOM header: product, version, status (draft/active/retired), effective_from/to
  - BOM materials: material_id, qty_per_unit, UOM
  - BOM operations: routing (CUT, SEW, FINISH), sequence, standard_cost
  - **CRITICAL:** No UPDATE allowed on BOM (only new version)
  - Multi-level BOM (if needed): parent SKU → variants

- [ ] **Routing & Operations**
  - Standard 3 operations: CUT, SEW, FINISH
  - Sequence enforcement (cannot skip CUT → SEW)
  - Standard cost per operation (future enhancement)
  - Lead time tracking (optional for MVP)

- [ ] **Production Order**
  - Create from: manual demand or Sales Order
  - Link to active BOM version (immutable for life of order)
  - Plan qty (can be partial/multiple batches)
  - Status: Planned → In Progress → Completed → Cancelled
  - Pick list generation (materials needed)

- [ ] **Issue Material (Raw → WIP)**
  - Scan material + qty from production floor
  - Deduct from Raw Material Ledger
  - Add to WIP Ledger (CUT stage)
  - Cost = actual (from raw ledger snapshot)
  - Journal: Dr. WIP-CUT / Cr. Raw Material

- [ ] **WIP Stage Movement (WIP → WIP)**
  - Move from CUT → SEW → FINISH
  - Add labor cost (actual from payroll or estimated)
  - Add overhead (batch allocation or per-unit)
  - Journal per stage: Dr. WIP-SEW / Cr. WIP-CUT (and cost accrual)

- [ ] **Production Receipt (WIP → FG)**
  - Output qty (can be < plan qty due to scrap)
  - Auto calculate unit cost: (total cost / qty good)
  - Scrap qty + cost (Dr. Loss / Cr. WIP)
  - Status: In Progress → Completed
  - Journal: Dr. FG / Cr. WIP-FINISH; Dr. Loss / Cr. WIP (if scrap)

- [ ] **Actual Costing** (MVP standard)
  - WIP accumulates: material + labor + overhead
  - Unit cost calculated at receipt
  - Hybrid-ready: can add standard cost variance tracking later

- [ ] **Cost Variance Tracking** (optional MVP, recommended)
  - Standard cost per BOM
  - Actual cost per production order
  - Variance = Actual - Standard (post-completion)
  - Journal: Dr./Cr. Cost Variance

**Production Flow Example:**
```
Production Order: PO-001, Product: Kaos TS-001, Qty: 100

Step 1: Issue Material (Potong/CUT)
└─ Issue 10m kain @ Rp 50k/m = Rp 500k
   Raw Ledger: -10, value -500k
   WIP Ledger (CUT): +100 units, cost +500k
   Journal: Dr. WIP-CUT 500k / Cr. Raw Material 500k

Step 2: Move CUT → SEW
└─ Add sewing labor: 100 units × Rp 20k = Rp 2m
   WIP Ledger (SEW): +100 units, cost +2m
   Journal: Dr. WIP-SEW 2m / Cr. Accrued Labor 2m

Step 3: Move SEW → FIN
└─ Add finishing + overhead: 100 units × Rp 15k = Rp 1.5m
   WIP Ledger (FIN): +100 units, cost +1.5m
   Journal: Dr. WIP-FIN 1.5m / Cr. Overhead Expense 1.5m

Step 4: Production Complete (WIP → FG)
└─ Output: 97 good, 3 scrap
   FG Ledger: +97 units @ (500k + 2m + 1.5m)/100 = Rp 40k/unit = Rp 3.88m
   WIP Ledger (FIN): -100 units
   Scrap: 3 × 40k = Rp 120k
   Journal: 
     Dr. FG 3.88m / Cr. WIP-FIN 3.88m
     Dr. Loss 120k / Cr. WIP-FIN 120k
```

**Deliverables:**
```
├─ schema/manufacturing_*.sql
├─ service/production.service.ts (issueMaterial, moveWip, completeProduction)
├─ service/costing.service.ts (calculateVariance, postCosts)
├─ api/production.routes.ts
├─ components/BOM*, ProductionOrder*, MaterialIssue*, WipMovement*, ProductReceipt*
├─ tests/M3_*.test.ts (including chaos tests for WIP hang)
└─ docs/M3_MANUFACTURING.md
```

---

#### Module M4: Sales - POS (Retail)
**Duration:** 1 week  
**Dependencies:** M0, M1  
**Description:** Point-of-sale for retail transactions (cash/e-wallet)

**Features:**
- [ ] **POS Interface**
  - Barcode/SKU scanning (item + size + color)
  - Qty input
  - Discount/coupon application
  - Real-time stock check (prevent oversell)

- [ ] **POS Invoice**
  - Line-by-line: SKU, qty, unit price, line amount
  - Tax calculation (if applicable)
  - Subtotal, tax, total
  - Payment method: cash, e-wallet (list configurable)

- [ ] **Payment & Settlement**
  - Record payment received
  - Calculate change (if cash)
  - Payment status: pending → settled
  - Auto journal: Dr. Cash / Cr. Sales Revenue

- [ ] **COGS Auto-Posting**
  - At payment, auto-issue from FG
  - FG Ledger: -qty
  - Journal: Dr. COGS / Cr. FG Inventory (at unit_cost from FG)

- [ ] **Return Handling**
  - Return full invoice or partial items
  - Reverse sales revenue
  - Reverse COGS, add back to FG
  - Journal: reversal entries

- [ ] **Daily Settlement**
  - Close register
  - Total cash vs system
  - Variance flag (if any)

**Journal Mapping:**
```
Transaction                 Debit              Credit
POS Sale (cash)        →    Cash               Sales Revenue
POS Sale (COGS)        →    COGS               FG Inventory
POS Return             →    (reversals)        (reversals)
```

**Deliverables:**
```
├─ schema/sales_pos_*.sql
├─ service/sales.pos.service.ts
├─ api/sales.pos.routes.ts
├─ components/POSInterface*, POSInvoice*, POSPayment*, POSReturn*
├─ tests/M4_*.test.ts (including concurrent sale + COGS check)
└─ docs/M4_POS.md
```

---

#### Module M5: Sales - Distributor (Credit)
**Duration:** 2 weeks  
**Dependencies:** M0, M1, M4  
**Description:** Sales Order → Delivery Note → Invoice → AR → Payment

**Features:**
- [ ] **Sales Order (SO)**
  - Customer + items + qty + price (from price list)
  - Price list per customer (negotiated pricing, credit terms)
  - Credit limit check (block if exceed)
  - Status: Draft → Approved → Sent
  - Optional: reserve stock (can implement later)

- [ ] **Delivery Note (DO)**
  - Create from SO (can partial deliver)
  - Confirm delivery qty
  - Status: Draft → Sent → Received (by customer)

- [ ] **Sales Invoice**
  - Create from DO (or SO if same-day delivery)
  - Auto calc: items, subtotal, tax, total
  - Auto journal: Dr. AR / Cr. Sales Revenue
  - Status: Draft → Posted
  - Tax: invoice date determines tax period

- [ ] **Accounts Receivable (AR)**
  - Track unpaid invoices
  - Due date (from credit term: e.g., Net 14/30)
  - AR aging report
  - Payment status

- [ ] **AR Payment**
  - Record customer payment (cash/transfer/check)
  - Apply to invoice(s)
  - Auto journal: Dr. Bank / Cr. AR
  - Discount (if early payment)

- [ ] **COGS at Shipment/Invoice** (choose one, apply consistently)
  - Recommended: COGS at DO (delivery confirmation)
  - Alt: COGS at Invoice
  - FG Ledger: -qty
  - Journal: Dr. COGS / Cr. FG

- [ ] **Credit Term Management**
  - Define terms per customer: Net 14, Net 30, Net 60
  - Auto calc due date
  - Interest calculation (optional)

**Journal Mapping:**
```
Transaction          Debit           Credit
SO → DO → Invoice  → AR              Sales Revenue
DO Shipment        → COGS            FG Inventory
AR Payment         → Bank/Cash       AR
```

**Deliverables:**
```
├─ schema/sales_distributor_*.sql
├─ service/sales.distributor.service.ts
├─ api/sales.distributor.routes.ts
├─ components/SalesOrder*, DeliveryNote*, SalesInvoice*, ARPayment*, ARAgingReport*
├─ tests/M5_*.test.ts
└─ docs/M5_SALES_DISTRIBUTOR.md
```

---

#### Module M6: Sales - Marketplace
**Duration:** 2 weeks  
**Dependencies:** M0, M1, M4, M5  
**Description:** Multi-marketplace integration (Shopee, TikTok, Tokopedia, Lazada)

**Features:**
- [ ] **Order Import**
  - Manual upload (CSV for MVP)
  - Auto-map to SKU (sku_code matching)
  - Channel enum: Shopee, TikTok, Tokopedia, Lazada, etc.
  - Order status: New → Confirmed → Packed → Shipped

- [ ] **Order Processing**
  - Create internal Sales Order (channel=Marketplace)
  - Price from marketplace price list
  - COGS at shipment (same as Distributor)

- [ ] **Fulfillment**
  - Pick & pack from FG inventory
  - Check stock (prevent oversell)
  - Generate shipment (tracking number, carrier)
  - Reduce FG inventory
  - Journal: Dr. COGS / Cr. FG

- [ ] **Marketplace Settlement**
  - Platform fees (marketplace deduct from payout)
  - Payout to bank (weekly/monthly per marketplace)
  - Reconciliation: order total vs settlement amount
  - Batch settlement entry

- [ ] **Settlement Journal Mapping**
  ```
  Shipment                → Dr. COGS / Cr. FG Inventory
  Settlement Receipt      → Dr. Marketplace Clearing / Cr. Sales Revenue
  Platform Fee Deduction  → Dr. Marketplace Fee Expense / Cr. Marketplace Clearing
  Payout to Bank         → Dr. Bank / Cr. Marketplace Clearing
  ```

- [ ] **Return & Refund**
  - Reverse sale + COGS
  - Deduct from next settlement (or cash settlement)

- [ ] **Channel Analytics**
  - Sales by channel (POS vs Distributor vs Marketplace)
  - Margin per channel
  - Fee impact analysis

**Important Note:** All channels share SINGLE inventory → prevents overselling

**Deliverables:**
```
├─ schema/sales_marketplace_*.sql
├─ service/sales.marketplace.service.ts
├─ service/marketplace_integration.service.ts (CSV import, settlement)
├─ api/sales.marketplace.routes.ts
├─ components/MarketplaceOrderImport*, Settlement*, ChannelAnalytics*
├─ tests/M6_*.test.ts (including multi-channel inventory sync)
└─ docs/M6_MARKETPLACE.md
```

---

#### Module M7: Finance & Period Closing
**Duration:** 1 week  
**Dependencies:** M0-M6  
**Description:** Double-entry journal, period control, reporting

**Features:**
- [ ] **Chart of Accounts (COA)**
  - Asset: Inventory Raw, WIP, FG, Cash, AR, AP
  - Liability: AP, ST/LT Debt
  - Equity: Capital, Retained Earnings
  - Income: Sales Revenue (by channel)
  - Expense: COGS, Labor, Overhead, Marketplace Fee, Loss/Gain
  - Tax: Input Tax (if VAT/PPh applicable)

- [ ] **Journal Entry (Immutable)**
  - Header: journal_date, period_code, source_type, source_id, is_posted, is_locked
  - Lines: account_id, debit, credit (CHECK: debit XOR credit)
  - Status: Draft → Posted → Locked
  - **No updates after posted** (only via reversal)

- [ ] **Automatic Journal Posting**
  - All modules (Purchase, Inventory, Production, Sales) auto-post journal
  - Service layer transaction: inventory + journal in same COMMIT
  - Validation: total debit == total credit
  - Proof: every inventory movement = journal entry

- [ ] **Journal Entry Reversal** (for corrections)
  - Create reversing entry with original reference
  - Date: current date, period: current period
  - Only allowed if period still open

- [ ] **Trial Balance (Report)**
  - Debit sum vs Credit sum (must balance)
  - Account balance (for month)
  - Generated from journal_lines (immutable)

- [ ] **Accounting Period Control**
  - Period setup: period_code (YYYY-MM), start_date, end_date
  - Status: Open → Closed
  - Period lock: after closed, no new transactions with that period_code
  - Re-open: only with role approval (Finance Manager)

- [ ] **Period Closing Process**
  - Pre-close checks:
    - WIP balance = 0 (all completed or reversed)
    - All inventory movements posted
    - All AP/AR reconciled
    - Trial balance = 0
  - Block close if checks fail (error msg to user)
  - Post close:
    - Period immutable
    - MV snapshot locked
    - No edits without re-open
  - Re-open: audit log entry, adjustment entries allowed

- [ ] **Audit Trail**
  - All mutations logged: who, when, what, old value → new value
  - Immutable audit table
  - Queryable by transaction/user/date/table

**RLS & Security:**
```sql
-- Period lock enforced at RLS level
CREATE POLICY period_lock_policy ON finance_journal_entries
  FOR INSERT USING (
    NOT EXISTS (
      SELECT 1 FROM accounting_periods
      WHERE period_code = NEW.period_code
      AND status = 'closed'
    )
  );

-- Tenant isolation
CREATE POLICY tenant_isolation ON finance_journal_entries
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

**Deliverables:**
```
├─ schema/finance_*.sql (journal, period, audit)
├─ service/finance.service.ts (postJournal, closePeriod, reversal)
├─ api/finance.routes.ts
├─ components/JournalEntry*, TrialBalance*, PeriodClosing*, AuditLog*
├─ tests/M7_*.test.ts (chaos: backdate, double-post, period lock)
└─ docs/M7_FINANCE.md
```

---

#### Module M8: Reporting (OLAP Layer)
**Duration:** 1 week  
**Dependencies:** All modules  
**Description:** Materialized Views + Dashboard

**Materialized Views (Snapshot-Based, Period-Locked):**

1. **Inventory Balance**
   - `mv_inventory_raw_balance`: material_id, period_code, qty, value
   - `mv_inventory_wip_balance`: production_order_id, stage, period_code, qty, value
   - `mv_inventory_fg_balance`: product_variant_id, period_code, qty, value

2. **COGS & Margin** (per SKU per Period)
   - `mv_cogs_per_sku_period`: product_variant_id, period_code, qty_sold, cogs_amount
   - `mv_revenue_per_sku_period`: product_variant_id, period_code, revenue_amount
   - `mv_margin_per_sku_period`: product_variant_id, period_code, revenue, cogs, gross_margin, margin_%

3. **Inventory Health**
   - `mv_inventory_fg_aging`: product_variant_id, period_code, age_days, aging_bucket (0-30/31-60/61-90/90+), qty, value
   - `mv_inventory_slow_moving`: product_variant_id (where age > 90 and qty > 0)
   - `mv_inventory_turnover`: product_variant_id, period_code, turnover_ratio, avg_inventory
   - `mv_inventory_days_on_hand`: product_variant_id, period_code, days_on_hand

4. **AP/AR Aging**
   - `mv_ar_aging`: customer_id, period_code, age_bucket, amount, count
   - `mv_ap_aging`: vendor_id, period_code, age_bucket, amount, count

5. **Financial Summary**
   - `mv_trial_balance`: account_id, period_code, debit_balance, credit_balance
   - `mv_sales_by_channel`: channel, period_code, qty, revenue, cogs, margin
   - `mv_monthly_summary`: period_code, total_revenue, total_cogs, gross_profit, expenses

**MV Refresh Strategy:**
```sql
-- Nightly (off-peak) or after period close
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_raw_balance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_fg_balance;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cogs_per_sku_period;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_margin_per_sku_period;
-- etc. (all MVs)

-- Safety: block refresh during period closing
-- Safety: snapshot immutable after period close
```

**Dashboard Components:**

| Dashboard | Audience | Metrics | Refresh |
|-----------|----------|---------|---------|
| **Operations** | Warehouse/Ops Manager | Current stock (qty), Low stock alerts, WIP pending, Slow-moving list | Real-time (from ledger) |
| **Production** | Production Manager | WIP by stage (qty + value), Production progress (%), Scrap rate, Cycle time | Real-time |
| **Sales** | Sales Manager | Daily sales (qty, revenue), Sales by channel, Top SKU, Customer performance | Hourly |
| **Finance** | Finance Manager | Trial balance, P&L (revenue/COGS/margin), Cash flow, AR/AP aging | Daily (post-close) |
| **Executive** | Owner/Director | Margin %, ROI, Cash conversion cycle, Channel comparison, Growth trend | Weekly |

**Deliverables:**
```
├─ schema/materialized_views/*.sql
├─ migrations/M8_*.sql (MV refresh jobs)
├─ service/reporting.service.ts (MV refresh, snapshot validation)
├─ api/reporting.routes.ts
├─ components/Dashboard*, InventoryReport*, SalesReport*, FinanceReport*
├─ tests/M8_*.test.ts (MV integrity, snapshot consistency)
└─ docs/M8_REPORTING.md
```

---

#### Module M9: Testing & Go-Live
**Duration:** 2 weeks  
**Dependencies:** All modules  
**Description:** QA, chaos testing, UAT, data migration, deployment

**Phase 1: Unit & Integration Tests** (parallel with development)
```
Test Coverage:
├─ Unit tests: each service function
├─ Integration tests: multi-service workflows
├─ Database tests: constraint enforcement
├─ API tests: endpoint validation
└─ Target: ≥ 80% coverage

Automation:
├─ GitHub Actions CI/CD
├─ Automated test runs on PR
├─ Coverage reports
└─ Deployment gates (all tests pass)
```

**Phase 2: Chaos Testing** (week 1 of M9)
```
Scenarios (must ALL result in FAIL as expected):
├─ Network interruption mid-transaction → automatic rollback
├─ Double-click submission → idempotency prevents duplicate
├─ Period closing with hanging WIP → blocked
├─ Backdate entry to closed period → rejected
├─ Negative stock → rejected at constraint
├─ Unbalanced journal → rejected at posting
├─ Concurrent inventory issue + sales → correct quantity
└─ (All must be automated tests)
```

**Phase 3: User Acceptance Testing (UAT)** (week 2 of M9)
```
Participants:
├─ Warehouse staff (inventory, production)
├─ Sales staff (POS, distributor, marketplace)
├─ Finance staff (AP/AR, period closing)
└─ Management (dashboard, KPI)

Test Scenarios (scripted):
├─ End-to-end: PO → GRN → Production → Sales → Invoice → Period Close
├─ Multi-channel: same item sold via POS + marketplace simultaneously (no oversell)
├─ Period control: cannot edit closed period
├─ COGS accuracy: margin matches expectation
└─ Dashboard: numbers match finance reports

Success Criteria:
├─ 100% scripted scenarios pass
├─ 0 critical bugs
├─ ≤ 5 minor bugs (non-blocking)
├─ User satisfaction ≥ 4/5 (Likert scale)
└─ Sign-off from Finance Manager
```

**Phase 4: Data Migration** (if from legacy system)
```
If applicable:
├─ Map old SKU → new variants (size+warna)
├─ Migrate opening balance (inventory + AR/AP)
├─ Post reversal journal for legacy data
├─ Validate: total asset = old system
└─ Cutover date (end of month cleanly)
```

**Phase 5: Go-Live** (monitored deployment)
```
Day -1 (Prep):
├─ Database backup
├─ Deployment dry-run
├─ Team on-call list
├─ Rollback plan ready

Day 0 (Morning, low-traffic time):
├─ Deploy backend + DB migrations
├─ Deploy frontend
├─ Smoke tests (login, basic transaction)
├─ Announce: ERP live, POS goes live

Day 0-7 (Support):
├─ Daily issue tracking
├─ Quick fixes (if needed)
├─ User training (on-demand)
├─ Monitor: error logs, performance, data integrity

Week 2+ (Stabilization):
├─ Weekly KPI review
├─ Bug backlog triage
├─ User feedback collection
└─ Phase 2 planning
```

**Deliverables:**
```
├─ tests/**/*.test.ts (comprehensive suite)
├─ chaos/chaos_test_*.ts (automated scenarios)
├─ docs/M9_TESTING.md
├─ docs/GO_LIVE_CHECKLIST.md
├─ docs/GO_LIVE_RUNBOOK.md (step-by-step)
├─ docs/TROUBLESHOOTING.md
├─ docs/SUPPORT_PROCEDURES.md
└─ training/USER_GUIDE.md (for each role)
```

---

### Non-Functional Requirements

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Availability** | 99.5% uptime | Exclude planned maintenance |
| **Performance** | API response < 500ms (p95) | Under normal load |
| **Data Consistency** | 100% (ACID) | Zero data loss tolerance |
| **Security** | SOC2 Type II ready | Encryption at rest + transit |
| **Scalability** | ≥ 1000 concurrent users | Phase 2: ≥ 5000 |
| **Backup** | Daily incremental, weekly full | RPO ≤ 1 day, RTO ≤ 4 hours |
| **Audit Trail** | 100% mutation logged | Immutable, 7-year retention (legal) |
| **Latency** | <100ms intra-datacenter | For Indonesia deployment |

---

## TECHNOLOGY STACK

### Backend (Node.js)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Runtime** | Node.js 20 LTS | Stable, wide ecosystem, Indonesia-friendly hosting |
| **Framework** | Express.js or Nest.js | Express: simple, fast; Nest: scalable, opinionated |
| **Language** | TypeScript | Type safety, better DX, fewer runtime bugs |
| **ORM/Query** | Prisma or Knex + pg | Prisma: modern, migrate-friendly; Knex: lightweight |
| **Validation** | Zod or Joi | Runtime schema validation |
| **Logger** | Winston or Pino | Structured logging, correlation ID tracking |
| **Error Tracking** | Sentry (optional, Phase 2) | Real-time error alerts |
| **Testing** | Jest + Supertest | Standard, good coverage, fast |

**Recommended Stack:** Nest.js + TypeScript + Prisma + Zod

---

### Frontend (React)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Build Tool** | Vite | Fast HMR, optimized build, modern tooling |
| **Framework** | React 18+ | Hooks, Suspense, Server Components (future) |
| **Language** | TypeScript | Type safety for forms, API calls |
| **UI Components** | Shadcn/ui or Material-UI | Accessible, customizable, Tailwind-friendly |
| **Styling** | Tailwind CSS | Utility-first, rapid UI development |
| **State** | TanStack Query (React Query) | Data fetching, caching, background sync |
| **Form** | React Hook Form + Zod | Lightweight, good UX, validation |
| **Routing** | React Router v6+ | Standard, nested routes, loaders |
| **Testing** | Vitest + Testing Library | Fast, similar to Jest, good UX testing |

**Recommended Stack:** React 18 + Vite + React Router + TanStack Query + React Hook Form + Tailwind CSS

---

### Database (PostgreSQL via Supabase)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **Database** | PostgreSQL 15+ | ACID, JSON, full-text search, RLS, triggers |
| **Hosting** | Supabase | Managed PostgreSQL, Auth, Edge Functions, vector support |
| **Migrations** | Supabase Migrations or Prisma | Version-controlled schema changes |
| **Backups** | Supabase auto-backup | Daily incremental, point-in-time restore |
| **Replication** | Supabase (built-in) | Read replicas for reporting (Phase 2) |

**Schema Enforcement Tools:**
```
├─ Constraints: CHECK, UNIQUE, FK, NOT NULL
├─ RLS Policies: tenant isolation, period lock
├─ Triggers: audit trail, immutable ledger protection
└─ Enums: status, channel, operation_code
```

---

### DevOps & Deployment

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| **VCS** | GitHub | Standard, integrates with Actions, UI design tools |
| **CI/CD** | GitHub Actions | Free, native to GitHub, sufficient for MVP |
| **Frontend Hosting** | Vercel | Optimized for React/Vite, fast builds, edge functions |
| **Backend Hosting** | Railway or Render | Simple Node.js deployment, PostgreSQL support |
| **Environment** | Docker (optional) | Reproducible local dev, but Railway/Render handle it |
| **Secrets** | GitHub Secrets + .env.local | Simple for MVP, can migrate to vault later |
| **Monitoring** | Vercel Analytics + simple logs | Built-in, sufficient for MVP |

**Deployment Flow:**
```
Code → GitHub
  ↓
Commit to main
  ↓
GitHub Actions: Run tests
  ↓
Tests pass
  ↓
Auto-deploy: Frontend (Vercel) + Backend (Railway)
  ↓
Database migrations (manual approval on first run)
  ↓
Live on production
```

---

### Summary Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    CLIENTS                                 │
├────────────────────────────────────────────────────────────┤
│  Browser (React/Vite)  │  Mobile (responsive)              │
│  POS Terminal (Chrome) │  Reports (PDF export)             │
└────────────────────────────────────────────────────────────┘
                         ↓ (HTTPS)
┌────────────────────────────────────────────────────────────┐
│            API LAYER (Node.js + Express/Nest.js)           │
├────────────────────────────────────────────────────────────┤
│  ├─ /api/inventory/*                                       │
│  ├─ /api/production/*                                      │
│  ├─ /api/sales/*                                           │
│  ├─ /api/finance/*                                         │
│  └─ /api/reporting/*                                       │
│                                                             │
│  Auth: JWT (Supabase)                                      │
│  RLS Context: set_config('app.tenant_id', ...)             │
└────────────────────────────────────────────────────────────┘
                         ↓ (TCP)
┌────────────────────────────────────────────────────────────┐
│        DATABASE LAYER (PostgreSQL via Supabase)            │
├────────────────────────────────────────────────────────────┤
│  OLTP Tables (Ledger-Based, Immutable)                     │
│  ├─ products, product_variants                             │
│  ├─ inventory_*_ledger (Raw, WIP, FG)                      │
│  ├─ production_orders, boms                                │
│  ├─ sales_orders, invoices, payments                       │
│  └─ finance_journal_entries, accounting_periods            │
│                                                             │
│  Materialized Views (Snapshot-Based)                       │
│  ├─ mv_inventory_*_balance                                 │
│  ├─ mv_cogs_per_sku_period                                 │
│  ├─ mv_margin_per_sku_period                               │
│  ├─ mv_inventory_*_aging                                   │
│  └─ (refresh nightly, locked after period close)           │
│                                                             │
│  RLS Policies (Tenant Isolation + Period Lock)             │
│  Audit Trail (immutable log of all mutations)              │
└────────────────────────────────────────────────────────────┘
```

---

## SYSTEM ARCHITECTURE

### High-Level Data Flow

#### Purchase Cycle
```
Vendor supplies kain

Step 1: Create PO
Purchase Manager → API POST /api/purchase/po
→ Service: validateVendor, validateMaterial, calculateTax
→ DB INSERT: purchase_orders (status='draft')
→ API returns: po_id, po_code

Step 2: Receive Goods (GRN)
Warehouse Staff → API POST /api/purchase/grn
  Body: po_id, material_id, qty, received_qty
→ Service: validateQty (received ≤ po), unit_cost from PO
→ DB INSERT: inventory_raw_ledger (qty=+received_qty, cost=unit_cost, source_type='purchase', source_id=grn_id)
→ DB INSERT: finance_journal_entry (Dr Inventory Raw / Cr AP)
→ API returns: grn_id, confirmed

Step 3: Receive Invoice & Reconcile
Finance Staff → API POST /api/purchase/vendor-invoice
  Body: po_id, grn_id, invoiced_amount, tax
→ Service: match invoice to PO+GRN, calculate variance
→ DB UPDATE: purchase_orders (status='closed') if full
→ DB INSERT: finance_journal (Dr AP / Cr Vendor Payable) — already posted in GRN, so invoice updates status
→ API returns: invoice_id

Step 4: Pay Invoice
Finance Staff → API POST /api/finance/ap-payment
  Body: invoice_id, payment_amount, payment_method
→ Service: apply payment, update AR status
→ DB INSERT: finance_journal (Dr AP / Cr Bank)
→ Update payment status
→ API returns: payment_id, receipt

Result: Cost flows from Vendor → Raw Inventory → WIP → FG → COGS → P&L
         100% traceable, immutable, audit-ready
```

#### Manufacturing Cycle
```
BOM exists, Production Plan arrives

Step 1: Create Production Order
Production Planner → API POST /api/production/order
  Body: product_id, qty_plan, bom_version (optional: defaults to active)
→ Service: validateProduct, lockBOM (immutable for this order)
→ DB INSERT: production_orders (status='planned', bom_id=active_version)
→ Generate pick list (from BOM materials)
→ API returns: po_id, pick_list

Step 2: Issue Material (Start Cutting)
Warehouse Staff → API POST /api/production/issue-material
  Body: po_id, material_id, qty, unit_cost
→ Service: 
    - assertProductionInProgress(po_id)
    - assertPeriodOpen(today)
    - RawInventory.issue(po_id, material_id, qty) ← deduct raw
    - WIPInventory.receive(po_id, 'CUT', qty, cost) ← add to WIP-CUT
    - Journal: Dr WIP-CUT / Cr Raw Inventory
→ DB: INSERT inventory_raw_ledger (qty=-X, source_id=po_id)
       INSERT inventory_wip_ledger (operation='CUT', qty_in=+X, cost=X*unit_cost)
       INSERT finance_journal_entry + lines
→ All in single transaction (ACID)
→ API returns: issue_id, confirmed qty

Step 3: Move from CUT → SEW
Sewing Dept Lead → API POST /api/production/move-wip-stage
  Body: po_id, from_stage='CUT', to_stage='SEW', qty, labor_cost
→ Service:
    - WIPInventory.issue(po_id, 'CUT', qty) ← remove from CUT
    - WIPInventory.receive(po_id, 'SEW', qty, labor_cost) ← add to SEW with additional cost
    - Journal: Dr WIP-SEW / Cr WIP-CUT; Dr WIP-SEW / Cr Accrued Labor (if labor separate)
→ DB: INSERT ledger entries, journal entries
→ API returns: move_id

Step 4: Move from SEW → FINISH
Finishing Dept Lead → API POST /api/production/move-wip-stage
  Body: po_id, from_stage='SEW', to_stage='FIN', qty, overhead_cost
→ Service: (same pattern)
→ DB: INSERT ledger + journal
→ API returns: move_id

Step 5: Production Complete (WIP → FG)
Finishing Dept Lead → API POST /api/production/complete
  Body: po_id, output_qty_good, output_qty_scrap (or defect_qty)
→ Service:
    - Calculate unit_cost = total_wip_cost / output_qty_good
    - WIPInventory.issue(po_id, 'FIN', output_qty_good + scrap)
    - FGInventory.receive(po_id, product_variant_id, output_qty_good, unit_cost)
    - Loss accounting for scrap: Dr Loss / Cr WIP-FIN
    - Journal: Dr FG / Cr WIP-FIN; Dr Loss / Cr WIP-FIN (scrap)
    - Update status: 'in_progress' → 'completed'
→ DB: INSERT FG ledger, INSERT loss journal
→ API returns: po_id, output summary

Result: Detailed cost trail (Raw 500k → CUT → SEW 2m added → FIN 1.5m added → Total 4m → FG @ 40k/unit)
        WIP per-stage visible for control
        COGS ready for next sales transaction
```

#### Sales POS Cycle
```
Customer at register

Step 1: Scan Items
POS Operator → Barcode scan: SKU (size+warna)
→ API GET /api/inventory/sku/:sku_code
  Returns: product_name, current_stock, unit_price
→ Check stock (prevent oversell)
→ Add to cart

Step 2: Payment
Customer → Cash / E-wallet
→ POS Operator confirms total
→ Record payment method

Step 3: Checkout
POS Operator → API POST /api/sales/pos-invoice
  Body: items (sku, qty, price), payment_method, payment_amount
→ Service:
    - assertStockAvailable (for all items)
    - CREATE sales_order (channel='POS')
    - FOR each item:
        - FGInventory.issue(sku, qty) ← reduce FG
        - Journal: Dr COGS / Cr FG Inventory
    - Journal: Dr Cash / Cr Sales Revenue
    - Update POS invoice status: 'posted'
→ DB: All in single transaction
       INSERT sales_order (status='completed')
       INSERT FG ledger (qty=-X per item)
       INSERT journal entries (COGS + Sales + Cash)
→ API returns: invoice_id, invoice_pdf, receipt_text (for printer)

Step 4: Return (if needed)
Customer / POS Operator → API POST /api/sales/pos-return
  Body: invoice_id, items (sku, qty)
→ Service: Reverse COGS and Sales, add FG back
→ API returns: return_id

Result: Real-time stock updated
        COGS posted immediately (not end-of-day batch)
        Journal balanced (always)
        Audit trail: every sale traceable to invoice
```

#### Sales Distributor Cycle
```
Similar to POS, but with credit terms and multiple-step delivery

Step 1: Create Sales Order
Sales Manager → API POST /api/sales/order
  Body: customer_id, items, credit_term, notes
→ Service: validateCustomer, validateCreditLimit, reserveStock (optional)
→ DB INSERT: sales_orders (channel='distributor', status='draft')
→ API returns: order_id

Step 2: Approve & Send
Sales Manager → API PATCH /api/sales/order/:order_id/approve
→ DB UPDATE: status='approved'
→ API returns: approved

Step 3: Create Delivery Note
Warehouse → API POST /api/sales/delivery-note
  Body: order_id, items, dispatch_qty (can be partial)
→ Service: validateStock (don't oversell)
→ DB INSERT: delivery_notes (status='draft')
→ API returns: dn_id

Step 4: Confirm Delivery (at customer location)
Warehouse/Driver → API PATCH /api/sales/delivery-note/:dn_id/confirm
→ Service:
    - FOR each item:
        - FGInventory.issue(sku, qty)
        - Journal: Dr COGS / Cr FG
    - If DO fully received: auto-create Sales Invoice OR manual later (choose one)
→ DB: INSERT FG ledger, INSERT journal
→ API returns: confirmed

Step 5: Create Invoice (from DO or SO)
Finance → API POST /api/sales/invoice
  Body: order_id or dn_id, invoice_date, tax_treatment
→ Service: auto-calc revenue from items
→ DB INSERT: sales_invoice, INSERT journal (Dr AR / Cr Sales Revenue)
→ API returns: invoice_id, invoice_pdf

Step 6: Record Payment
Customer pays / Finance posts payment → API POST /api/finance/ar-payment
  Body: invoice_id, payment_amount, payment_method, payment_date
→ Service: apply to invoice
→ DB INSERT: journal (Dr Bank / Cr AR)
→ API returns: payment_id

Result: 1 Sales Order → 1+ Delivery Notes → 1 Invoice → Partial/Full Payments
        Credit term enforced
        COGS post at delivery (chosen methodology)
        AR aging tracked
```

#### Marketplace Cycle
```
Same inventory, different settlement logic

Step 1-4: Same as Sales Distributor (Order → DO → Invoice → COGS)
          But: channel='marketplace', settlement_batch_id

Step 5: Marketplace Settlement (Batch)
Marketplace Agent → API POST /api/sales/marketplace/settlement-batch
  Body: marketplace_name, batch_date, orders (list of order_ids)
→ Service:
    - SUM revenue for period
    - SUM fees (marketplace takes cut)
    - Calculate payout: total_revenue - fees
    - Create settlement journal:
        Dr Bank (payout amount)
        Dr Marketplace Fee Expense (fee amount)
        Cr Marketplace Clearing (total revenue equivalent)
→ DB: INSERT settlement_batch, INSERT journal (complicated but atomic)
→ API returns: settlement_id, settlement_summary

Result: All channels in 1 inventory (no oversell)
        All settlements reconciled to bank (cash matching)
        Fee impact visible per-marketplace
```

#### Finance Cycle
```
All transactions above auto-post journal

Daily Monitoring:
Finance Manager → API GET /api/finance/trial-balance?period=2025-01
  Returns: account balances (debit vs credit sum)
  Expected: always balanced

Period Closing (Month-End):
Finance Manager → API POST /api/finance/period/close
  Body: period_code='2025-01'
→ Service: Pre-close checks
    - Check WIP balance (must be 0)
    - Check all invoices posted
    - Check AP/AR reconciled
    - Run: SELECT SUM(debit) vs SUM(credit) from journals for period
    - IF checks fail: throw error, don't allow close
→ DB: UPDATE accounting_periods SET status='closed', closed_at=now(), closed_by=user_id
→ DB: Refresh all MVs with final data
→ DB: RLS prevents new transactions with closed period
→ API returns: close_summary, journal_link

Post-Close:
All transactions to 2025-01 now rejected (period closed)
If need to edit: must re-open with approval

Re-Open (if needed):
Finance Manager → API POST /api/finance/period/:period_code/reopen
→ Service: log audit entry
→ DB: UPDATE status='open'
→ API returns: reopen_id, audit_entry_id

Result: Clear monthly boundaries
        Financial statements snapshot locked per month
        No surprise backdates
        Audit trail complete
```

---

## DATA MODEL

### Entity Relationship Diagram (Simplified)

```
MASTER DATA
├─ products (PK: id)
│  └─ product_variants (PK: id, FK: product_id) [size, color] ← SKU
│
├─ materials (PK: id)
│
├─ customers (PK: id)
│  └─ customer_credit_terms (FK: customer_id) [Net 14/30/60]
│
└─ vendors (PK: id)

PURCHASING
├─ purchase_orders (PK: id, FK: vendor_id) [status: draft/approved/sent/closed]
│  └─ purchase_order_lines (PK: id, FK: po_id, material_id)
│
└─ goods_receipt_notes (PK: id, FK: po_id) [received_qty, unit_cost]

INVENTORY (LEDGERS - APPEND ONLY)
├─ inventory_raw_ledger (PK: id, FK: material_id, source_id)
│  [qty, unit_cost, source_type, period_code]
│
├─ inventory_wip_ledger (PK: id, FK: production_order_id)
│  [operation_code (CUT/SEW/FIN), qty_in, qty_out, cost_amount, period_code]
│
└─ inventory_fg_ledger (PK: id, FK: product_variant_id, source_id)
   [qty, unit_cost, source_type (production/sale/adjustment), period_code]

MANUFACTURING
├─ boms (PK: id, FK: product_id) [version, status: draft/active/retired, effective_from/to]
│  ├─ bom_materials (FK: bom_id, material_id) [qty_per_unit]
│  └─ bom_operations (FK: bom_id) [operation_code, sequence, standard_cost]
│
├─ production_orders (PK: id, FK: product_id, bom_id) [status, qty_plan, started_at, completed_at]
│
├─ production_costs_actual (FK: production_order_id) [material_cost, labor_cost, overhead_cost]
├─ production_costs_standard (FK: bom_id) [unit_standard_cost]
└─ cost_variances (FK: production_order_id) [variance_amount]

SALES
├─ sales_orders (PK: id, FK: customer_id) [channel: POS/DISTRIBUTOR/MARKETPLACE, status, credit_term]
│  └─ sales_order_lines (PK: id, FK: so_id, product_variant_id) [qty, unit_price]
│
├─ delivery_notes (PK: id, FK: sales_order_id) [status: draft/sent/received]
│  └─ delivery_note_lines (FK: dn_id, so_line_id) [dispatch_qty]
│
├─ sales_invoices (PK: id, FK: sales_order_id or dn_id) [invoice_date, amount, tax]
│  └─ sales_invoice_lines (FK: si_id, so_line_id) [qty, unit_price, line_amount]
│
├─ ar_invoices (PK: id, FK: sales_invoice_id) [amount, due_date, status: open/partial/paid]
│
├─ payments (PK: id, FK: ar_invoice_id) [amount, payment_date, payment_method]
│
└─ marketplace_settlements (PK: id) [marketplace_name, batch_date, fee, payout]

FINANCE
├─ finance_accounts (PK: id) [code, name, type: asset/liability/equity/income/expense]
│
├─ finance_journal_entries (PK: id, FK: period_code) [source_type, source_id, journal_date, is_posted, is_locked]
│  └─ finance_journal_lines (PK: id, FK: je_id, account_id) [debit, credit] ✓ CHECK debit XOR credit
│
├─ accounting_periods (PK: period_code) [status: open/closed, closed_at, closed_by]
│
└─ audit_log (PK: id) [table_name, row_id, operation (INSERT/UPDATE), old_value, new_value, changed_by, changed_at]

REPORTING (MATERIALIZED VIEWS)
├─ mv_inventory_raw_balance [material_id, period_code, qty, value]
├─ mv_inventory_wip_balance [po_id, operation_code, period_code, qty, value]
├─ mv_inventory_fg_balance [product_variant_id, period_code, qty, value]
├─ mv_cogs_per_sku_period [product_variant_id, period_code, qty_sold, cogs_amount]
├─ mv_revenue_per_sku_period [product_variant_id, period_code, revenue_amount]
├─ mv_margin_per_sku_period [product_variant_id, period_code, margin %, margin $]
├─ mv_inventory_fg_aging [product_variant_id, period_code, age_days, aging_bucket, qty, value]
├─ mv_inventory_slow_moving [product_variant_id, period_code, qty, value] (where age > 90)
├─ mv_inventory_turnover [product_variant_id, period_code, turnover_ratio, avg_inventory]
├─ mv_inventory_days_on_hand [product_variant_id, period_code, days_on_hand]
├─ mv_ar_aging [customer_id, period_code, age_bucket, amount]
└─ mv_ap_aging [vendor_id, period_code, age_bucket, amount]
```

### Key Design Principles

**1. Ledger-Based (Not Balance-Table)**
```
WRONG:
inventory SET balance = balance + 10  ← fragile, no history

CORRECT:
inventory_ledger INSERT (qty=10, unit_cost=X, source_id=...)
SELECT SUM(qty) → current balance (immutable history)
```

**2. Immutable Ledger + Reversal**
```
WRONG:
UPDATE inventory_ledger SET qty = qty - 5  ← breaks audit, allows backdating

CORRECT:
INSERT inventory_ledger (qty=-5, source_type='reversal', reversal_of=original_ledger_id)
Net effect: same, but 100% traceable
```

**3. Cost Snapshot at Transaction Time**
```
WRONG:
FG cost = reevaluate when reporting (FIFO/average changes)

CORRECT:
inventory_*_ledger.unit_cost = snapshot at time of transaction
immutable after posted
```

**4. Period-Based (Not Time-Based)**
```
WRONG:
journal_date = created_at (timezone dependent, can backdate)

CORRECT:
period_code = explicit 'YYYY-MM'
RLS: block insert if period closed
Cannot accidentally post to wrong month
```

**5. Source Traceability**
```
Every ledger entry has:
├─ source_type: 'purchase' | 'production' | 'sale' | 'adjustment'
├─ source_id: PO-123, DO-456, invoice-789
└─ occurred_at: timestamp

Result: "This FG came from production PO-123, which used raw from vendor-invoice-001"
```

**6. Double-Entry Enforced at Service Layer**
```
WRONG:
INSERT into inventory_raw
INSERT into journal (but fail) → data corruption

CORRECT:
BEGIN TRANSACTION
  INSERT inventory_raw
  INSERT journal_entry + journal_lines
  ASSERT SUM(debit) == SUM(credit)
COMMIT (all or nothing)
```

---

## MODULES & FEATURES

### M0: Foundation ✅

- [x] Database schema (complete DDL)
- [x] RLS policies (tenant isolation)
- [x] Auth setup (Supabase JWT)
- [x] Master data tables
- [x] First period setup
- [x] Audit trail infrastructure

### M1: Inventory Core ✅

- [x] Raw Material Ledger
- [x] WIP Ledger (per stage)
- [x] FG Ledger (per SKU)
- [x] Stock Balance MVs
- [x] Adjustment + Internal Move
- [x] Safety constraints (no negative stock, cost always ≥ 0)

### M2: Purchase & AP ✅

- [x] Purchase Order flow
- [x] GRN (Goods Receipt)
- [x] Vendor Invoice
- [x] AP aging
- [x] Auto journal posting

### M3: Manufacturing ✅ [CORE]

- [x] BOM (immutable + versioned)
- [x] Routing (operations)
- [x] Production Order
- [x] Issue Material (Raw → WIP)
- [x] WIP Stage Movement
- [x] Production Complete (WIP → FG)
- [x] Actual costing
- [x] Scrap/Loss accounting
- [x] Variance tracking (optional MVP)

### M4: Sales POS ✅

- [x] POS interface
- [x] Item scanning
- [x] Payment recording
- [x] Auto COGS posting
- [x] Return handling

### M5: Sales Distributor ✅

- [x] Sales Order
- [x] Delivery Note
- [x] Sales Invoice
- [x] AR aging
- [x] AR payment

### M6: Marketplace ✅

- [x] Order import
- [x] Fulfillment
- [x] Settlement batch
- [x] Fee tracking
- [x] Return/refund

### M7: Finance ✅

- [x] Chart of Accounts
- [x] Journal Entry (immutable)
- [x] Journal Reversal
- [x] Period Closing
- [x] Period Lock (RLS)
- [x] Trial Balance
- [x] Audit Trail

### M8: Reporting ✅

- [x] Inventory MVs (balance, aging, turnover, DOH)
- [x] COGS & Margin MVs
- [x] AR/AP Aging
- [x] Dashboard components
- [x] Snapshot locking

### M9: Testing & Go-Live ✅

- [x] Unit + Integration tests
- [x] Chaos testing
- [x] UAT scripts
- [x] Data migration (if needed)
- [x] Go-live runbook

---

## IMPLEMENTATION TIMELINE

### Phase 1: Design & Setup (Week 1)

| Task | Owner | Days | Dependency |
|------|-------|------|-----------|
| Requirements finalization | PM | 1 | - |
| Database schema design & review | DBA | 2 | - |
| API contract/Swagger | Backend Lead | 2 | Schema done |
| Tech stack finalization & setup | DevOps | 1 | - |
| GitHub repo setup, CI/CD pipeline | DevOps | 2 | - |
| Development environment setup (all) | Team | 0.5 | Repo ready |
| **CHECKPOINT: Schema approved, API contract signed** | All | | |

---

### Phase 2: Core Modules (Weeks 2-10)

#### M0-M1: Foundation + Inventory (Weeks 2-3)
```
Week 2:
├─ Backend: Schema DDL + RLS policies (Supabase)
├─ Backend: inventory.service.ts (receiveRaw, adjust, move)
├─ Frontend: Inventory form components
├─ QA: Database constraint tests
└─ Deploy: dev environment

Week 3:
├─ Backend: Materialized views + refresh logic
├─ Frontend: Inventory dashboard
├─ Backend: API endpoints (/api/inventory/*)
├─ QA: Integration tests (inventory flow)
└─ Deploy: staging

CHECKPOINT: Inventory ledger accurate, stock balance tested
```

#### M2: Purchase + AP (Week 4)
```
├─ Backend: Purchase service
├─ Backend: AP journal posting
├─ Frontend: PO, GRN, Vendor Invoice forms
├─ QA: AP aging tests
└─ CHECKPOINT: GRN + Invoice → Auto journal verified
```

#### M3: Manufacturing (Weeks 5-6) [CRITICAL]
```
Week 5:
├─ Backend: BOM service (immutable, versioning)
├─ Backend: Production Order service
├─ Backend: Issue Material service
├─ Frontend: BOM + Production Order forms
├─ QA: BOM immutability tests

Week 6:
├─ Backend: WIP stage movement service
├─ Backend: Production completion + costing
├─ Frontend: Material Issue, WIP Movement, Receipt forms
├─ QA: WIP ledger per-stage tests, costing accuracy
├─ CHAOS: BOM change mid-production (must fail)
└─ CHECKPOINT: Full production flow verified
```

#### M4-M6: Sales (Weeks 7-9)
```
Week 7 (POS):
├─ Backend: POS service, auto COGS posting
├─ Frontend: POS UI (barcode, cart, payment)
├─ QA: COGS posting tests
└─ CHECKPOINT: POS sale → auto journal verified

Week 8-9 (Distributor + Marketplace):
├─ Backend: Sales Order, Delivery, Invoice services
├─ Backend: AR aging, settlement batch
├─ Frontend: Order, DO, Invoice forms
├─ QA: Multi-channel inventory sync (no oversell)
└─ CHECKPOINT: Distributor order → Invoice, Marketplace order → Settlement
```

#### M7: Finance (Week 10)
```
├─ Backend: Period closing logic + validation
├─ Backend: Period lock RLS policy
├─ Frontend: Period close form, trial balance view
├─ QA: Backdate rejection tests, period lock tests
└─ CHECKPOINT: Period close blocks hanging WIP, locked against edit
```

#### M8: Reporting (Week 10, parallel with M7)
```
├─ Backend: All MV queries + refresh job
├─ Frontend: Dashboard (margin, aging, KPI)
├─ QA: MV integrity tests, snapshot consistency
└─ CHECKPOINT: Dashboard numbers match finance
```

---

### Phase 3: Testing & Go-Live (Weeks 11-13)

#### Week 11: Testing
```
├─ QA: Complete test suite review
├─ Chaos tests: automated suite (10+ scenarios)
├─ UAT prep: user scripts, test data
└─ CHECKPOINT: All tests pass, 0 critical bugs
```

#### Week 12: UAT + Migration
```
├─ UAT: user acceptance testing (3-5 days)
├─ Data migration (if from legacy system)
├─ Deployment dry-run
├─ Training materials finalized
└─ CHECKPOINT: User sign-off, data validated
```

#### Week 13: Go-Live
```
Day 1 (Mon): Deploy to staging, final smoke tests
Day 2 (Tue): Deploy to production (off-peak hours)
Day 3-7 (Wed-Sun): Support & monitoring
Week 2+: Issue triage, stabilization
```

---

### Gantt Chart (Simplified)

```
M0 Foundation       [████] (Week 1)
M1 Inventory       [██████] (Weeks 2-3)
M2 Purchase        [████] (Week 4)
M3 Manufacturing   [████████] (Weeks 5-6)
M4 POS             [████] (Week 7)
M5-M6 Sales        [██████] (Weeks 8-9)
M7 Finance         [████] (Week 10)
M8 Reporting       [████] (Week 10, parallel)
M9 Testing/GoLive  [██████████] (Weeks 11-13)
                   └─────────────┬──────────────┘
                           13 weeks (3 months)
```

---

## CRITICAL SUCCESS FACTORS

### 1. Data Integrity (Non-Negotiable)

```
✅ Schema enforcement (no app-level guards allowed)
├─ CHECK (qty > 0 OR qty < 0 but negative_allowed=true)
├─ CHECK (unit_cost >= 0)
├─ CHECK (debit > 0 AND credit = 0 OR debit = 0 AND credit > 0)
├─ UNIQUE (tenant_id, sku_code)
├─ FK constraints (referential integrity)
└─ NOT NULL on critical fields

✅ No data corruption path
├─ Inventory: always ledger + MV derived (never manual balance update)
├─ Journal: always double-entry, always balanced
├─ Period: once closed, no backdates
└─ BOM: immutable once used in production order

✅ Test-first enforcement
├─ Every negative test case must FAIL (data illegal rejected)
├─ Every positive test case must PASS (valid data accepted)
└─ Automated chaos test suite (network fail, double-click, concurrent access)
```

### 2. Traceability (Audit-Ready)

```
✅ Every transaction has source
├─ source_type: 'purchase' | 'production' | 'sale' | 'adjustment'
├─ source_id: PO-123, DO-456, invoice-789
├─ occurred_at: timestamp
└─ created_by: user_id, changed_by: user_id

✅ Immutable ledger + reversal (not deletion)
├─ INSERT only (no UPDATE/DELETE on ledger)
├─ Correction = reversal entry (preserves history)
└─ Audit log: every mutation logged

✅ Period boundary
├─ period_code: explicit (YYYY-MM), not date-derived
├─ RLS: period closed → INSERT rejected
├─ Re-open: logged, requires approval
└─ Snapshot: MV locked after close
```

### 3. COGS Accuracy (Trust Metric)

```
✅ Actual costing (MVP)
├─ WIP accumulates: material (from raw ledger) + labor (from payroll) + overhead (allocated)
├─ Unit cost = total WIP cost / good output qty
├─ Scrap: separate loss account
└─ Ledger: immutable snapshot at receipt

✅ Hybrid-ready (for scale)
├─ Operational pricing: standard cost (plan)
├─ Financial COGS: actual cost (reality)
└─ Variance: tracked, reported, closed at period end

✅ COGS posting discipline
├─ At sale/shipment: DR COGS / CR FG (from ledger unit_cost)
├─ Every FG issue = journal entry (no batch, no manual)
└─ COGS validation: SUM(COGS) = SUM(FG issued)
```

### 4. Period Control (Closure Mandate)

```
✅ Pre-close validation
├─ WIP balance = 0 (all production completed or scrapped)
├─ AR/AP reconciled (flag variances)
├─ Trial balance = 0 (debit sum = credit sum)
└─ Block close if any fail (user gets specific error)

✅ Post-close immutability
├─ RLS: period closed → INSERT/UPDATE rejected (no backdate)
├─ MV: snapshot locked, no refresh after close
├─ Edit: requires re-open (role-based approval)
└─ Log: all re-opens + edits audited

✅ Month boundary clarity
├─ All transactions tied to explicit period_code
├─ No date-based ambiguity (timezone issues)
└─ Snapshot per month (comparing months is clean)
```

### 5. Test Automation (Confidence Metric)

```
✅ Negative tests (MUST FAIL)
├─ Negative stock: rejected
├─ Unbalanced journal: rejected
├─ Backdate to closed period: rejected
├─ Edit immutable ledger: rejected
├─ Concurrent issue + sale: correct balance
└─ Network fail: rollback all

✅ Positive tests (MUST PASS)
├─ Legal data: accepted
├─ Journal balanced: accepted
├─ Period open: transactions allowed
└─ Concurrent different-SKU: both succeed

✅ Chaos tests (automated)
├─ Network interruption (mid-transaction)
├─ Double-click (idempotency)
├─ Concurrent transactions (no deadlock)
├─ Period close + hanging WIP (blocked)
└─ All must have assertions (not manual checks)
```

### 6. User Adoption (Operational Metric)

```
✅ Clear role separation
├─ Warehouse: inventory forms only
├─ Production: BOM + order forms only
├─ Sales: SO + Invoice forms (no finance access)
├─ Finance: period close + journal (no transaction creation)
└─ RLS: enforced per role (cannot see other's data)

✅ Simple workflows (no surprise complexity)
├─ POS: scan → pay → done (3 screens)
├─ Production: issue → move → complete (3 pages)
├─ Purchase: PO → GRN → Invoice (3 forms)
└─ Finance: close period (1 button + validation)

✅ Real-time feedback
├─ Stock alerts (red/yellow/green)
├─ WIP aging (days in each stage)
├─ AR aging (due soon)
└─ Dashboard (daily, no latency)

✅ Training materials
├─ Role-specific user guide
├─ Video walkthroughs
├─ Troubleshooting FAQ
└─ On-site support (week 1 post-live)
```

---

## RISK & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| **WIP hanging (not cleared at period close)** | High | Critical | MV auto-check, block close if wip_qty ≠ 0, daily monitoring |
| **BOM changed mid-production (COGS wrong)** | High | High | Schema: immutable BOM, FK lock to production order |
| **Negative stock slip through** | Medium | High | CHECK constraint + transaction-level validation |
| **Journal unbalanced (COGS ≠ FG issue)** | Medium | Critical | Auto-post service layer, atomic transaction, SUM check |
| **Period not locked (data edited after close)** | Medium | High | RLS policy + explicit period_code, no date-based edge |
| **Concurrent oversell (2 sales same stock)** | Low | High | Pessimistic lock (SELECT FOR UPDATE) or ACID isolation |
| **Cost variance unchecked (silent inflation)** | Medium | High | Variance tracking + monthly post to P&L |
| **Overhead not allocated (undercosting)** | High | Medium | Service layer: mandatory overhead allocation per WIP stage |
| **User error (accidental delete)** | Medium | High | Soft deletes + reversal + audit trail (not hard delete) |
| **Data migration (legacy system → new)** | Medium | High | Dry-run, data validation script, UAT on migrated data |
| **Performance degradation (dashboard slow)** | Low | Medium | MV snapshot + nightly refresh, no real-time query |
| **RLS misconfiguration (data leak)** | Low | Critical | Policy review, multi-tenant test, automated RLS audit |
| **Supabase outage (database offline)** | Low | Critical | Backup plan, failover script, daily backup test |

### Mitigation Details

#### Risk: WIP Hanging (Not Cleared)
**Symptoms:** Approaching month-end, WIP still in "SEW" stage (incomplete)  
**Consequence:** Cannot close period (balance doesn't match), delay closing

**Mitigation:**
```sql
-- Pre-close check (automated, blocks if fails)
SELECT production_order_id, operation_code, SUM(qty_in - qty_out) as balance
FROM inventory_wip_ledger
WHERE period_code = '2025-01'
GROUP BY production_order_id, operation_code
HAVING balance ≠ 0;

-- If any rows returned → throw error "WIP not cleared, cannot close"
-- Production manager must: complete order, scrap remainder, or reverse
```

---

#### Risk: BOM Changed Mid-Production
**Symptoms:** BOM v1 → 100 kain, user changes to 105 kain, old production gets wrong cost

**Mitigation:**
```sql
-- Schema: IMMUTABLE BOM (no UPDATE allowed)
CREATE TRIGGER bom_immutable BEFORE UPDATE ON boms
FOR EACH ROW EXECUTE FUNCTION deny_update_if_used();

-- Production Order LOCKS BOM version at creation
CREATE TABLE production_orders (
  ...
  bom_id UUID NOT NULL REFERENCES boms(id),
  -- bom_id is immutable (no UPDATE allowed)
  ...
);

-- If BOM needs change → only option is: create new version (v2), 
-- new production orders use v2, old orders keep v1
```

---

#### Risk: Negative Stock
**Symptoms:** FG ledger shows qty = -5 (impossible)

**Mitigation:**
```sql
-- Schema: CHECK constraint (database-level)
ALTER TABLE inventory_fg_ledger ADD CHECK (qty > 0 OR qty < 0 AND source_type = 'adjustment');

-- Service layer: pessimistic lock (prevent concurrent oversell)
BEGIN TRANSACTION (ISOLATION LEVEL SERIALIZABLE);
  SELECT balance_qty FROM mv_inventory_fg_balance 
  WHERE product_variant_id = ? FOR UPDATE; ← Lock row
  
  IF balance_qty < requested_qty THEN
    ROLLBACK; THROW "Insufficient stock"
  END IF;
  
  INSERT inventory_fg_ledger (qty = -requested_qty, ...);
COMMIT;

-- Result: 2 concurrent sales race, loser gets rejected before DB touch
```

---

#### Risk: Journal Unbalanced
**Symptoms:** Debit = 5m, Credit = 4.9m (1% difference, silently wrong)

**Mitigation:**
```typescript
// Service layer: atomic transaction with assertion
async function postSalesJournal(saleId, ctx) {
  return withTransaction(async (tx) => {
    // Step 1: Post inventory + calculate COGS
    const cogs = await FGInventory.issueAndGetCost(tx, saleId);
    
    // Step 2: Create journal entries
    const journalId = await Finance.createJournal(tx, {
      lines: [
        { account: 'Sales Revenue', credit: totalAmount },
        { account: 'COGS', debit: cogs },
        { account: 'Cash', debit: totalAmount }
      ]
    });
    
    // Step 3: Validate balance
    const je = await tx.query('SELECT * FROM finance_journal_entries WHERE id = ?', journalId);
    const sumDebit = je.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const sumCredit = je.lines.reduce((s, l) => s + (l.credit || 0), 0);
    
    if (sumDebit !== sumCredit) {
      throw new Error(`Journal unbalanced: debit ${sumDebit} ≠ credit ${sumCredit}`);
    }
    
    // Step 4: If validation passes, all changes commit together
    // If fails, entire transaction rolls back (zero ledger or journal entries)
  });
}
```

---

#### Risk: Period Not Locked
**Symptoms:** Finance closes period, then someone backdates entry to closed month

**Mitigation:**
```sql
-- RLS Policy (database-level enforcement)
CREATE POLICY period_lock_policy ON finance_journal_entries
FOR INSERT USING (
  NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE period_code = NEW.period_code AND status = 'closed'
  )
);

-- Service layer: double-check (defense in depth)
async function assertPeriodOpen(periodCode, ctx) {
  const period = await tx.query('SELECT status FROM accounting_periods WHERE period_code = ?', periodCode);
  if (period.status === 'closed') {
    throw new DomainError('PERIOD_CLOSED', `Cannot post to closed period ${periodCode}`);
  }
}

-- Result: 3 layers of defense
-- 1. Schema: period_code explicit (not inferred from date)
-- 2. RLS: closed period blocks INSERT
-- 3. Service: assertPeriodOpen() throws before touching DB
```

---

#### Risk: Overhead Not Allocated
**Symptoms:** WIP cost = material only, overhead ignored, undercosting

**Mitigation:**
```typescript
// Service layer: MANDATORY overhead allocation
async function moveWipStage(input: MoveWipInput, ctx) {
  assertPeriodOpen(input.occurredAt, ctx);
  
  // CRITICAL: labor + overhead must be provided or calculated
  if (!input.laborCost && !input.laborRate) {
    throw new DomainError('LABOR_COST_REQUIRED', 'Labor cost must be input or auto-calculated');
  }
  
  if (!input.overheadCost && !input.overheadRate) {
    throw new DomainError('OVERHEAD_COST_REQUIRED', 'Overhead cost must be input or auto-calculated');
  }
  
  const laborCost = input.laborCost || (input.qty * input.laborRate);
  const overheadCost = input.overheadCost || (input.qty * input.overheadRate);
  
  if (laborCost <= 0) throw new Error('Labor cost must be > 0');
  if (overheadCost < 0) throw new Error('Overhead cost must be ≥ 0');
  
  // Ledger entry includes both
  await WIPLedger.moveStage(tx, {
    fromStage: input.fromStage,
    toStage: input.toStage,
    qty: input.qty,
    cost: laborCost + overheadCost
  });
  
  // Journal: Dr WIP-SEW, Cr Accrued Labor + Overhead
  // ...
}
```

---

## TEAM & RESOURCES

### Team Composition

| Role | FTE | Responsibilities | Skills |
|------|-----|-----------------|--------|
| **Product Manager** | 1 | Scope management, stakeholder comms, prioritization | Project mgmt, ERP domain |
| **Database Architect/DBA** | 1 | Schema design, RLS, migrations, backups, performance | PostgreSQL, RLS, audit |
| **Backend Engineer Lead** | 1 | Service layer, API design, transaction control, costing | Node.js, DB transactions, finance domain |
| **Backend Engineer** | 1 | Purchase, Manufacturing, Finance modules | Same |
| **Frontend Engineer** | 1 | React/Vite, forms, dashboard | React, TypeScript, UX |
| **QA Engineer** | 1 | Test automation, chaos testing, UAT | Jest, SQL, scripting |
| **DevOps/Infrastructure** | 0.5 | CI/CD, deployment, monitoring | GitHub Actions, hosting |
| **Client Liaison** (internal to Ziyada) | 1 | Requirements, UAT, training | Konveksi operations, finance |

**Total:** 4.5-5 FTE for 13 weeks (MVP)

### Key Skills Required

| Skill | Essential | Nice-to-Have |
|-------|-----------|--------------|
| **Database** | PostgreSQL, RLS, transactions, triggers | JSON, window functions, materialized views |
| **Backend** | Node.js, TypeScript, REST API, ACID transactions | GraphQL, service layer patterns, event sourcing |
| **Frontend** | React, Vite, forms, API integration | Dashboard design, offline support, PWA |
| **Finance/ERP** | Double-entry accounting, period closing, COGS | Manufacturing costing, tax compliance |
| **Testing** | Jest, integration tests, test-first mindset | Chaos testing, performance testing |
| **DevOps** | GitHub Actions, simple deployment, monitoring | Docker, kubernetes (not needed for MVP) |

### Onboarding & Training

**Week 0 (Before Day 1):**
- [ ] GitHub repo access
- [ ] Supabase project setup
- [ ] Read "Ziyada_ERP_Project_Scope.md" (this doc)
- [ ] Review schema docs + data model

**Week 1:**
- [ ] Architecture review meeting (1 day)
- [ ] Pair programming: setup local dev (1 day)
- [ ] Schema walkthrough + RLS deep-dive (1 day)
- [ ] Service layer patterns (1 day)
- [ ] Build first feature together (POS hello-world) (2 days)

**Ongoing:**
- Daily standup (15 min)
- Weekly architecture sync (1 hour)
- Code review (every PR)

---

## DELIVERABLES

### Code Deliverables

```
.
├── backend/
│   ├── src/
│   │   ├── schema/
│   │   │   ├── M0_foundation.sql
│   │   │   ├── M1_inventory.sql
│   │   │   ├── M2_purchase.sql
│   │   │   ├── M3_manufacturing.sql
│   │   │   ├── M4_sales_pos.sql
│   │   │   ├── M5_sales_distributor.sql
│   │   │   ├── M6_marketplace.sql
│   │   │   ├── M7_finance.sql
│   │   │   ├── M8_reporting_mv.sql
│   │   │   └── rls_policies.sql
│   │   ├── migrations/
│   │   │   ├── 001_foundation.ts
│   │   │   ├── 002_inventory.ts
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── inventory.service.ts
│   │   │   ├── production.service.ts
│   │   │   ├── sales.service.ts
│   │   │   ├── finance.service.ts
│   │   │   └── reporting.service.ts
│   │   ├── repositories/
│   │   │   ├── inventory.repo.ts
│   │   │   ├── production.repo.ts
│   │   │   └── ...
│   │   ├── api/
│   │   │   ├── inventory.routes.ts
│   │   │   ├── production.routes.ts
│   │   │   ├── sales.routes.ts
│   │   │   └── finance.routes.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── tenant.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── types/
│   │   │   ├── inventory.types.ts
│   │   │   ├── production.types.ts
│   │   │   └── ...
│   │   └── main.ts (Express app)
│   ├── tests/
│   │   ├── M1_inventory.test.ts
│   │   ├── M3_manufacturing.test.ts
│   │   ├── M7_finance.test.ts
│   │   └── chaos/
│   │       ├── wip_hanging.test.ts
│   │       ├── backdate_period.test.ts
│   │       └── concurrent_oversell.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Inventory/
│   │   │   │   ├── ReceiveRaw.tsx
│   │   │   │   ├── AdjustStock.tsx
│   │   │   │   └── InventoryBalance.tsx
│   │   │   ├── Production/
│   │   │   │   ├── BOMForm.tsx
│   │   │   │   ├── ProductionOrder.tsx
│   │   │   │   ├── MaterialIssue.tsx
│   │   │   │   └── Receipt.tsx
│   │   │   ├── Sales/
│   │   │   │   ├── POSInterface.tsx
│   │   │   │   ├── SalesOrder.tsx
│   │   │   │   └── Invoice.tsx
│   │   │   ├── Finance/
│   │   │   │   ├── PeriodClosing.tsx
│   │   │   │   └── TrialBalance.tsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── OperationsDashboard.tsx
│   │   │   │   ├── FinanceDashboard.tsx
│   │   │   │   └── ExecutiveDashboard.tsx
│   │   │   └── Common/
│   │   │       ├── Layout.tsx
│   │   │       ├── Navigation.tsx
│   │   │       └── ErrorBoundary.tsx
│   │   ├── hooks/
│   │   │   ├── useInventory.ts
│   │   │   ├── useProduction.ts
│   │   │   ├── useSales.ts
│   │   │   └── useApi.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── inventory.api.ts
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── Production.tsx
│   │   │   ├── Sales.tsx
│   │   │   └── Finance.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/
│   │   ├── components/POSInterface.test.tsx
│   │   └── hooks/useInventory.test.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── tailwind.config.js
│
├── docs/
│   ├── M0_FOUNDATION.md
│   ├── M1_INVENTORY.md
│   ├── M2_PURCHASE.md
│   ├── M3_MANUFACTURING.md
│   ├── M4_POS.md
│   ├── M5_DISTRIBUTOR.md
│   ├── M6_MARKETPLACE.md
│   ├── M7_FINANCE.md
│   ├── M8_REPORTING.md
│   ├── ARCHITECTURE.md
│   ├── TESTING_STRATEGY.md
│   ├── SECURITY_RLS.md
│   ├── GO_LIVE_CHECKLIST.md
│   ├── GO_LIVE_RUNBOOK.md
│   ├── TROUBLESHOOTING.md
│   ├── SUPPORT_PROCEDURES.md
│   └── API_SWAGGER.yaml
│
├── .github/
│   └── workflows/
│       ├── ci.yml (Run tests on PR)
│       ├── deploy-staging.yml (Deploy to staging on main)
│       └── deploy-production.yml (Manual prod deploy)
│
└── README.md (Project overview)
```

---

### Documentation Deliverables

1. **Project Scope** (this document)
2. **Architecture & Design Document** (C4 model, data flow diagrams, sequence diagrams)
3. **API Documentation** (Swagger/OpenAPI spec)
4. **Database Schema & RLS** (complete DDL + policy explanation)
5. **Service Layer Contract** (function signatures, error codes)
6. **Testing Strategy & Automation** (test pyramid, chaos scenarios)
7. **Go-Live Checklist** (pre-go-live validation steps)
8. **Go-Live Runbook** (step-by-step deployment procedure)
9. **User Guide** (per role: Warehouse, Production, Sales, Finance)
10. **Troubleshooting & FAQ**
11. **Monitoring & Support Procedures**

---

### Training Deliverables

1. **Role-Based User Guides** (PDF, markdown)
2. **Video Walkthroughs** (POS, Production, Period Closing)
3. **Troubleshooting Flowchart** (for common issues)
4. **Cheat Sheets** (keyboard shortcuts, error codes)
5. **On-Site Training Sessions** (Week 1 post-go-live)

---

## SUMMARY TABLE

| Aspect | Detail |
|--------|--------|
| **Project Name** | Ziyada ERP v1.0 |
| **Client** | Ziyada Sport (Bobing Shop) |
| **Scope** | Single warehouse, multi-channel sales (POS, Distributor, Marketplace), manufacturing |
| **Timeline** | 13 weeks (3+ months) |
| **Team Size** | 4-5 FTE |
| **Technology** | PostgreSQL + Supabase, Node.js, React/Vite, TypeScript |
| **Key Features** | Inventory (ledger-based), Manufacturing (BOM + WIP per-stage), Sales (3 channels), Finance (double-entry + period closing) |
| **Success Metrics** | 100% inventory sync, 0 oversells, COGS variance < 2%, period close ≤ 1 day, 100% audit trail |
| **Phase 2** | Multi-warehouse, advanced analytics, payment gateway integration |

---

## DOCUMENT INFORMATION

| Field | Value |
|-------|-------|
| **Document** | Ziyada_ERP_Project_Scope.md |
| **Version** | 1.0 |
| **Last Updated** | 27 December 2025 |
| **Status** | DRAFT (awaiting stakeholder approval) |
| **Approved By** | [To be filled] |
| **Next Review** | Week 1 post-project-kickoff |

---

## APPENDIX

### A. Glossary

| Term | Definition |
|------|-----------|
| **BOM** | Bill of Materials; specification of raw materials and operations for a product |
| **WIP** | Work in Progress; inventory in intermediate stages of production (CUT, SEW, FINISH) |
| **FG** | Finished Goods; completed products ready for sale |
| **COGS** | Cost of Goods Sold; expense recognized when goods are sold |
| **SKU** | Stock Keeping Unit; unique product variant (product + size + color) |
| **AR** | Accounts Receivable; money owed by customers |
| **AP** | Accounts Payable; money owed to suppliers |
| **RLS** | Row-Level Security; PostgreSQL feature to isolate tenant data |
| **MV** | Materialized View; snapshot of query result, refreshed periodically |
| **OLTP** | Online Transaction Processing; operational database (inventory, orders) |
| **OLAP** | Online Analytical Processing; reporting/analytics (dashboards, reports) |
| **Period** | Accounting period (month), used for closing and reporting boundaries |

---

### B. References

1. Ziyada ERP Design Documents (24 PDFs)
   - Schema, Flow, Costing, Bug patterns, Testing
   - GO-LIVE_CHECKLIST, Test_Case_Enforcement
2. PostgreSQL Documentation (constraints, RLS, triggers)
3. Industry Standards (IAS 2 - Inventory, double-entry accounting)
4. This Scope Document

---

**END OF DOCUMENT**

---

**Next Steps:**
1. [ ] Stakeholder review & approval
2. [ ] Team kickoff meeting
3. [ ] Environment setup (GitHub, Supabase, local dev)
4. [ ] Begin Phase 1: Design & Setup (Week 1)

**Contact:** [Project Manager Email] | **Repository:** [GitHub URL]