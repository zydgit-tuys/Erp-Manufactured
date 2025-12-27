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
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';

// Sample data
const sampleWipBalances = [
  { 
    id: '1', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-M-BLK',
    stage: 'CUT',
    qty: 50, 
    cost: 1250000,
    avgCost: 25000,
    daysInStage: 2
  },
  { 
    id: '2', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-L-WHT',
    stage: 'SEW',
    qty: 30, 
    cost: 1050000,
    avgCost: 35000,
    daysInStage: 1
  },
  { 
    id: '3', 
    productCode: 'TS-002', 
    productName: 'Kaos Raglan Sport',
    sku: 'TS-002-M-RED',
    stage: 'FINISH',
    qty: 25, 
    cost: 1125000,
    avgCost: 45000,
    daysInStage: 0
  },
  { 
    id: '4', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-S-BLU',
    stage: 'CUT',
    qty: 40, 
    cost: 1000000,
    avgCost: 25000,
    daysInStage: 5
  },
];

const sampleLedger = [
  { 
    id: '1', 
    date: '2025-01-17', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-M-BLK',
    stage: 'CUT',
    type: 'PRODUCTION_IN',
    reference: 'WO-2025-001',
    qtyIn: 50,
    qtyOut: 0,
    materialCost: 25000,
    laborCost: 0,
    overheadCost: 0
  },
  { 
    id: '2', 
    date: '2025-01-17', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-L-WHT',
    stage: 'CUT',
    type: 'PRODUCTION_OUT',
    reference: 'WO-2025-001',
    qtyIn: 0,
    qtyOut: 30,
    materialCost: 25000,
    laborCost: 5000,
    overheadCost: 5000
  },
  { 
    id: '3', 
    date: '2025-01-17', 
    productCode: 'TS-001', 
    productName: 'Kaos Polos Basic',
    sku: 'TS-001-L-WHT',
    stage: 'SEW',
    type: 'PRODUCTION_IN',
    reference: 'WO-2025-001',
    qtyIn: 30,
    qtyOut: 0,
    materialCost: 25000,
    laborCost: 5000,
    overheadCost: 5000
  },
];

export default function WipLedger() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('balances');
  const [stageFilter, setStageFilter] = useState<string>('all');

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

  const filteredBalances = stageFilter === 'all' 
    ? sampleWipBalances 
    : sampleWipBalances.filter(b => b.stage === stageFilter);

  const cutQty = sampleWipBalances.filter(b => b.stage === 'CUT').reduce((sum, b) => sum + b.qty, 0);
  const sewQty = sampleWipBalances.filter(b => b.stage === 'SEW').reduce((sum, b) => sum + b.qty, 0);
  const finishQty = sampleWipBalances.filter(b => b.stage === 'FINISH').reduce((sum, b) => sum + b.qty, 0);
  const totalValue = sampleWipBalances.reduce((sum, b) => sum + b.cost, 0);
  const hangingWip = sampleWipBalances.filter(b => b.daysInStage > 3).length;

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
                    {filteredBalances.map((balance) => (
                      <TableRow key={balance.id} className={balance.daysInStage > 3 ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{balance.productName}</div>
                            <div className="text-xs text-muted-foreground">{balance.productCode}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{balance.sku}</TableCell>
                        <TableCell className="text-center">{getStageBadge(balance.stage)}</TableCell>
                        <TableCell className="text-right font-mono">{balance.qty}</TableCell>
                        <TableCell className="text-right">Rp {balance.avgCost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-medium">Rp {balance.cost.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={balance.daysInStage > 3 ? 'destructive' : 'secondary'}>
                            {balance.daysInStage}d
                          </Badge>
                        </TableCell>
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
                      <TableHead className="text-center">Stage</TableHead>
                      <TableHead className="text-center">Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">In</TableHead>
                      <TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
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
                        <TableCell className="text-center">{getStageBadge(entry.stage)}</TableCell>
                        <TableCell className="text-center">{getTransactionBadge(entry.type)}</TableCell>
                        <TableCell className="font-mono text-sm">{entry.reference}</TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {entry.qtyIn > 0 ? `+${entry.qtyIn}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {entry.qtyOut > 0 ? `-${entry.qtyOut}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <div>M: {entry.materialCost.toLocaleString()}</div>
                          <div>L: {entry.laborCost.toLocaleString()}</div>
                          <div>O: {entry.overheadCost.toLocaleString()}</div>
                        </TableCell>
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
