import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Materials from "./pages/Materials";
import Vendors from "./pages/Vendors";
import Customers from "./pages/Customers";
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
import BOMs from "./pages/production/BOMs";
import WorkOrders from "./pages/production/WorkOrders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
              <Route path="/vendors" element={<ProtectedRoute><Vendors /></ProtectedRoute>} />
              <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
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
              <Route path="/production/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
