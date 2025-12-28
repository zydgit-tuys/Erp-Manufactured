🎯 TUJUAN PROJECT: Ziyada ERP

📌 TUJUAN UTAMA
Vision Statement:
"Single source of truth untuk inventory, manufacturing, dan finance yang memungkinkan Ziyada Sport membuat keputusan pricing real-time, mendeteksi anomali cost, dan scale operations tanpa manual intervention."

🏢 PROFIL BISNIS
Client: Ziyada Sport
Industri: Konveksi & Fashion Retail E-commerce
Model Bisnis: Multi-channel retail
- POS (Point of Sale)
- Distributor
- Marketplace (Shopee, Tokopedia, dll)

Skala Saat Ini:
- Single warehouse
- 100+ SKU (size + warna variants)
- Target: Scalable untuk 5+ tahun

🎯 BUSINESS OUTCOMES (Yang Ingin Dicapai)
1. Prevent Overselling
- Tidak boleh jual barang yang stocknya habis
- Inventory harus 100% akurat across all channels

2. Accurate COGS (Cost of Goods Sold)
- Tahu berapa cost sebenarnya per produk
- Auto-calculate dari raw material → WIP → finished goods

3. Margin per SKU
- Tahu profit margin per produk
- Bisa pricing decision yang tepat

4. Fast Period Closing
- Tutup buku bulanan dengan cepat
- Financial reports reliable

5. Audit-Ready
- Semua transaksi traceable
- Immutable ledger
- Compliance dengan accounting

6. Scalable
- Bisa grow ke multi-warehouse
- Bisa handle volume lebih besar

📦 SCOPE MVP (In-Scope)
## Modules yang Harus Ada:

M0: Foundation
- Master data (products, materials, vendors, customers)
- Chart of Accounts
- Accounting periods

M1: Inventory
- Raw material ledger
- WIP (Work in Progress) ledger
- Finished goods ledger
- Adjustments & transfers

M2: Purchasing
- Purchase orders
- Goods receipt notes
- Vendor invoices
- Vendor payments

M3: Manufacturing
- Bill of Materials (BOM)
- Production orders
- Work orders (3 stages: Cutting, Sewing, Finishing)

M4: Sales - POS
- Point of sale transactions
- Cash/card payments

M5: Sales - Distributor
- Sales orders
- Delivery orders
- Invoices
- Payments

M6: Finance
- Auto journal posting
- Period closing
- Financial reports

M7: Marketplace Integration
- Shopee/Tiktok : Sync Stock dengan fitur Import Export
- Stock Marketplace Flow : Inventory Export > Import ke Shopee/Tiktok = Sync Stock
- Order Marketplace Flow : Order Export dari Shopee/Tiktok > Import ke Apps ini = Auto Update Order Input
- Payment Marketplace Flow : Data Saldo Masuk dari Shopee/Tiktok > Import ke Apps ini = Auto Update Rekonsiliasi dengan Order Marketplace Flow

⚙️ TECHNICAL ENABLERS (Cara Mencapainya)
1. Single Inventory Ledger
- Semua movement tercatat
- Real-time balance

2. Auto Journal Posting
- Setiap transaksi → auto create journal entries
- Double-entry accounting

3. Period-Based Materialized Views
- Fast reporting
- Historical snapshots

4.Immutable Ledger
- Ledger tidak bisa di-edit/delete
- Adjustment via new entries

5. Source Traceability
- Setiap entry tahu dari mana asalnya
- Audit trail lengkap

6. Tenant-Based RLS?
- Ini sebenarnya tidak termasuk MVP
- Data isolation tidak perlu di MVP

🚫 OUT OF SCOPE (Tidak Termasuk MVP)
❌ Multi-warehouse (Phase 2)
❌ Advanced demand planning
❌ Payroll/HR module
❌ Complex shipping integration
❌ Consignment management
❌ Real-time multi-tenant dashboard

📊 KEY DELIVERABLES
1. Database Schema (Supabase)
- Complete DDL
- Migrations
- RLS policies
- Triggers & functions
2. Backend Service Layer
- Business logic
- Orchestration
- Validation
3. Frontend (React/Vite)
- Forms untuk input
- Dashboards untuk reporting
- Pure presentation layer
4. Test Suite
- Unit tests
- Integration tests
- Chaos tests
5. Go-Live Checklist
- Deployment runbook
- Data migration plan

⏱️ TIMELINE & RESOURCES
Estimated Timeline: 1 weeks
Team : You And Me Only

MVP Release: Single warehouse, core modules (M0-M7)
Phase 2: advanced analytics, Multi-warehouse dll (Sekarang Tidak Perlu)

✅ CRITICAL SUCCESS FACTORS
1. Data Integrity
- No negative stock
- Balanced journals
- Immutable ledger

2. Accuracy
- COGS calculation correct
- Inventory balance accurate
- Financial reports reliable

3. Performance
- Fast period closing
- Real-time inventory updates
- Quick reporting

4. Scalability
- Handle growth
- Multi-warehouse ready
- Multi-company capable

5. Audit Compliance
- Complete audit trail
- Period lock enforcement
- Source traceability

🎯 KESIMPULAN TUJUAN PROJECT
Intinya:
Build production-grade ERP system untuk Ziyada Sport yang mengintegrasikan purchase → manufacturing → sales dalam satu sistem yang audit-ready, dengan 100% inventory accuracy, automated double-entry accounting, dan reliable COGS/margin reporting.

Fokus Utama:
1. Inventory accuracy - Prevent overselling
2. Cost tracking - Accurate COGS
3. Financial control - Period closing & audit trail
4. Multi-channel - POS + Distributor + Marketplace
5. Scalability - Ready untuk growth