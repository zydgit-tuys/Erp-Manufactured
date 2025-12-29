import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppProvider } from "@/contexts/AppContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Materials from "./pages/Materials";
import CreateProduct from "./pages/CreateProduct";
import Vendors from "./pages/Vendors";
import CreateVendor from "./pages/CreateVendor";
import Customers from "./pages/Customers";
import CreateCustomer from "./pages/CreateCustomer";
import CreateMaterial from "./pages/CreateMaterial";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountingPeriods from "./pages/AccountingPeriods";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// Inventory pages
import {
  RawMaterialLedger,
  WipLedger,
  FinishedGoodsLedger,
  InventoryAdjustments,
  InternalTransfers,
} from "./pages/inventory";

// Manufacturing pages
// Manufacturing pages
// Production pages
import BOMs from "./pages/production/BOMs";
import CreateBOM from "./pages/production/CreateBOM";
import WorkOrders from "./pages/production/WorkOrders";
import Operations from "./pages/production/Operations";

// Purchasing pages
import PurchaseOrders from "./pages/purchasing/PurchaseOrders";
import CreatePurchaseOrder from "./pages/purchasing/CreatePurchaseOrder";
import GoodsReceipts from "./pages/purchasing/GoodsReceipts";
import ReceiveGoods from "./pages/purchasing/ReceiveGoods";
import VendorInvoices from "./pages/purchasing/VendorInvoices";

// Sales pages
import SalesOrders from "./pages/sales/SalesOrders";
import CreateSalesOrder from "./pages/sales/CreateSalesOrder";
import POS from "./pages/sales/POS";
import Shipments from "./pages/sales/Shipments";
import ShipmentDetails from "./pages/sales/ShipmentDetails";
import SalesInvoices from "./pages/sales/SalesInvoices";

// Placeholders
import Marketplace from "./pages/Marketplace";
import Analytics from "./pages/Analytics";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/products/new" element={<ProtectedRoute><CreateProduct /></ProtectedRoute>} />
                <Route path="/products/:id" element={<ProtectedRoute><CreateProduct /></ProtectedRoute>} />

                <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
                <Route path="/materials/new" element={<ProtectedRoute><CreateMaterial /></ProtectedRoute>} />
                <Route path="/materials/:id" element={<ProtectedRoute><CreateMaterial /></ProtectedRoute>} />

                <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
                <Route path="/vendors/new" element={<ProtectedRoute><CreateVendor /></ProtectedRoute>} />
                <Route path="/vendors/:id" element={<ProtectedRoute><CreateVendor /></ProtectedRoute>} />

                <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
                <Route path="/customers/new" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />
                <Route path="/customers/:id" element={<ProtectedRoute><CreateCustomer /></ProtectedRoute>} />

                <Route path="/coa" element={<ProtectedRoute><ChartOfAccounts /></ProtectedRoute>} />
                <Route path="/periods" element={<ProtectedRoute><AccountingPeriods /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                {/* Inventory Routes */}
                <Route path="/inventory/raw" element={<ProtectedRoute><RawMaterialLedger /></ProtectedRoute>} />
                <Route path="/inventory/wip" element={<ProtectedRoute><WipLedger /></ProtectedRoute>} />
                <Route path="/inventory/fg" element={<ProtectedRoute><FinishedGoodsLedger /></ProtectedRoute>} />
                <Route path="/inventory/adjustments" element={<ProtectedRoute><InventoryAdjustments /></ProtectedRoute>} />
                <Route path="/inventory/transfers" element={<ProtectedRoute><InternalTransfers /></ProtectedRoute>} />

                {/* Manufacturing Routes */}
                <Route path="/production/boms" element={<ProtectedRoute><BOMs /></ProtectedRoute>} />
                <Route path="/production/boms/create" element={<ProtectedRoute><CreateBOM /></ProtectedRoute>} />
                <Route path="/production/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
                <Route path="/production/operations" element={<ProtectedRoute><Operations /></ProtectedRoute>} />

                {/* Purchasing Routes */}
                <Route path="/purchasing/orders" element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
                <Route path="/purchasing/new" element={<ProtectedRoute><CreatePurchaseOrder /></ProtectedRoute>} />
                {/* Note: /purchasing/orders/:id view/edit page is not yet created, defaulting to list or we can reuse CreatePurchaseOrder in edit mode later */}
                <Route path="/purchasing/orders/:id" element={<ProtectedRoute><CreatePurchaseOrder /></ProtectedRoute>} />
                <Route path="/purchasing/receipts" element={<ProtectedRoute><GoodsReceipts /></ProtectedRoute>} />
                <Route path="/purchasing/receive/:id" element={<ProtectedRoute><ReceiveGoods /></ProtectedRoute>} />
                <Route path="/purchasing/invoices" element={<ProtectedRoute><VendorInvoices /></ProtectedRoute>} />

                {/* Sales Routes */}
                <Route path="/sales/orders" element={<ProtectedRoute><SalesOrders /></ProtectedRoute>} />
                <Route path="/sales/new" element={<ProtectedRoute><CreateSalesOrder /></ProtectedRoute>} />
                <Route path="/sales/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                <Route path="/sales/invoices" element={<ProtectedRoute><SalesInvoices /></ProtectedRoute>} />
                <Route path="/sales/shipments" element={<ProtectedRoute><Shipments /></ProtectedRoute>} />
                <Route path="/sales/ship/:id" element={<ProtectedRoute><ShipmentDetails /></ProtectedRoute>} />

                {/* Placeholders */}
                <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
