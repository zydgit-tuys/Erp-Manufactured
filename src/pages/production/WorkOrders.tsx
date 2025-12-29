
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useProductionOrders, useCreateProductionOrder, useBOMs } from '@/hooks/useProduction';
import { useProducts, useWarehouses } from '@/hooks/useMasterData';
import { useAccountingPeriods } from '@/hooks/useAccounting';
import { Plus, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function WorkOrders() {
    const { companyId } = useApp();
    const { data: workOrders, isLoading, error, refetch } = useProductionOrders(companyId);
    const { data: products } = useProducts(companyId);
    const { data: warehouses } = useWarehouses(companyId);
    const { data: periods } = useAccountingPeriods(companyId);
    const { data: boms } = useBOMs(companyId);

    const createWO = useCreateProductionOrder();

    // State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [formData, setFormData] = useState({
        po_number: '',
        product_id: '',
        bom_id: '',
        warehouse_id: '',
        qty_planned: 0,
        due_date: new Date().toISOString().split('T')[0],
        period_id: ''
    });

    // Auto-select BOM and Warehouse when Product changes (if possible)
    const handleProductChange = (productId: string) => {
        const productBOMs = boms?.filter(b => b.product_id === productId && b.is_active);
        const defaultBOM = productBOMs && productBOMs.length > 0 ? productBOMs[0].id : '';

        // Find default warehouse if any (not strictly linked but good UX to reset)

        setFormData(prev => ({
            ...prev,
            product_id: productId,
            bom_id: defaultBOM
        }));
    };

    const handleCreate = async () => {
        try {
            // Basic validation
            if (!formData.po_number || !formData.product_id || !formData.bom_id || !formData.warehouse_id || !formData.period_id) {
                // Rely on HTML5 validation or show toast
                return;
            }

            await createWO.mutateAsync({
                ...formData,
                po_date: new Date().toISOString().split('T')[0], // Today
                qty_planned: Number(formData.qty_planned)
            });
            setIsCreateOpen(false);
            // Reset form
            setFormData({
                po_number: '',
                product_id: '',
                bom_id: '',
                warehouse_id: '',
                qty_planned: 0,
                due_date: new Date().toISOString().split('T')[0],
                period_id: ''
            });
        } catch (error) {
            // Handled by hook
        }
    };

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

    // Identify active period if not selected
    const activePeriod = periods?.find(p => p.status === 'open');
    if (!formData.period_id && activePeriod) {
        setFormData(prev => ({ ...prev, period_id: activePeriod.id }));
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
                                            <TableCell>{new Date(wo.due_date || '').toLocaleDateString()}</TableCell>
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

                {/* Create Production Order Dialog */}
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Create Work Order</DialogTitle>
                            <DialogDescription>Plan a new production run based on a BOM.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="po_number" className="text-right">PO Number</Label>
                                <Input id="po_number" value={formData.po_number} onChange={e => setFormData({ ...formData, po_number: e.target.value })} className="col-span-3" placeholder="e.g. PO-2024-001" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="product" className="text-right">Product</Label>
                                <Select onValueChange={handleProductChange} value={formData.product_id}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select Product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products?.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="bom" className="text-right">BOM Version</Label>
                                <Select onValueChange={val => setFormData({ ...formData, bom_id: val })} value={formData.bom_id} disabled={!formData.product_id}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={!formData.product_id ? "Select Product First" : "Select BOM"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {boms?.filter(b => b.product_id === formData.product_id && b.is_active).map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.version} (Yield: {b.yield_percentage}%)</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="warehouse" className="text-right">FG Warehouse</Label>
                                <Select onValueChange={val => setFormData({ ...formData, warehouse_id: val })} value={formData.warehouse_id}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Target Warehouse" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses?.map(w => (
                                            <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="period" className="text-right">Acct Period</Label>
                                <Select onValueChange={val => setFormData({ ...formData, period_id: val })} value={formData.period_id}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Select Period" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {periods?.filter(p => p.status === 'open').map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="qty" className="text-right">Qty Planned</Label>
                                <Input id="qty" type="number" value={formData.qty_planned} onChange={e => setFormData({ ...formData, qty_planned: Number(e.target.value) })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="due" className="text-right">Due Date</Label>
                                <Input id="due" type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} className="col-span-3" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreate} disabled={createWO.isPending}>Create Order</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
