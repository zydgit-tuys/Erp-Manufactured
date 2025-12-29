
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useProductionOrders } from '@/hooks/useProduction';
import { Plus, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function WorkOrders() {
    const { companyId } = useApp();
    const { data: workOrders, isLoading, error, refetch } = useProductionOrders(companyId);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load Work Orders"
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
                        <h1 className="text-3xl font-bold tracking-tight">Work Orders</h1>
                        <p className="text-muted-foreground">
                            Manage production orders and track manufacturing progress
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Work Order
                    </Button>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardCheck className="h-5 w-5 text-primary" />
                            All Work Orders
                        </CardTitle>
                        <CardDescription>
                            Track status of production runs
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <TableSkeleton rows={5} columns={6} />
                        ) : !workOrders || workOrders.length === 0 ? (
                            <EmptyState
                                icon={ClipboardCheck}
                                title="No Work Orders"
                                description="There are no active production orders. Create one to start manufacturing."
                                action={
                                    <Button onClick={() => setIsCreateOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create Work Order
                                    </Button>
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>WO Number</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead>Qty Planned</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {workOrders.map((wo) => (
                                        <TableRow key={wo.id} className="cursor-pointer hover:bg-muted/50">
                                            <TableCell className="font-mono">{wo.po_number}</TableCell>
                                            <TableCell>{wo.product?.name}</TableCell>
                                            <TableCell>{wo.qty_planned}</TableCell>
                                            <TableCell>
                                                <Badge variant={wo.status === 'completed' ? 'default' : wo.status === 'in_progress' ? 'secondary' : 'outline'}>
                                                    {wo.status.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{new Date(wo.due_date).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm">View</Button>
                                            </TableCell>
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
