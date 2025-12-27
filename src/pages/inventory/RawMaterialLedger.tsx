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
  Plus, 
  Search, 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Sample data for demo
const sampleLedger = [
  { 
    id: '1', 
    date: '2025-01-15', 
    materialCode: 'MAT-001', 
    materialName: 'Kain Katun 30s',
    type: 'RECEIPT',
    reference: 'PO-2025-001',
    qtyIn: 500,
    qtyOut: 0,
    unitCost: 25000,
    balance: 500,
    totalCost: 12500000
  },
  { 
    id: '2', 
    date: '2025-01-16', 
    materialCode: 'MAT-001', 
    materialName: 'Kain Katun 30s',
    type: 'ISSUE',
    reference: 'WO-2025-001',
    qtyIn: 0,
    qtyOut: 100,
    unitCost: 25000,
    balance: 400,
    totalCost: 10000000
  },
  { 
    id: '3', 
    date: '2025-01-17', 
    materialCode: 'MAT-002', 
    materialName: 'Benang Polyester',
    type: 'RECEIPT',
    reference: 'PO-2025-002',
    qtyIn: 200,
    qtyOut: 0,
    unitCost: 15000,
    balance: 200,
    totalCost: 3000000
  },
];

const sampleBalances = [
  { 
    id: '1', 
    code: 'MAT-001', 
    name: 'Kain Katun 30s', 
    unit: 'meter',
    qty: 400, 
    cost: 10000000,
    avgCost: 25000,
    minStock: 100,
    status: 'ok'
  },
  { 
    id: '2', 
    code: 'MAT-002', 
    name: 'Benang Polyester', 
    unit: 'roll',
    qty: 200, 
    cost: 3000000,
    avgCost: 15000,
    minStock: 50,
    status: 'ok'
  },
  { 
    id: '3', 
    code: 'MAT-003', 
    name: 'Kancing Plastik', 
    unit: 'pcs',
    qty: 80, 
    cost: 400000,
    avgCost: 5000,
    minStock: 500,
    status: 'low'
  },
];

export default function RawMaterialLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('balances');
  const navigate = useNavigate();

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

  const getStockStatus = (status: string) => {
    switch (status) {
      case 'low':
        return <Badge variant="destructive">Low Stock</Badge>;
      case 'ok':
        return <Badge className="bg-success/10 text-success border-success/20">OK</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalValue = sampleBalances.reduce((sum, b) => sum + b.cost, 0);
  const lowStockCount = sampleBalances.filter(b => b.status === 'low').length;

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
              <div className="text-2xl font-bold">{sampleBalances.length}</div>
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
              <div className="text-2xl font-bold">{sampleLedger.length}</div>
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
                    {sampleBalances.map((balance) => (
                      <TableRow key={balance.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{balance.code}</TableCell>
                        <TableCell className="font-medium">{balance.name}</TableCell>
                        <TableCell className="text-right font-mono">{balance.qty.toLocaleString()}</TableCell>
                        <TableCell>{balance.unit}</TableCell>
                        <TableCell className="text-right">Rp {balance.avgCost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-medium">Rp {balance.cost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-center">{getStockStatus(balance.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleLedger.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(entry.date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{entry.materialName}</div>
                            <div className="text-xs text-muted-foreground">{entry.materialCode}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{getTransactionBadge(entry.type)}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {entry.qtyIn > 0 ? `+${entry.qtyIn}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {entry.qtyOut > 0 ? `-${entry.qtyOut}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{entry.balance}</TableCell>
                        <TableCell className="text-right">Rp {entry.unitCost.toLocaleString('id-ID')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
