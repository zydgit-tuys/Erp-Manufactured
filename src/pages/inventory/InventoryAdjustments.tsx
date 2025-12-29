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
  ClipboardCheck,
  FileText,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useApp } from '@/contexts/AppContext';
import { useInventoryAdjustments } from '@/hooks/useInventory';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function InventoryAdjustments() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  const { companyId } = useApp();

  const {
    data: adjustments,
    isLoading,
    error,
    refetch
  } = useInventoryAdjustments(companyId);

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

  const getReasonBadge = (reason: string) => {
    const reasons: Record<string, string> = {
      'STOCK_OPNAME': 'Stock Opname',
      'DAMAGED': 'Damaged',
      'EXPIRED': 'Expired',
      'THEFT': 'Theft',
      'CORRECTION': 'Correction',
      'OTHER': 'Other'
    };
    return <Badge variant="outline">{reasons[reason] || reason}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'RAW':
        return <Badge className="bg-info/10 text-info border-info/20">Raw Material</Badge>;
      case 'WIP':
        return <Badge className="bg-warning/10 text-warning border-warning/20">WIP</Badge>;
      case 'FG':
        return <Badge className="bg-success/10 text-success border-success/20">Finished Goods</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredAdjustments = (adjustments || []).filter((a: any) => {
    const matchesSearch = a.adjustment_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const draftCount = (adjustments || []).filter((a: any) => a.status === 'draft').length;
  const postedCount = (adjustments || []).filter((a: any) => a.status === 'posted').length;
  // Note: total variance calculation assumes we have access to line items or a total field, 
  // checking type definition if needed, but for now assuming it might be on the main object or we skip logic that needs lines.
  // Actually, standard list response usually doesn't include deep lines sum unless aggregated view.
  // I will check if adjustment object has a total_value or similar. If not, I'll display count or 0.
  // Adjustments usually don't have a single "value" unless signed. I'll omit value sum if not readily available or use 0.
  const totalVariance = 0;

  if (error) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load inventory adjustments"
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
            <h1 className="text-3xl font-bold tracking-tight">Inventory Adjustments</h1>
            <p className="text-muted-foreground">
              Manage stock opname and inventory corrections
            </p>
          </div>
          <Button onClick={() => navigate('/inventory/adjustments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Adjustment
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" /> Total Adjustments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adjustments?.length || 0}</div>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Variance (Posted)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalVariance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {/* Value removed as it's not readily available in list view without aggregation */}
                -
              </div>
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
                  placeholder="Search adjustments..."
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
            ) : filteredAdjustments.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No adjustments found"
                description={
                  searchQuery
                    ? "No adjustments match your search criteria"
                    : "Create your first inventory adjustment to get started"
                }
                action={
                  !searchQuery && (
                    <Button onClick={() => navigate('/inventory/adjustments/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Adjustment
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
                    <TableHead className="text-center">Reason</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdjustments.map((adjustment: any) => (
                    <TableRow
                      key={adjustment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/inventory/adjustments/${adjustment.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{adjustment.adjustment_number}</TableCell>
                      <TableCell>{format(new Date(adjustment.adjustment_date), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-center">{getTypeBadge(adjustment.adjustment_type || 'RAW')}</TableCell>
                      <TableCell className="text-center">{getReasonBadge(adjustment.reason)}</TableCell>
                      <TableCell className="text-center">{getStatusBadge(adjustment.status)}</TableCell>
                      <TableCell className="text-sm">{adjustment.created_by_user?.email || '-'}</TableCell>
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
