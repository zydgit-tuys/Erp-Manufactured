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
import { 
  Plus, 
  Search, 
  ArrowLeftRight,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Warehouse
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Sample data
const sampleTransfers = [
  { 
    id: '1', 
    number: 'TRF-2025-001', 
    date: '2025-01-15',
    type: 'RAW',
    fromWarehouse: 'Gudang Utama',
    fromBin: 'A-01',
    toWarehouse: 'Gudang Produksi',
    toBin: 'P-01',
    status: 'posted',
    totalQty: 100,
    totalValue: 2500000,
    createdBy: 'Admin'
  },
  { 
    id: '2', 
    number: 'TRF-2025-002', 
    date: '2025-01-16',
    type: 'FG',
    fromWarehouse: 'Gudang Produksi',
    fromBin: 'FG-01',
    toWarehouse: 'Gudang Utama',
    toBin: 'B-02',
    status: 'posted',
    totalQty: 50,
    totalValue: 2250000,
    createdBy: 'Admin'
  },
  { 
    id: '3', 
    number: 'TRF-2025-003', 
    date: '2025-01-17',
    type: 'RAW',
    fromWarehouse: 'Gudang Utama',
    fromBin: 'A-02',
    toWarehouse: 'Gudang Utama',
    toBin: 'A-05',
    status: 'draft',
    totalQty: 200,
    totalValue: 3000000,
    createdBy: 'Admin'
  },
];

export default function InternalTransfers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>;
      case 'posted':
        return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" /> Posted</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'RAW':
        return <Badge className="bg-info/10 text-info border-info/20">Raw Material</Badge>;
      case 'FG':
        return <Badge className="bg-success/10 text-success border-success/20">Finished Goods</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredTransfers = statusFilter === 'all'
    ? sampleTransfers
    : sampleTransfers.filter(t => t.status === statusFilter);

  const draftCount = sampleTransfers.filter(t => t.status === 'draft').length;
  const postedCount = sampleTransfers.filter(t => t.status === 'posted').length;
  const totalTransferred = sampleTransfers
    .filter(t => t.status === 'posted')
    .reduce((sum, t) => sum + t.totalValue, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Internal Transfers</h1>
            <p className="text-muted-foreground">
              Manage bin-to-bin and warehouse transfers
            </p>
          </div>
          <Button onClick={() => navigate('/inventory/transfers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Transfer
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Total Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleTransfers.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Pending Draft
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{draftCount}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Posted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{postedCount}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Total Transferred
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Rp {totalTransferred.toLocaleString('id-ID')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transfers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={statusFilter === 'all' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button 
                  variant={statusFilter === 'draft' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('draft')}
                >
                  Draft
                </Button>
                <Button 
                  variant={statusFilter === 'posted' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => setStatusFilter('posted')}
                >
                  Posted
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransfers.map((transfer) => (
                  <TableRow 
                    key={transfer.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/inventory/transfers/${transfer.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">{transfer.number}</TableCell>
                    <TableCell>{format(new Date(transfer.date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="text-center">{getTypeBadge(transfer.type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Warehouse className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{transfer.fromWarehouse}</span>
                        <span className="text-xs text-muted-foreground">({transfer.fromBin})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Warehouse className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{transfer.toWarehouse}</span>
                        <span className="text-xs text-muted-foreground">({transfer.toBin})</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">{transfer.totalQty}</TableCell>
                    <TableCell className="text-right font-mono">Rp {transfer.totalValue.toLocaleString('id-ID')}</TableCell>
                    <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                  </TableRow>
                ))}
                {filteredTransfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <ArrowLeftRight className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No transfers found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
