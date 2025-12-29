# Database Schema Documentation

## Overview
This document serves as the authoritative reference for the Ziyada ERP database schema, derived from the SQL migration files.

## 1. Foundation & Companies
**Source:** `001_foundation_companies.sql`

### `companies`
Root tenant table.
- `id` (UUID, PK)
- `code` (VARCHAR, Unique)
- `name` (VARCHAR)
- `fiscal_year_start_month` (INT)
- `base_currency` (VARCHAR)
- `is_active` (BOOL)
- `settings` (JSONB): Module configuration (Added in `031`).

### `user_company_mapping`
Maps users to companies.
- `user_id` (UUID, FK -> auth.users)
- `company_id` (UUID, FK -> companies)
- `role` (VARCHAR)

## 2. Master Data: Products & Attributes
**Source:** `006_master_data_products.sql`, `048_product_categories.sql`

### `products` (Style Level)
- `id` (UUID, PK)
- `code`, `name`, `category`
- `unit_of_measure` (ENUM), `status` (ENUM)
- `selling_price`, `standard_cost`

### `product_variants` (SKU Level)
- `id` (UUID, PK)
- `product_id` (UUID, FK)
- `size_id` (UUID, FK), `color_id` (UUID, FK)
- `sku` (VARCHAR, Unique)
- `price`, `cost`

## 3. Master Data: Materials
**Source:** `007_master_data_materials.sql`

### `materials`
- `id` (UUID, PK)
- `category_id` (UUID, FK)
- `code`, `name`
- `standard_cost`, `unit_of_measure`

## 4. Master Data: Partners
**Source:** `008_master_data_vendors_customers.sql`, `026_credit_management_polish.sql`

### `vendors`
- `id` (UUID, PK)
- `code`, `name`, `payment_terms`

### `customers`
- `id` (UUID, PK)
- `code`, `name`
- `customer_type`, `credit_limit`
- `credit_hold` (BOOL)

### `customer_credit_hold_history`
- `customer_id`, `action`, `reason`

## 5. Finance Foundation & GL
**Source:** `002`, `003`, `028` (Journals), `029` (Reporting), `045` (Mappings)

### `chart_of_accounts`
- `id` (UUID, PK)
- `account_code`, `account_name`
- `account_type`, `normal_balance`

### `journals` & `journal_lines`
General Ledger entries. *Immutable by trigger `040`.*
- `journal_number`, `journal_date`
- `reference_type`, `reference_id`
- `account_id`, `debit`, `credit`

### `system_account_mappings`
Dynamic links between system functions and COA.
- `mapping_code` (e.g., 'DEFAULT_CASH', 'SALES_POS')
- `account_id` (FK -> chart_of_accounts)

### `accounting_periods` & `period_closing_logs`
Financial period management.

## 6. Inventory System
**Source:** `009` (Raw), `010` (WIP), `011` (FG), `012` (Adjustments)

### `raw_material_ledger`
Transactional ledger for materials. *Immutable (`040`), Period Locked (`041`).*

### `wip_ledger`
Transactional ledger for WIP. *Immutable (`040`), Period Locked (`041`).*

### `finished_goods_ledger`
Transactional ledger for finished goods. *Immutable (`040`), Period Locked (`041`).*

### `inventory_adjustments` & `stock_opname`
Headers for stock corrections and physical counts.

## 7. Purchasing Cycle
**Source:** `013` (PO), `014` (GRN), `015` (Invoices), `016` (Payments)

### `purchase_orders`
- `po_number`, `vendor_id`, `status`

### `goods_receipt_notes`
- `grn_number`, `po_id`, `status`

### `vendor_invoices`
- `invoice_number`, `po_id`, `amount_outstanding`

### `vendor_payments`
- `payment_number`, `amount_received`

## 8. Manufacturing
**Source:** `017` (BOM), `018` (Prod Orders), `019` (Work Orders)

### `bom_headers` & `bom_lines`
Product recipes.

### `production_orders`
- `po_number`, `product_id`, `bom_id`
- `status` (planned, released, in_progress, completed)

### `work_orders`
Shop floor tasks.

## 9. Sales Cycle (B2B & POS)
**Source:** `020` (POS), `021` (Returns), `022` (SO), `023` (DO), `024` (Invoice), `025` (AR)

### `sales_pos` & `sales_pos_returns`
Cash/Counter transaction headers.

### `sales_orders`
- `so_number`, `customer_id`
- `total_amount`, `status`

### `delivery_notes`
- `do_number`, `so_id`
- `status`

### `sales_invoices`
- `invoice_number`, `amount_due`, `payment_status`

### `ar_payments` & `ar_payment_allocations`
Customer payments and invoice matching.

## 10. Marketplace Integration
**Source:** `027_marketplace_integration.sql`

### `marketplace_accounts`
- `platform`, `shop_id`

### `marketplace_orders`
- `external_order_id`, `mapped_status`
- `so_id` (Link to internal SO)

### `marketplace_settlements`
- `settlement_ref`, `amount_net`

## 11. Analytics (Materialized Views)
**Source:** `030_analytics_mvs.sql`

- `mv_inventory_valuation`
- `mv_sales_performance`
- `mv_financial_summary`

## 12. Security & Constraints
**Source:** `040` - `043`

| Constraint | Description | Target Tables |
| :--- | :--- | :--- |
| **Immutability** | Prevents UPDATE/DELETE on posted records | Ledgers, Journals |
| **Period Lock** | Block transactions in closed periods | Ledgers, Journals |
| **Negative Stock** | Prevent issuance if stock < 0 | Ledgers |
| **Balanced Journal** | Ensure Debit = Credit | Journal Lines |
