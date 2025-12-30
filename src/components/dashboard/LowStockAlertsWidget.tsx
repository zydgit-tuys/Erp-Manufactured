import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLowStockAlerts } from '@/hooks/useInventory';
import { useApp } from '@/contexts/AppContext';
import { AlertTriangle, ShoppingCart, Factory, ArrowRight } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export function LowStockAlertsWidget() {
    const { companyId } = useApp();
    const navigate = useNavigate();
    const { data: alerts, isLoading } = useLowStockAlerts(companyId);

    const handleOrder = (alert: any) => {
        if (alert.procurement_method === 'buy' || alert.procurement_method === 'both') {
            navigate(`/purchasing/new?item=${alert.variant_id}&vendor=${alert.preferred_vendor_id || ''}`);
        } else {
            // TODO: Redirect to Work Order creation
            // navigate(`/production/work-orders/new?item=${alert.variant_id}`);
        }
    };

    return (
        <Card className="shadow-card col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Low Stock Alerts
                </CardTitle>
                <CardDescription>
                    {isLoading ? 'Checking stock...' : `${alerts?.length || 0} items below reorder point`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <TableSkeleton rows={3} columns={3} />
                ) : !alerts || alerts.length === 0 ? (
                    <div className="py-4">
                        <EmptyState
                            icon={AlertTriangle}
                            title="Stock Healthy"
                            description="All items are above reorder levels."
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {alerts.slice(0, 5).map((alert) => (
                            <div key={alert.variant_id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${alert.procurement_method === 'buy' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {alert.procurement_method === 'buy' ? <ShoppingCart className="h-5 w-5" /> : <Factory className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm">{alert.product_name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {alert.sku} • Stock: <span className="text-destructive font-bold">{alert.current_stock}</span> / {alert.reorder_point} {alert.unit_of_measure}
                                        </div>
                                    </div>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => handleOrder(alert)}>
                                    {alert.procurement_method === 'buy' ? 'Order' : 'Produce'}
                                    <ArrowRight className="ml-2 h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                        {alerts.length > 5 && (
                            <Button variant="ghost" className="w-full text-xs text-muted-foreground">
                                View {alerts.length - 5} more items...
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
