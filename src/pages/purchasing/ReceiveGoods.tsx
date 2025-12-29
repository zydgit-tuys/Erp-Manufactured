import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2, PackageCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePurchaseOrder, useCreateGRN, usePostGRN } from '@/hooks/usePurchasing';
import { useBins } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function ReceiveGoods() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { companyId, warehouseId } = useApp();
    const { toast } = useToast();

    const { data: order, isLoading, error } = usePurchaseOrder(id || '');
    const { data: bins } = useBins(warehouseId);

    const createGRN = useCreateGRN();
    const postGRN = usePostGRN();

    const [receivedItems, setReceivedItems] = useState<{
        [key: string]: number // lineId -> qty
    }>({});

    const [isProcessing, setIsProcessing] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (order?.lines) {
            const initialReceived: { [key: string]: number } = {};
            order.lines.forEach(line => {
                const remaining = line.qty_ordered - (line.qty_received || 0); // ensuring not undefined
                initialReceived[line.id] = remaining > 0 ? remaining : 0;
            });
            setReceivedItems(initialReceived);
        }
    }, [order]);

    const handleQtyChange = (lineId: string, qty: number) => {
        setReceivedItems(prev => ({
            ...prev,
            [lineId]: qty
        }));
    };

    const handleReceive = async () => {
        // Validation: Ensure at least one item has > 0 qty
        const itemsToReceive = Object.entries(receivedItems).filter(([_, qty]) => qty > 0);
        if (itemsToReceive.length === 0) {
            toast({ title: "Nothing to receive", description: "Please enter quantity for at least one item.", variant: "destructive" });
            return;
        }

        if (!bins || bins.length === 0) {
            toast({ title: "No Bins Found", description: "Warehouse has no bins configured.", variant: "destructive" });
            return;
        }

        const defaultBinId = bins[0].id; // MVP: Use first bin

        setIsProcessing(true);
        try {
            // 1. Create Draft GRN
            // We map the received items to GRN Lines

            const grnPayload = {
                company_id: companyId,
                po_id: order?.id || '',
                vendor_id: order?.vendor_id || '',
                warehouse_id: warehouseId,
                grn_date: new Date().toISOString().split('T')[0], // Today
                notes: notes,
                items: itemsToReceive.map(([lineId, qty]) => {
                    const line = order?.lines?.find(l => l.id === lineId);
                    return {
                        po_line_id: lineId,
                        material_id: line?.material_id || '',
                        qty_received: qty,
                        unit_cost: line?.unit_price || 0,
                        bin_id: defaultBinId, // Using default bin for now
                        notes: `Recv from PO ${order?.po_number}`
                    };
                })
            };

            const grn = await createGRN.mutateAsync(grnPayload);

            // 2. Post GRN (updates Ledger and PO Status)
            await postGRN.mutateAsync(grn.id);

            // Success handled by hook onSuccess usually, but since we chain, we navigate here.

            navigate('/purchasing/receipts');
        } catch (err: any) {
            console.error(err);
            // Error toast handled by hook
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <AppLayout><div className="p-8"><Skeleton className="h-96 w-full" /></div></AppLayout>;
    if (error || !order) return <AppLayout><ErrorState title="Order not found" message={error?.message || ''} /></AppLayout>;

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" onClick={() => navigate('/purchasing/receipts')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Receive Goods</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span>PO: <span className="font-mono font-medium text-foreground">{order.po_number}</span></span>
                                <span>•</span>
                                <span>{order.vendor?.name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Items to Receive</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {order.lines.map((line) => {
                                    const remaining = line.qty_ordered - (line.qty_received || 0);
                                    const isComplete = remaining <= 0;

                                    return (
                                        <div key={line.id} className="flex gap-4 items-start border-b pb-4 last:border-0 last:pb-0">
                                            <div className="flex-1">
                                                <div className="font-medium">{line.material?.name}</div>
                                                <div className="text-sm text-muted-foreground mb-1">{line.material?.code}</div>
                                                <div className="flex gap-4 text-sm">
                                                    <div>Ordered: <span className="font-medium text-foreground">{line.qty_ordered}</span></div>
                                                    <div>Received: <span className="font-medium text-green-600">{line.qty_received || 0}</span></div>
                                                    <div>Remaining: <span className="font-medium text-orange-600">{remaining > 0 ? remaining : 0}</span></div>
                                                </div>
                                            </div>

                                            <div className="w-32">
                                                <Label className="text-xs text-muted-foreground">Receive Qty</Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    disabled={isComplete}
                                                    value={receivedItems[line.id]}
                                                    onChange={e => handleQtyChange(line.id, parseFloat(e.target.value))}
                                                    className={isComplete ? "bg-muted text-muted-foreground" : ""}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Receipt Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 bg-muted rounded-lg text-sm">
                                <h4 className="font-medium mb-2">Instructions</h4>
                                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                                    <li>Verify physical counts match receipt quantity.</li>
                                    <li>Items will be added to <strong>Warehouse {warehouseId}</strong>. in {companyId}</li>
                                    <li>Inventory levels will update immediately.</li>
                                </ul>
                            </div>

                            <div className="grid gap-2">
                                <Label>Notes / GRN Reference</Label>
                                <Textarea
                                    placeholder="Enter delivery note number or comments..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>

                            <Button
                                className="w-full"
                                onClick={handleReceive}
                                disabled={isProcessing || Object.values(receivedItems).every(q => q <= 0)}
                            >
                                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-2 h-4 w-4" />}
                                Confirm Receipt
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
