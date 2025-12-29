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
import { Plus, Search, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';

export default function GoodsReceipts() {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { companyId } = useApp();

    const { data: orders, isLoading, error, refetch } = usePurchaseOrders(companyId);

    // Filter for orders that have partial or full receipts, OR are ready to confirm
    // Actually, maybe we just show POs that are 'submitted', 'approved', 'partial' as actionable for receipts
    const receiptableOrders = (orders || []).filter(order =>
        ['submitted', 'approved', 'partial', 'closed'].includes(order.status)
    );

    const filteredOrders = receiptableOrders.filter(
        (order) =>
            order.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load receipts"
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
                        <h1 className="text-3xl font-bold tracking-tight">Goods Receipts</h1>
                        <p className="text-muted-foreground">
                            Process incoming shipments from vendors
                        </p>
                    </div>
                    {/* <Button onClick={() => navigate('/purchasing/receive')}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Receipt
                    </Button> */}
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by PO or Vendor..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <TableSkeleton rows={5} columns={5} />
                        ) : filteredOrders.length === 0 ? (
                            <EmptyState
                                icon={PackageCheck}
                                title={searchQuery ? "No matching orders" : "No pending receipts"}
                                description={
                                    searchQuery
                                        ? "Try adjusting your search terms"
                                        : "There are no approved purchase orders to receive items from."
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className="hover:bg-muted/50"
                                        >
                                            <TableCell className="font-mono font-medium">
                                                {order.po_number}
                                            </TableCell>
                                            <TableCell>{order.vendor?.name}</TableCell>
                                            <TableCell>{format(new Date(order.po_date), 'MMM d, yyyy')}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={order.status === 'closed' ? 'success' : order.status === 'partial' ? 'warning' : 'default'}>
                                                    {order.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {order.status !== 'closed' && (
                                                    <Button size="sm" variant="outline" onClick={() => navigate(`/purchasing/receive/${order.id}`)}>
                                                        Receive
                                                    </Button>
                                                )}
                                                {order.status === 'closed' && (
                                                    <Button size="sm" variant="ghost" onClick={() => navigate(`/purchasing/receive/${order.id}`)}>
                                                        View
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
            </div>
        </AppLayout>
    );
}
