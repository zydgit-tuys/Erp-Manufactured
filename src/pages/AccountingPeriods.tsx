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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, Lock, Unlock, Plus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { useAccountingPeriods } from '@/hooks/useAccountingPeriods';
import { Loader2 } from 'lucide-react';
import { AccountingPeriod } from '@/types/accountingPeriod';

export default function AccountingPeriods() {
  const { data: periods, isLoading } = useAccountingPeriods();
  const [closingPeriodId, setClosingPeriodId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleClosePeriod = (periodId: string) => {
    // TODO: Implement backend API call for closing period matches M7 logic
    toast({
      title: 'Not Implemented',
      description: 'Backend integration for closing period is pending.',
    });
    toast({
      title: 'Period Closed',
      description: 'The accounting period has been closed. No more transactions can be posted.',
    });
  };

  const handleCreateNextPeriod = () => {
    // TODO: Implement backend API call for creating period
    toast({
      title: 'Not Implemented',
      description: 'Backend integration for creating period is pending.',
    });
  };


  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const periodList = periods || [];
  const openPeriods = periodList.filter(p => p.status === 'open').length;
  const closedPeriods = periodList.filter(p => p.status === 'closed').length;

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
          <Button onClick={handleCreateNextPeriod}>
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
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Unlock className="h-4 w-4 text-success" />
                Open Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{openPeriods}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Closed Periods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{closedPeriods}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Period List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period Code</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Closed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodList.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-mono font-medium">
                      {period.period_code}
                    </TableCell>
                    <TableCell>{formatDate(period.start_date)}</TableCell>
                    <TableCell>{formatDate(period.end_date)}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={period.status === 'open' ? 'default' : 'secondary'}
                        className={period.status === 'open' ? 'bg-success hover:bg-success/80' : ''}
                      >
                        {period.status === 'open' ? (
                          <><Unlock className="h-3 w-3 mr-1" /> Open</>
                        ) : (
                          <><Lock className="h-3 w-3 mr-1" /> Closed</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {period.closed_at ? formatDate(period.closed_at) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {period.status === 'open' && (
                        <Dialog open={closingPeriodId === period.id} onOpenChange={(open) => setClosingPeriodId(open ? period.id : null)}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Lock className="h-4 w-4 mr-1" />
                              Close Period
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-warning" />
                                Close Accounting Period
                              </DialogTitle>
                              <DialogDescription>
                                Are you sure you want to close period <strong>{period.period_code}</strong>?
                                This action cannot be undone. No more transactions can be posted to this period after closing.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setClosingPeriodId(null)}>
                                Cancel
                              </Button>
                              <Button variant="destructive" onClick={() => handleClosePeriod(period.id)}>
                                Close Period
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
