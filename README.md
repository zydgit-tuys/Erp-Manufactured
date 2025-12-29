# Fashion Forge ERP

**Enterprise Resource Planning System for Fashion Manufacturing**

A modern, full-featured ERP system built specifically for fashion manufacturing businesses. Features complete inventory management, production planning, sales & purchasing, and **automatic double-entry accounting**.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)

---

## ✨ Key Features

### 🏭 Manufacturing & Production
- **Bill of Materials (BOM)** - Multi-level BOM with component tracking
- **Production Orders** - Work order management with stage tracking
- **Work-in-Progress (WIP)** - Real-time WIP inventory tracking
- **Material Requirements Planning** - Automated material planning

### 📦 Inventory Management
- **Multi-warehouse** - Unlimited warehouses with bin locations
- **Real-time Stock Tracking** - FIFO costing with automatic valuation
- **Stock Adjustments** - Physical count adjustments with variance tracking
- **Inventory Transfers** - Inter-warehouse transfers

### 💰 **Auto Journaling System** (NEW!)
- **Automatic Journal Entries** - Every transaction creates proper double-entry accounting
- **Real-time Financial Visibility** - Instant P&L and Balance Sheet
- **Complete Audit Trail** - 7-year immutable audit trail
- **Zero Manual Accounting** - 80% reduction in accounting workload

### 📊 Sales & Distribution
- **Sales Orders** - Complete order-to-cash cycle
- **Point of Sale (POS)** - Retail sales with returns
- **Delivery Notes** - Shipment tracking
- **Sales Invoicing** - Automated invoicing with payment tracking

### 🛒 Purchasing
- **Purchase Orders** - Vendor management and PO tracking
- **Goods Receipt Notes** - Receiving with quality control
- **Vendor Invoices** - 3-way matching (PO, GRN, Invoice)
- **Vendor Payments** - Payment processing with aging reports

### 💳 Financial Management
- **Chart of Accounts** - Flexible 5-level COA structure
- **General Ledger** - Complete GL with period lock
- **Accounts Receivable** - Customer payment tracking
- **Accounts Payable** - Vendor payment management
- **Financial Reporting** - P&L, Balance Sheet, Cash Flow

### 🏢 Multi-Company
- **Unlimited Companies** - Manage multiple legal entities
- **Tenant Isolation** - Complete data separation via RLS
- **Consolidated Reporting** - Cross-company reporting

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([install with nvm](https://github.com/nvm-sh/nvm))
- **Supabase CLI** ([installation guide](https://supabase.com/docs/guides/cli))
- **Git**

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd fashion-forge

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start Supabase locally (optional)
supabase start

# Run database migrations
supabase db push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool)
- TanStack Query (data fetching)
- React Router (routing)
- Shadcn UI + Tailwind CSS (UI components)
- Recharts (data visualization)

**Backend:**
- Supabase (PostgreSQL database)
- Supabase Edge Functions (Deno runtime)
- Row Level Security (RLS) for multi-tenancy
- Real-time subscriptions

**Architecture Pattern:**
```
┌─────────────┐
│   React UI  │ ← Presentation Layer (Dumb UI)
└──────┬──────┘
       │
┌──────▼──────────────┐
│  Edge Functions     │ ← Business Logic Layer
│  (Deno Runtime)     │   - Workflows
│                     │   - Auto Journaling
│  - receive-raw-     │   - Validations
│  - issue-raw-       │
│  - receive-fg       │
│  - issue-fg         │
│  - post-adjustment  │
└──────┬──────────────┘
       │
┌──────▼──────────────┐
│  PostgreSQL + RLS   │ ← Data Layer (Invariants)
│                     │   - CHECK constraints
│  - Triggers         │   - Triggers
│  - CHECK constraints│   - Immutability
│  - Immutable ledgers│
└─────────────────────┘
```

### Key Principles (RULES.md)

1. **Database = Invariants** - Business rules enforced via CHECK constraints
2. **Backend = Workflows** - Complex logic in Edge Functions
3. **UI = Presentation** - No business logic in frontend

---

## 📁 Project Structure

```
fashion-forge/
├── src/                          # Frontend React application
│   ├── components/              # UI components
│   ├── hooks/                   # React hooks & API calls
│   ├── pages/                   # Page components
│   └── lib/                     # Utilities
│
├── backend/supabase/            # Backend (Supabase)
│   ├── migrations/              # Database migrations (47+ files)
│   │   ├── 020_additional_check_constraints.sql
│   │   ├── 021_auto_journal_setup.sql
│   │   └── ...
│   │
│   └── functions/               # Edge Functions (Deno)
│       ├── _shared/             # Shared utilities
│       │   ├── logger.ts        # Structured logging
│       │   ├── auto-journal.ts  # Auto journaling engine
│       │   └── account-mapping.ts
│       │
│       ├── receive-raw-material/
│       ├── issue-raw-material/
│       ├── receive-finished-goods/
│       ├── issue-finished-goods/
│       └── post-adjustment/
│
├── docs/                        # Documentation
└── public/                      # Static assets
```

---

## 💡 Auto Journaling System

### How It Works

Every inventory transaction automatically creates proper double-entry journal entries:

**Example: Complete Manufacturing Cycle**

```
1. Purchase Raw Material ($1,000)
   DR: Inventory - Raw Materials    $1,000
   CR: Accounts Payable (Accrued)   $1,000

2. Issue to Production ($1,000)
   DR: WIP Inventory                $1,000
   CR: Inventory - Raw Materials    $1,000

3. Complete Production ($1,500 with labor)
   DR: Finished Goods Inventory     $1,500
   CR: WIP Inventory                $1,500

4. Sell Product ($2,000 selling price)
   Entry 1 - Revenue:
   DR: Accounts Receivable          $2,000
   CR: Sales Revenue                $2,000
   
   Entry 2 - COGS:
   DR: Cost of Goods Sold           $1,500
   CR: Finished Goods Inventory     $1,500

Result: Gross Profit = $500 (automatically calculated!)
```

### Configuration

System account mappings can be configured in Settings:

```sql
-- View current mappings
SELECT * FROM v_system_account_mappings 
WHERE company_code = 'YOUR_COMPANY';

-- Update mapping
UPDATE system_account_mappings
SET account_id = 'new-account-uuid'
WHERE mapping_code = 'INVENTORY_RAW_MATERIALS';
```

---

## 🗄️ Database

### Migrations

All database changes are managed through migrations:

```bash
# Create new migration
supabase migration new migration_name

# Apply migrations locally
supabase db push

# Apply migrations to production
supabase db push --db-url "postgresql://..."
```

### Key Tables

- **Companies** - Multi-tenant companies
- **Chart of Accounts** - 5-level COA structure
- **Journals & Journal Lines** - Immutable GL entries
- **Raw Material Ledger** - Raw material transactions
- **WIP Ledger** - Work-in-progress tracking
- **Finished Goods Ledger** - Finished goods inventory
- **System Account Mappings** - Auto journaling configuration

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- useInventory.test.ts
```

---

## 🚀 Deployment

### Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
3. Push migrations:
   ```bash
   supabase db push
   ```
4. Deploy Edge Functions:
   ```bash
   supabase functions deploy
   ```

### Frontend (Vercel/Netlify)

1. Connect your Git repository
2. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy!

---

## 📚 Documentation

- **[RULES.md](./RULES.md)** - Architecture principles
- **[Walkthrough](./docs/walkthrough.md)** - Auto journaling implementation
- **[Database Schema](./docs/DATABASE_SCHEMA.md)** - Complete schema documentation
- **[API Documentation](./docs/API.md)** - Edge Functions API

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Supabase](https://supabase.com/)
- UI components from [Shadcn UI](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

---

## 📧 Support

For support, email support@fashionforge.com or open an issue on GitHub.

---

**Made with TUYS & ANTIGRAVITY for the Fashion Manufacturing Industry**