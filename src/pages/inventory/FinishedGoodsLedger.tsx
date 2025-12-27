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
  Package,
  ArrowDownToLine,
  ShoppingCart,
  TrendingUp,
  Boxes
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Sample data
const sampleBalances = [
  { 
    id: '1', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-S-BLK',
    size: 'S',
    color: 'Black',
    qty: 100, 
    cost: 4500000,
    unitCost: 45000,
    warehouse: 'Gudang Utama'
  },
  { 
    id: '2', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-M-BLK',
    size: 'M',
    color: 'Black',
    qty: 150, 
    cost: 6750000,
    unitCost: 45000,
    warehouse: 'Gudang Utama'
  },
  { 
    id: '3', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-L-WHT',
    size: 'L',
    color: 'White',
    qty: 80, 
    cost: 3600000,
    unitCost: 45000,
    warehouse: 'Gudang Utama'
  },
  { 
    id: '4', 
    productCode: 'TS-002', 
    productName: 'Kaos Raglan Sport',
    sku: 'TS-002-M-RED',
    size: 'M',
    color: 'Red',
    qty: 50, 
    cost: 2750000,
    unitCost: 55000,
    warehouse: 'Gudang Utama'
  },
];

const sampleLedger = [
  { 
    id: '1', 
    date: '2025-01-17', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-M-BLK',
    type: 'PRODUCTION_IN',
    reference: 'WO-2025-001',
    qtyIn: 50,
    qtyOut: 0,
    unitCost: 45000,
    balance: 150
  },
  { 
    id: '2', 
    date: '2025-01-16', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-S-BLK',
    type: 'SALES_OUT',
    reference: 'SO-2025-015',
    qtyIn: 0,
    qtyOut: 20,
    unitCost: 45000,
    balance: 100
  },
  { 
    id: '3', 
    date: '2025-01-15', 
    productCode: 'TS-002', 
    productName: 'Kaos Raglan Sport',
    sku: 'TS-002-M-RED',
    type: 'PRODUCTION_IN',
    reference: 'WO-2025-002',
    qtyIn: 50,
    qtyOut: 0,
    unitCost: 55000,
    balance: 50
  },
];

export default function FinishedGoodsLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('balances');
  const navigate = useNavigate();

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

  const totalQty = sampleBalances.reduce((sum, b) => sum + b.qty, 0);
  const totalValue = sampleBalances.reduce((sum, b) => sum + b.cost, 0);
  const totalSKUs = sampleBalances.length;
  const totalProducts = new Set(sampleBalances.map(b => b.productCode)).size;

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
              <div className="text-2xl font-bold">{totalProducts}</div>
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
                    {sampleBalances.map((balance) => (
                      <TableRow key={balance.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div>
                            <div className="font-medium">{balance.productName}</div>
                            <div className="text-xs text-muted-foreground">{balance.productCode}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{balance.sku}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{balance.size}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{balance.color}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{balance.qty}</TableCell>
                        <TableCell className="text-right">Rp {balance.unitCost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-medium">Rp {balance.cost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-sm">{balance.warehouse}</TableCell>
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
                      <TableHead>Product / SKU</TableHead>
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
                            <div className="font-medium">{entry.productName}</div>
                            <div className="text-xs text-muted-foreground">{entry.sku}</div>
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
