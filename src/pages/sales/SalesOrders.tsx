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
import { Plus, Search, Eye, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSalesOrders } from '@/hooks/useSales';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { format } from 'date-fns';

export default function SalesOrders() {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();
    const { companyId } = useApp();

    const { data: orders, isLoading, error, refetch } = useSalesOrders(companyId);

    const filteredOrders = orders?.filter(
        (order) =>
            order.so_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
        switch (status) {
            case 'completed': return 'success';
            case 'approved': return 'default'; // Or blue
            case 'in_delivery': return 'warning';
            case 'sent': return 'secondary';
            case 'cancelled': return 'destructive';
            default: return 'outline'; // draft
        }
    };

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load sales orders"
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
                        <h1 className="text-3xl font-bold tracking-tight">Sales Orders</h1>
                        <p className="text-muted-foreground">
                            Manage distributor and B2B orders
                        </p>
                    </div>
                    <Button onClick={() => navigate('/sales/new')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Order
                    </Button>
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
                                icon={ShoppingBag}
                                title={searchQuery ? "No matching orders" : "No sales orders found"}
                                description={
                                    searchQuery
                                        ? "Try adjusting your search terms"
                                        : "Get started by creating a new sales order for your distributors."
                                }
                                action={
                                    !searchQuery ? (
                                        <Button onClick={() => navigate('/sales/new')}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Create Order
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Order #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Total</TableHead>
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
                                                <Badge variant={getStatusVariant(order.status)}>
                                                    {order.status.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => navigate(`/sales/orders/${order.id}`)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View
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
