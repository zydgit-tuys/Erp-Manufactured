import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LEDGER_TYPE, TRANSACTION_TYPE } from '@/types/enums';
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
import { useApp } from '@/contexts/AppContext';
import { useInternalTransfers } from '@/hooks/useInventory';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function InternalTransfers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { companyId } = useApp();

  const {
    data: transfers,
    isLoading,
    error,
    refetch
  } = useInternalTransfers(companyId);

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
      case LEDGER_TYPE.RAW:
        return <Badge className="bg-info/10 text-info border-info/20">Raw Material</Badge>;
      case LEDGER_TYPE.FG:
        return <Badge className="bg-success/10 text-success border-success/20">Finished Goods</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredTransfers = (transfers || []).filter((t: any) => {
    const matchesSearch = t.transfer_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const draftCount = (transfers || []).filter((t: any) => t.status === 'draft').length;
  const postedCount = (transfers || []).filter((t: any) => t.status === 'posted').length;

  // Assuming totalValue is not readily available on the list object or we need to calculate it if provided.
  // Will set to 0 or display '-' if not available.
  const totalTransferred = 0;

  if (error) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load internal transfers"
          message={error.message}
          onRetry={() => refetch()}
        />
      </AppLayout>
    );
  }

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
              <div className="text-2xl font-bold">{transfers?.length || 0}</div>
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
              <div className="text-2xl font-bold">-</div>
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
            {isLoading ? (
              <TableSkeleton rows={5} columns={8} />
            ) : filteredTransfers.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No transfers found"
                description={
                  searchQuery
                    ? "No transfers match your search criteria"
                    : "Create your first internal transfer to get started"
                }
                action={
                  !searchQuery && (
                    <Button onClick={() => navigate('/inventory/transfers/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Transfer
                    </Button>
                  )
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.map((transfer: any) => (
                    <TableRow
                      key={transfer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/inventory/transfers/${transfer.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{transfer.transfer_number}</TableCell>
                      <TableCell>{format(new Date(transfer.transfer_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-center">{getTypeBadge(transfer.ledger_type || 'RAW')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{transfer.source_location?.location_name || '-'}</span>
                          {/* Bin info removed as it's typically line level not header level */}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{transfer.destination_location?.location_name || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{getStatusBadge(transfer.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
