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
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Package,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useRawMaterialBalances, useRawMaterialLedger } from '@/hooks/useInventory';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function RawMaterialLedger() {
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
  } = useRawMaterialBalances(companyId);

  // Fetch ledger
  const {
    data: ledger,
    isLoading: isLoadingLedger,
    error: errorLedger,
    refetch: refetchLedger
  } = useRawMaterialLedger(companyId);

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'RECEIPT':
        return <Badge className="bg-success/10 text-success border-success/20">Receipt</Badge>;
      case 'ISSUE':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Issue</Badge>;
      case 'ADJUSTMENT_IN':
        return <Badge className="bg-info/10 text-info border-info/20">Adj +</Badge>;
      case 'ADJUSTMENT_OUT':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Adj -</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getStockStatus = (reorderLevel: number, currentStock: number) => {
    if (currentStock <= reorderLevel) {
      return <Badge variant="destructive">Low Stock</Badge>;
    }
    return <Badge className="bg-success/10 text-success border-success/20">OK</Badge>;
  };

  // Filter balances
  const filteredBalances = (balances || []).filter(
    (item: any) =>
      item.material_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.material_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter ledger
  const filteredLedger = (ledger || []).filter(
    (entry: any) =>
      entry.material?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.material?.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalValue = (balances || []).reduce((sum: number, b: any) => sum + (b.total_value || 0), 0);
  const lowStockCount = (balances || []).filter((b: any) => (b.current_stock || 0) <= (b.reorder_level || 0)).length;

  if (errorBalances || errorLedger) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load inventory data"
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
            <h1 className="text-3xl font-bold tracking-tight">Raw Material Inventory</h1>
            <p className="text-muted-foreground">
              Track raw material receipts, issues, and stock levels
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/inventory/raw/receive')}>
              <ArrowDownToLine className="mr-2 h-4 w-4" />
              Receive
            </Button>
            <Button onClick={() => navigate('/inventory/raw/issue')}>
              <ArrowUpFromLine className="mr-2 h-4 w-4" />
              Issue
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Materials
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{balances?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {totalValue.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                {lowStockCount}
                {lowStockCount > 0 && <AlertTriangle className="h-5 w-5" />}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Transactions Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {ledger?.filter((l: any) => {
                  const today = new Date().toISOString().split('T')[0];
                  return l.transaction_date?.startsWith(today);
                }).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="balances">Stock Balances</TabsTrigger>
            <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search materials..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBalances ? (
                  <TableSkeleton rows={5} columns={7} />
                ) : filteredBalances.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No materials found"
                    description="No raw materials match your criteria"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((balance: any) => (
                        <TableRow key={balance.material_id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">{balance.material_code}</TableCell>
                          <TableCell className="font-medium">{balance.material_name}</TableCell>
                          <TableCell className="text-right font-mono">{(balance.current_stock || 0).toLocaleString()}</TableCell>
                          <TableCell>{balance.uom}</TableCell>
                          <TableCell className="text-right">Rp {(balance.weighted_average_cost || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right font-medium">Rp {(balance.total_value || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-center">{getStockStatus(balance.reorder_level || 0, balance.current_stock || 0)}</TableCell>
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
                    description="No ledger entries match your criteria"
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
                        <TableHead>Material</TableHead>
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
                            <div className="font-medium">{entry.material?.name}</div>
                            <div className="text-xs text-muted-foreground">{entry.material?.code}</div>
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
