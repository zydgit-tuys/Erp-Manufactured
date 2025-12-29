# 📘 Fashion Forge ERP - User Guide

Welcome to Fashion Forge ERP! This guide will help you set up your system and understand the daily workflows for running your business efficiently.

---

## 🚀 Part 1: Initial Setup (One-Time)

Before you start trading, you need to configure the core settings of your company.

### 1. Company Profile
*   **Navigate to:** `Settings` (Sidebar bottom)
*   **Action:**
    *   Verify your **Company Name** and **Code**.
    *   Toggle the **System Modules** you need (e.g., enable Manufacturing if you produce items).
    *   **Security:** Use the "Change Password" button to set your secure access.

### 2. Financial Setup (Chart of Accounts)
*   **Navigate to:** `Finance` > `Chart of Accounts`
*   **Action:**
    *   The system comes with a standard manufacturing Chart of Accounts (COA).
    *   Review the accounts. You are ready to go immediately, but you can add custom accounts here if needed.

### 3. Master Data (The Foundation)
You must define what you buy and sell before doing transactions.

*   **Vendors:** Go to `Vendors` > Add your suppliers (Fabric suppliers, logistics, etc.).
*   **Customers:** Go to `Customers` > Add your wholesale/retail clients.
*   **Materials:** Go to `Materials` > Define raw materials (e.g., Cotton Fabric, Buttons, Zippers).
    *   *Tip: Ensure you define the correct Unit of Measure (UOM).*
*   **Products:** Go to `Products` > Define finished goods (e.g., T-Shirt Basic, Jeans).
    *   *Tip: Set the "Sales Price" here.*

---

## 📅 Part 2: Daily Operations (Workflows)

Here is the typical flow of data through the system.

### A. Procurement (Buying Materials)
**Flow:** `Purchase Order` -> `Receive Goods` -> `Vendor Bill`

1.  **Create PO:** Go to `Purchasing` > `Purchase Orders` > `New Order`. Select Vendor and Materials.
2.  **Approve:** A manager must "Approve" the PO.
3.  **Receive Goods:** When items arrive, go to `Purchasing` > `Receipts` (or click "Receive" on the PO).
    *   *Effect:* Inventory count increases.

### B. Manufacturing (Making Products)
**Flow:** `BOM` -> `Work Order` -> `Production`

1.  **Define BOM (One-time):** Go to `Products` > Select Product > `Bill of Materials`.
    *   Define what materials are needed to make 1 unit (e.g., 1.5m Fabric + 5 Buttons).
2.  **Plan Production:** Go to `Production` > `Work Orders` > `New Work Order`.
    *   Select Product and Quantity to produce.
3.  **Execute:** Release the Work Order.
    *   *Effect:* Raw Materials are consumed (inventory decreases).
    *   *Effect:* Finished Goods are produced (inventory increases).

### C. Sales (Selling Products)
We support two types of sales:

#### 1. Wholesale / B2B (Sales Orders)
**Flow:** `Sales Order` -> `Shipment` -> `Invoice`

1.  **Create SO:** Go to `Sales` > `Sales Orders` > `New Order`. Select Customer and Products.
2.  **Approve:** Authorize the sale.
3.  **Ship:** Go to `Sales` > `Shipments`. Send items to the customer.
    *   *Effect:* Finished Goods inventory decreases.

#### 2. Retail / POS (Direct Store Sales)
**Flow:** `POS` -> `Checkout`

1.  **Open POS:** Go to `Sales` > `POS`.
2.  **Sell:** Click products to add to cart -> `Checkout`.
3.  **Payment:** Select Cash/Card/QRIS -> `Confirm`.
    *   *Effect:* Inventory decreases immediately, Revenue is recorded.

---

## 📊 Part 3: Inventory & Management

### Inventory Control
*   **Check Stock:** Go to `Inventory` > `Raw Materials` or `Finished Goods` to see current levels.
*   **Adjustments:** If stock is damaged or missing, use `Inventory` > `Adjustments` to correct the count.

---

## ❓ Tips for Success

*   **Workflow Order:** Always Buy Materials -> Make Products -> Sell Products. You cannot sell what you don't have!
*   **Status Indicators:** Watch for simple status badges (e.g., `Draft`, `Approved`, `Completed`) to know where a document is in the flow.
*   **Navigation:** Use the Sidebar to quickly jump between modules.

*Need help? Contact support.*
