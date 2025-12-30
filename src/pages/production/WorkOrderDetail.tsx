
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProductionOrder, useReleaseProductionOrder, useRecordOutput } from '@/hooks/useProduction';
import { ArrowLeft, Play, PackageCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { useState } from 'react';

export default function WorkOrderDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Hooks
    const { data: wo, isLoading, error } = useProductionOrder(id!);
    const releaseWO = useReleaseProductionOrder();
    const recordOutput = useRecordOutput();

    // State
    const [isOutputOpen, setIsOutputOpen] = useState(false);
    const [outputQty, setOutputQty] = useState(0);

    if (error) {
        return (
            <AppLayout>
                <ErrorState title="Failed to load Work Order" message={error.message} />
            </AppLayout>
        );
    }

    if (isLoading || !wo) {
        return (
            <AppLayout>
                <div className="space-y-6 animate-pulse">
                    <div className="h-8 w-48 bg-muted rounded" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
            </AppLayout>
        );
    }

    // Actions
    const handleRelease = async () => {
        try {
            await releaseWO.mutateAsync(wo.id);
        } catch (e) {
            // handled
        }
    };

    const handleRecordOutput = async () => {
        try {
            if (outputQty <= 0) {
                toast({ variant: "destructive", title: "Invalid Quantity", description: "Output quantity must be greater than 0" });
                return;
            }
            await recordOutput.mutateAsync({ id: wo.id, qty: outputQty });
            setIsOutputOpen(false);
            setOutputQty(0);
        } catch (e) {
            // handled
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'default';
            case 'in_progress': return 'secondary';
            case 'planned': return 'outline';
            default: return 'outline';
        }
    };

    const progress = wo.qty_planned > 0 ? Math.min(100, (wo.qty_completed / wo.qty_planned) * 100) : 0;

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/production/work-orders')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">WO: {wo.po_number}</h1>
                            <p className="text-muted-foreground">PRODUCTION ORDER</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor(wo.status)} className="text-lg px-4 py-1">
                            {wo.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Key Info */}
                    <Card className="md:col-span-2 shadow-card">
                        <CardHeader>
                            <CardTitle>Production Details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-muted-foreground">Product</Label>
                                <div className="text-lg font-medium">{wo.product?.name}</div>
                                <div className="text-sm font-mono text-muted-foreground">{wo.product?.code}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Warehouse</Label>
                                <div className="text-lg font-medium">{wo.warehouse?.name}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">BOM Version</Label>
                                <div className="font-medium">{wo.bom?.version}</div>
                            </div>
                            <div>
                                <Label className="text-muted-foreground">Dates</Label>
                                <div className="text-sm">Due: {new Date(wo.due_date || '').toLocaleDateString()}</div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Actions Card */}
                    <Card className="shadow-card">
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>Manage production lifecycle</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {wo.status === 'planned' && (
                                <Button className="w-full" onClick={handleRelease} disabled={releaseWO.isPending}>
                                    <Play className="mr-2 h-4 w-4" /> Release Order
                                </Button>
                            )}

                            {wo.status === 'in_progress' && (
                                <Button className="w-full" variant="secondary" onClick={() => setIsOutputOpen(true)}>
                                    <PackageCheck className="mr-2 h-4 w-4" /> Record Output
                                </Button>
                            )}

                            {wo.status === 'completed' && (
                                <div className="flex items-center justify-center p-4 bg-muted/50 rounded-lg text-green-600 font-medium">
                                    <CheckCircle className="mr-2 h-5 w-5" /> Order Completed
                                </div>
                            )}

                            {wo.status === 'planned' && (
                                <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md text-sm flex items-start">
                                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                                    Releasing this order will check stock availability and reserve raw materials.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Progress Card */}
                    <Card className="md:col-span-3 shadow-card">
                        <CardHeader>
                            <CardTitle>Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Planned: <strong>{wo.qty_planned}</strong> {wo.product?.unit_of_measure}</span>
                                    <span>Completed: <strong>{wo.qty_completed}</strong> {wo.product?.unit_of_measure}</span>
                                </div>
                                <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                                </div>
                                <p className="text-center text-sm text-muted-foreground">{Math.round(progress)}% Complete</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Record Output Dialog */}
                <Dialog open={isOutputOpen} onOpenChange={setIsOutputOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Record Production Output</DialogTitle>
                            <DialogDescription>Enter the quantity of finished goods produced.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label>Quantity Produced</Label>
                            <Input
                                type="number"
                                value={outputQty}
                                onChange={(e) => setOutputQty(Number(e.target.value))}
                                min={0}
                                className="mt-2"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Current Completed: {wo.qty_completed}. Total Planned: {wo.qty_planned}.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleRecordOutput} disabled={recordOutput.isPending}>Save Output</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
