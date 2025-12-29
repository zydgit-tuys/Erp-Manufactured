import { useState } from 'react';
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
  Scissors,
  Factory,
  Sparkles,
  Clock,
  AlertTriangle,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useWipBalances, useWipLedger } from '@/hooks/useInventory';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function WipLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('balances');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const { companyId } = useApp();

  // Fetch balances
  const {
    data: balances,
    isLoading: isLoadingBalances,
    error: errorBalances,
    refetch: refetchBalances
  } = useWipBalances(companyId);

  // Fetch ledger
  const {
    data: ledger,
    isLoading: isLoadingLedger,
    error: errorLedger,
    refetch: refetchLedger
  } = useWipLedger(companyId);

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'CUT':
        return <Badge className="bg-info/10 text-info border-info/20"><Scissors className="h-3 w-3 mr-1" /> Cut</Badge>;
      case 'SEW':
        return <Badge className="bg-warning/10 text-warning border-warning/20"><Factory className="h-3 w-3 mr-1" /> Sew</Badge>;
      case 'FINISH':
        return <Badge className="bg-success/10 text-success border-success/20"><Sparkles className="h-3 w-3 mr-1" /> Finish</Badge>;
      default:
        return <Badge variant="secondary">{stage}</Badge>;
    }
  };

  const getTransactionBadge = (type: string) => {
    switch (type) {
      case 'PRODUCTION_IN':
        return <Badge className="bg-success/10 text-success border-success/20">In</Badge>;
      case 'PRODUCTION_OUT':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Out</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // Filter balances
  const filteredBalances = (balances || []).filter((b: any) => {
    const matchesSearch =
      b.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === 'all' || b.stage === stageFilter;

    return matchesSearch && matchesStage;
  });

  // Filter ledger
  const filteredLedger = (ledger || []).filter((entry: any) =>
    entry.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.product?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats calculation
  const cutQty = (balances || []).filter((b: any) => b.stage === 'CUT').reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
  const sewQty = (balances || []).filter((b: any) => b.stage === 'SEW').reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
  const finishQty = (balances || []).filter((b: any) => b.stage === 'FINISH').reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
  const totalValue = (balances || []).reduce((sum: number, b: any) => sum + (b.total_value || 0), 0);

  // Mock days in stage logic since it might not be in the view yet, defaulting to 0 if not present
  const hangingWip = (balances || []).filter((b: any) => (b.days_in_stage || 0) > 3).length;

  if (errorBalances || errorLedger) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load WIP data"
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
            <h1 className="text-3xl font-bold tracking-tight">Work in Progress</h1>
            <p className="text-muted-foreground">
              Track production progress through CUT → SEW → FINISH stages
            </p>
          </div>
        </div>

        {/* Stage Summary */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="shadow-card border-l-4 border-l-info">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Scissors className="h-4 w-4" /> CUT Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cutQty} pcs</div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-warning">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Factory className="h-4 w-4" /> SEW Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sewQty} pcs</div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-l-4 border-l-success">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> FINISH Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{finishQty} pcs</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total WIP Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {totalValue.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Hanging WIP
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive flex items-center gap-2">
                {hangingWip}
                {hangingWip > 0 && <AlertTriangle className="h-5 w-5" />}
              </div>
              <p className="text-xs text-muted-foreground">&gt; 3 days in stage</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="balances">WIP Balances</TabsTrigger>
            <TabsTrigger value="ledger">Transaction Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={stageFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStageFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={stageFilter === 'CUT' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStageFilter('CUT')}
                    >
                      <Scissors className="h-3 w-3 mr-1" /> Cut
                    </Button>
                    <Button
                      variant={stageFilter === 'SEW' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStageFilter('SEW')}
                    >
                      <Factory className="h-3 w-3 mr-1" /> Sew
                    </Button>
                    <Button
                      variant={stageFilter === 'FINISH' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStageFilter('FINISH')}
                    >
                      <Sparkles className="h-3 w-3 mr-1" /> Finish
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingBalances ? (
                  <TableSkeleton rows={5} columns={7} />
                ) : filteredBalances.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No WIP items found"
                    description="There is no work in progress matching your criteria"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-center">Stage</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Avg Cost</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-center">Days</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBalances.map((balance: any) => (
                        <TableRow key={balance.id || `${balance.product_id}-${balance.stage}`} className={(balance.days_in_stage || 0) > 3 ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{balance.product_name}</div>
                              <div className="text-xs text-muted-foreground">{balance.product_code}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{balance.sku}</TableCell>
                          <TableCell className="text-center">{getStageBadge(balance.stage)}</TableCell>
                          <TableCell className="text-right font-mono">{balance.quantity}</TableCell>
                          <TableCell className="text-right">Rp {(balance.average_cost || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right font-medium">Rp {(balance.total_value || 0).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={(balance.days_in_stage || 0) > 3 ? 'destructive' : 'secondary'}>
                              {balance.days_in_stage || 0}d
                            </Badge>
                          </TableCell>
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
                    description="No WIP transactions found matching your criteria"
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Product / SKU</TableHead>
                        <TableHead className="text-center">Stage</TableHead>
                        <TableHead className="text-center">Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLedger.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(entry.journal_date), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{entry.product?.name}</div>
                              <div className="text-xs text-muted-foreground">{entry.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{getStageBadge(entry.stage)}</TableCell>
                          <TableCell className="text-center">{getTransactionBadge(entry.transaction_type)}</TableCell>
                          <TableCell className="font-mono text-sm">{entry.reference_id}</TableCell>
                          <TableCell className="text-right font-mono text-success">
                            {entry.qty_in > 0 ? `+${entry.qty_in}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            {entry.qty_out > 0 ? `-${entry.qty_out}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
