
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWorkOrders } from '@/hooks/useProduction';
import { Plus, Factory, Loader2, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

export default function WorkOrders() {
    const { data: workOrders, isLoading } = useWorkOrders();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
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
                        {workOrders && workOrders.length > 0 ? (
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
                                        <TableRow key={wo.id}>
                                            <TableCell className="font-mono">{wo.wo_number}</TableCell>
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
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Factory className="h-12 w-12 text-muted-foreground/50" />
                                <h3 className="mt-4 text-lg font-semibold">No Work Orders</h3>
                                <p className="max-w-sm text-sm text-muted-foreground mt-2">
                                    There are no active production orders. Create one to start manufacturing.
                                </p>
                                <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Work Order
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
