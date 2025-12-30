import { useState } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Package,
  ArrowDownToLine,
  TrendingUp,
  Boxes
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useFinishedGoodsBalances, useFinishedGoodsLedger } from '@/hooks/useInventory';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function FinishedGoodsLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('balances');
  const navigate = useNavigate();
  const { companyId } = useApp();

  // Fetch balances
  const {
    data: balances,
    isLoading: isLoadingBalances,
    error: errorBalances,
    refetch: refetchBalances
  } = useFinishedGoodsBalances(companyId);

  // Fetch ledger
  const {
    data: ledger,
    isLoading: isLoadingLedger,
    error: errorLedger,
    refetch: refetchLedger
  } = useFinishedGoodsLedger(companyId);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'PRODUCTION_IN':
        return <Badge className="bg-success/10 text-success border-success/20">Production</Badge>;
      case 'SALES_OUT':
        return <Badge className="bg-info/10 text-info border-info/20">Sales</Badge>;
      case 'TRANSFER_IN':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Transfer In</Badge>;
      case 'TRANSFER_OUT':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Transfer Out</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Filter balances
  const filteredBalances = (balances || []).filter((b: any) =>
    b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter ledger
  const filteredLedger = (ledger || []).filter((entry: any) =>
    entry.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.product?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculation
  const totalQty = (balances || []).reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
  const totalValue = (balances || []).reduce((sum: number, b: any) => sum + (b.total_value || 0), 0);
  const totalSKUs = (balances || []).length;
  // Get unique product count
  const uniqueProducts = new Set((balances || []).map((b: any) => b.product_code)).size;

  if (errorBalances || errorLedger) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load finished goods data"
          message={errorBalances?.message || errorLedger?.message || "Unknown error"}
          onRetry={() => {
            refetchBalances();
            refetchLedger();
          }}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Finished Goods</h1>
            <p className="text-muted-foreground">
              Track finished goods inventory by SKU
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/inventory/fg/receive')}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Receive from Production
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{uniqueProducts}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Boxes className="h-4 w-4" /> Total SKUs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSKUs}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Quantity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalQty.toLocaleString()} pcs</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {totalValue.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="balances">Stock by SKU</TabsTrigger>
            <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search SKU or product..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBalances ? (
                  <TableSkeleton rows={5} columns={8} />
                ) : filteredBalances.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No finished goods found"
                    description="No finished goods inventory matching your criteria"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead>Warehouse</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((balance: any) => (
                        <TableRow key={balance.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <div>
                              <div className="font-medium">{balance.product_name}</div>
                              <div className="text-xs text-muted-foreground">{balance.product_code}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{balance.sku}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{balance.size || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{balance.color || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{balance.quantity}</TableCell>
                          <TableCell className="text-right">Rp {(balance.unit_cost || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right font-medium">Rp {(balance.total_value || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-sm">{balance.location_name || 'Main Warehouse'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingLedger ? (
                  <TableSkeleton rows={5} columns={8} />
                ) : filteredLedger.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No transactions found"
                    description="No finished goods transactions found matching your criteria"
                  />
                ) : (
                  <TableVirtuoso
                    style={{ height: 600 }}
                    data={filteredLedger}
                    components={{
                      Table: (props) => <Table {...props} />,
                      TableHead: (props) => <TableHeader {...props} />,
                      TableRow: (props) => <TableRow {...props} />,
                      TableBody: (props) => <TableBody {...props} />,
                    }}
                    fixedHeaderContent={() => (
                      <TableRow className="bg-card hover:bg-card">
                        <TableHead className="w-[120px]">Date</TableHead>
                        <TableHead>Product / SKU</TableHead>
                        <TableHead className="text-center w-[120px]">Type</TableHead>
                        <TableHead className="w-[150px]">Reference</TableHead>
                        <TableHead className="text-right w-[100px]">In</TableHead>
                        <TableHead className="text-right w-[100px]">Out</TableHead>
                        <TableHead className="text-right w-[150px]">Unit Cost</TableHead>
                      </TableRow>
                    )}
                    itemContent={(index, entry: any) => (
                      <>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(entry.transaction_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.product?.name}</div>
                            <div className="text-xs text-muted-foreground">{entry.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{getTransactionBadge(entry.transaction_type)}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.reference_id}</TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {entry.qty_in > 0 ? `+${entry.qty_in}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {entry.qty_out > 0 ? `-${entry.qty_out}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">Rp {(entry.unit_cost || 0).toLocaleString('id-ID')}</TableCell>
                      </>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
