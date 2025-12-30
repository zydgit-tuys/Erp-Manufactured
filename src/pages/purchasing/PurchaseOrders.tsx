import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PURCHASE_ORDER_STATUS } from '@/types/enums';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { POStatus } from '@/types/purchasing';
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
import { Plus, Search, ShoppingCart, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrders } from '@/hooks/usePurchasing';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';

export default function PurchaseOrders() {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { companyId } = useApp();

    const { data: orders, isLoading, error, refetch } = usePurchaseOrders(companyId);

    const filteredOrders = (orders || []).filter(
        (order) =>
            order.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.vendor?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case PURCHASE_ORDER_STATUS.DRAFT: return 'secondary';
            case PURCHASE_ORDER_STATUS.SUBMITTED: return 'default';
            case PURCHASE_ORDER_STATUS.APPROVED: return 'default'; // blue-ish usually
            case PURCHASE_ORDER_STATUS.PARTIAL: return 'warning';
            case PURCHASE_ORDER_STATUS.CLOSED: return 'success';
            case PURCHASE_ORDER_STATUS.CANCELLED: return 'destructive';
            default: return 'outline';
        }
    };

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load purchase orders"
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
                        <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
                        <p className="text-muted-foreground">
                            Manage procurement and vendor orders
                        </p>
                    </div>
                    <Button onClick={() => navigate('/purchasing/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create PO
                    </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Orders
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{orders?.length || 0}</div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Open Orders
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {orders?.filter(o => ([
                                    PURCHASE_ORDER_STATUS.DRAFT,
                                    PURCHASE_ORDER_STATUS.SUBMITTED,
                                    PURCHASE_ORDER_STATUS.APPROVED,
                                    PURCHASE_ORDER_STATUS.PARTIAL
                                ] as POStatus[]).includes(o.status)).length || 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Completed
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">
                                {orders?.filter(o => o.status === PURCHASE_ORDER_STATUS.CLOSED).length || 0}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search orders..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <TableSkeleton rows={5} columns={6} />
                        ) : filteredOrders.length === 0 ? (
                            <EmptyState
                                icon={ShoppingCart}
                                title={searchQuery ? "No orders found" : "No purchase orders yet"}
                                description={
                                    searchQuery
                                        ? "Try adjusting your search terms"
                                        : "Create your first purchase order to start procurement"
                                }
                                action={
                                    !searchQuery && (
                                        <Button onClick={() => navigate('/purchasing/new')}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Order
                                        </Button>
                                    )
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>PO Number</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Delivery Date</TableHead>
                                        <TableHead className="text-right">Total Amount</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => navigate(`/purchasing/orders/${order.id}`)}
                                        >
                                            <TableCell className="font-mono font-medium">
                                                {order.po_number}
                                            </TableCell>
                                            <TableCell>{order.vendor?.name}</TableCell>
                                            <TableCell>{format(new Date(order.po_date), 'MMM d, yyyy')}</TableCell>
                                            <TableCell>
                                                {order.delivery_date ? format(new Date(order.delivery_date), 'MMM d, yyyy') : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                Rp {order.total_amount.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={getStatusColor(order.status) as any}>
                                                    {order.status.toUpperCase()}
                                                </Badge>
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
