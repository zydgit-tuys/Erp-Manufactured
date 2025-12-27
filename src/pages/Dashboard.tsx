import { AppLayout } from '@/components/layout/AppLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Layers, Truck, Users, Calendar, BookOpen, Plus } from 'lucide-react';

export default function Dashboard() {
  const quickActions = [
    {
      title: 'Add Product',
      description: 'Create a new product with variants',
      icon: Plus,
      href: '/products/new',
    },
    {
      title: 'Add Material',
      description: 'Register new raw material',
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
      description: 'Register new customer',
      icon: Plus,
      href: '/customers/new',
    },
  ];

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
            value="45"
            description="5 product lines, 45 SKUs"
            icon={Package}
          />
          <StatsCard
            title="Materials"
            value="3"
            description="All stock levels normal"
            icon={Layers}
          />
          <StatsCard
            title="Vendors"
            value="2"
            description="Active suppliers"
            icon={Truck}
          />
          <StatsCard
            title="Customers"
            value="0"
            description="No customers yet"
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
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Period</span>
                  <span className="font-mono font-medium">2025-01</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                    Open
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Date Range</span>
                  <span className="text-sm">Jan 1 - Jan 31, 2025</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart of Accounts Summary */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Chart of Accounts
              </CardTitle>
              <CardDescription>Konveksi template loaded</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Assets (1xxx)</span>
                  <span className="font-medium">10 accounts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Liabilities (2xxx)</span>
                  <span className="font-medium">5 accounts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equity (3xxx)</span>
                  <span className="font-medium">3 accounts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue (4xxx)</span>
                  <span className="font-medium">4 accounts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Expenses (5-6xxx)</span>
                  <span className="font-medium">15 accounts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
