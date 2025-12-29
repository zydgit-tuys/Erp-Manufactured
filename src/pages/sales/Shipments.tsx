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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Package, Truck, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSalesOrders } from '@/hooks/useSales';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';

export default function Shipments() {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { companyId } = useApp();

    const { data: orders, isLoading, error, refetch } = useSalesOrders(companyId);

    // Filter for orders that are approved but not yet fully shipped
    const shippableOrders = orders?.filter(order =>
        ['approved', 'partial', 'in_delivery'].includes(order.status)
    );

    const filteredOrders = shippableOrders?.filter(
        (order) =>
            order.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load shipments"
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
                        <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
                        <p className="text-muted-foreground">
                            Process outbound deliveries for sales orders
                        </p>
                    </div>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search order # or customer..."
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
                        ) : filteredOrders?.length === 0 ? (
                            <EmptyState
                                icon={Truck}
                                title={searchQuery ? "No matching orders" : "No pending shipments"}
                                description={
                                    searchQuery
                                        ? "Try adjusting your search terms"
                                        : "There are no approved sales orders waiting to be shipped."
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Order Date</TableHead>
                                        <TableHead>Total Value</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredOrders?.map((order) => (
                                        <TableRow
                                            key={order.id}
                                            className="hover:bg-muted/50 transition-colors"
                                        >
                                            <TableCell className="font-mono font-medium">
                                                {order.so_number}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {order.customer?.name}
                                            </TableCell>
                                            <TableCell>{format(new Date(order.so_date), 'MMM d, yyyy')}</TableCell>
                                            <TableCell className="font-mono">
                                                Rp {order.total_amount.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={order.status === 'in_delivery' ? 'warning' : 'default'}>
                                                    {order.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => navigate(`/sales/ship/${order.id}`)}
                                                >
                                                    <Package className="h-4 w-4 mr-2" />
                                                    Ship
                                                </Button>
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
