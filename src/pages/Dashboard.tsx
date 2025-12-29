import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Layers, Truck, Users, Calendar, BookOpen, Plus, Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useMaterials } from '@/hooks/useMaterials';
import { useProducts, useVendors, useCustomers } from '@/hooks/useMasterData';
import { useAccountingPeriods, useChartOfAccounts } from '@/hooks/useAccounting';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function Dashboard() {
  const { companyId } = useApp();

  // Fetch key metrics
  const { data: products, isLoading: productsLoading } = useProducts(companyId);
  const { data: materials, isLoading: materialsLoading } = useMaterials(); // already uses context internally if updated? Let's check. Yes, previously verified.
  const { data: vendors, isLoading: vendorsLoading } = useVendors(companyId);
  const { data: customers, isLoading: customersLoading } = useCustomers(companyId);
  const { data: periods, isLoading: periodsLoading } = useAccountingPeriods(companyId);
  const { data: coaData, isLoading: coaLoading } = useChartOfAccounts(companyId);

  const quickActions = [
    {
      title: 'Add Product',
      description: 'Create a new product',
      icon: Plus,
      href: '/products/new',
    },
    {
      title: 'Add Material',
      description: 'Register raw material',
      icon: Plus,
      href: '/materials/new',
    },
    {
      title: 'Add Vendor',
      description: 'Add a new supplier',
      icon: Plus,
      href: '/vendors/new',
    },
    {
      title: 'Add Customer',
      description: 'Register customer',
      icon: Plus,
      href: '/customers/new',
    },
  ];

  // Calculations
  const activeProducts = products?.filter(p => p.is_active).length || 0;
  const totalVariants = products?.reduce((sum, p) => sum + (p.variant_count || 0), 0) || 0;

  const lowStockMaterials = materials?.filter(m => m.current_stock <= m.reorder_level).length || 0;

  const activeVendors = vendors?.filter(v => v.is_active).length || 0;
  const activeCustomers = customers?.filter(c => c.is_active).length || 0;

  const currentPeriod = periods?.find(p => p.status === 'open');

  const accounts = coaData?.flat || [];
  const assetCount = accounts.filter(a => a.account_type === 'ASSET').length;
  const liabilityCount = accounts.filter(a => a.account_type === 'LIABILITY').length;
  const equityCount = accounts.filter(a => a.account_type === 'EQUITY').length;
  const revenueCount = accounts.filter(a => a.account_type === 'REVENUE').length;
  const expenseCount = accounts.filter(a => a.account_type === 'EXPENSE').length;

  const isLoading = productsLoading || materialsLoading || vendorsLoading || customersLoading || periodsLoading || coaLoading;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to Ziyada Sport ERP. Here's an overview of your business.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Products"
            value={productsLoading ? "..." : products?.length.toString() || "0"}
            description={`${totalVariants} variants, ${activeProducts} active`}
            icon={Package}
          />
          <StatsCard
            title="Materials"
            value={materialsLoading ? "..." : materials?.length.toString() || "0"}
            description={lowStockMaterials > 0 ? `${lowStockMaterials} items low stock` : "All stock levels normal"}
            icon={Layers}
            trend={lowStockMaterials > 0 ? 'down' : 'up'}
          />
          <StatsCard
            title="Vendors"
            value={vendorsLoading ? "..." : vendors?.length.toString() || "0"}
            description={`${activeVendors} active suppliers`}
            icon={Truck}
          />
          <StatsCard
            title="Customers"
            value={customersLoading ? "..." : customers?.length.toString() || "0"}
            description={`${activeCustomers} active customers`}
            icon={Users}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Actions */}
          <QuickActions actions={quickActions} />

          {/* Current Period */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Current Period
              </CardTitle>
            </CardHeader>
            <CardContent>
              {periodsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : currentPeriod ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Period</span>
                    <span className="font-mono font-medium">{currentPeriod.period_code}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                      Open
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Date Range</span>
                    <span className="text-sm">
                      {format(new Date(currentPeriod.start_date), 'MMM d')} - {format(new Date(currentPeriod.end_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p>No open accounting period.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart of Accounts Summary */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Chart of Accounts
              </CardTitle>
              <CardDescription>
                {coaLoading ? <Skeleton className="h-4 w-20" /> : `${accounts.length} total accounts`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coaLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Assets</span>
                    <span className="font-medium">{assetCount} accounts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Liabilities</span>
                    <span className="font-medium">{liabilityCount} accounts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Equity</span>
                    <span className="font-medium">{equityCount} accounts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-medium">{revenueCount} accounts</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Expenses</span>
                    <span className="font-medium">{expenseCount} accounts</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
