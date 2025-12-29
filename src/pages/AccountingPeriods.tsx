
import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Lock, Unlock, Plus } from 'lucide-react';
import { useAccountingPeriods, useCreateAccountingPeriod, useUpdateAccountingPeriod } from '@/hooks/useAccounting';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function AccountingPeriods() {
  const { companyId } = useApp();
  const { data: periods, isLoading, error, refetch } = useAccountingPeriods(companyId);
  const createPeriod = useCreateAccountingPeriod();
  const updatePeriod = useUpdateAccountingPeriod();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  // New Period State
  const [newPeriodData, setNewPeriodData] = useState({
    name: '',
    period_code: '',
    start_date: '',
    end_date: ''
  });

  const handleOpenCreate = () => {
    // Try to auto-suggest next period based on the last one
    let nextStart = startOfMonth(new Date());
    if (periods && periods.length > 0) {
      // Find latest period by date (assuming period_code or start_date sort)
      const sorted = [...periods].sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());
      const lastEnd = new Date(sorted[0].end_date);
      nextStart = startOfMonth(addMonths(lastEnd, 1));
    }

    const nextEnd = endOfMonth(nextStart);
    const monthName = format(nextStart, 'MMMM yyyy');
    const code = format(nextStart, 'yyyy-MM');

    setNewPeriodData({
      name: monthName,
      period_code: code,
      start_date: format(nextStart, 'yyyy-MM-dd'),
      end_date: format(nextEnd, 'yyyy-MM-dd')
    });

    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async () => {
    const start = new Date(newPeriodData.start_date);
    const fiscalYear = start.getFullYear();

    await createPeriod.mutateAsync({
      ...newPeriodData,
      fiscal_year: fiscalYear
    });
    setIsCreateOpen(false);
  };

  const handleClosePeriodClick = (periodId: string) => {
    setSelectedPeriod(periodId);
    setIsCloseConfirmOpen(true);
  };

  const confirmClosePeriod = async () => {
    if (selectedPeriod) {
      await updatePeriod.mutateAsync({
        id: selectedPeriod,
        updates: {
          status: 'closed',
          closed_at: new Date().toISOString()
        }
      });
      setIsCloseConfirmOpen(false);
      setSelectedPeriod(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  if (error) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load accounting periods"
          message={error.message}
          onRetry={() => refetch()}
        />
      </AppLayout>
    );
  }

  const periodList = periods || [];
  const openPeriods = periodList.filter(p => p.status === 'open').length;
  // const closedPeriods = periodList.filter(p => p.status === 'closed').length;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounting Periods</h1>
            <p className="text-muted-foreground">
              Manage fiscal periods and control transaction posting
            </p>
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create Next Period
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{periodList.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{openPeriods}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Periods</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : periodList.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No Accounting Periods"
                description="Create your first accounting period to start posting transactions."
                action={
                  <Button onClick={handleOpenCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Period
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodList.map((period) => (
                    <TableRow key={period.id}>
                      <TableCell className="font-mono">{period.period_code}</TableCell>
                      <TableCell>{period.name}</TableCell>
                      <TableCell>{formatDate(period.start_date)}</TableCell>
                      <TableCell>{formatDate(period.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={period.status === 'open' ? 'success' : 'secondary'}>
                          {period.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {period.status === 'open' ? (
                          <Button variant="ghost" size="sm" onClick={() => handleClosePeriodClick(period.id)} className="text-amber-600 hover:text-amber-700">
                            <Lock className="h-4 w-4 mr-1" /> Close
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled className="opacity-50">
                            <Lock className="h-4 w-4 mr-1" /> Closed
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Accounting Period</DialogTitle>
              <DialogDescription>Define the date range for the new fiscal period.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Name</Label>
                <Input value={newPeriodData.name} onChange={e => setNewPeriodData({ ...newPeriodData, name: e.target.value })} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Code</Label>
                <Input value={newPeriodData.period_code} onChange={e => setNewPeriodData({ ...newPeriodData, period_code: e.target.value })} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Start</Label>
                <Input type="date" value={newPeriodData.start_date} onChange={e => setNewPeriodData({ ...newPeriodData, start_date: e.target.value })} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">End</Label>
                <Input type="date" value={newPeriodData.end_date} onChange={e => setNewPeriodData({ ...newPeriodData, end_date: e.target.value })} className="col-span-3" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateSubmit} disabled={createPeriod.isPending}>Create Period</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Close Confirmation Dialog */}
        <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Close Accounting Period?</DialogTitle>
              <DialogDescription>
                Closing a period will prevent any further transactions from being posted to it. This action usually cannot be undone easily.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCloseConfirmOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmClosePeriod} disabled={updatePeriod.isPending}>Close Period</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
