import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash, ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCreatePurchaseOrder } from '@/hooks/usePurchasing';
import { useVendors, useProducts } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { useMaterials } from '@/hooks/useMaterials';

export default function CreatePurchaseOrder() {
    const navigate = useNavigate();
    const { companyId, warehouseId } = useApp();
    const { toast } = useToast();

    const { mutate: createPO, isPending: isSaving } = useCreatePurchaseOrder();
    const { data: vendors } = useVendors(companyId);
    const { data: materials } = useMaterials(); // using existing hook

    // Form State
    const [vendorId, setVendorId] = useState('');
    const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
    const [deliveryDate, setDeliveryDate] = useState('');
    const [notes, setNotes] = useState('');

    // Line Items State
    const [items, setItems] = useState<{
        key: string; // unique key for rendering
        materialId: string;
        qty: number;
        price: number;
    }[]>([
        { key: '1', materialId: '', qty: 1, price: 0 }
    ]);

    const handleAddItem = () => {
        setItems([...items, { key: Date.now().toString(), materialId: '', qty: 1, price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = (index: number, field: 'materialId' | 'qty' | 'price', value: any) => {
        const newItems = [...items];
        if (field === 'materialId') {
            // Find default price or other details if needed
            const material = materials?.find(m => m.id === value);
            // We could look up last purchase price here if we had that data
        }
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!vendorId) {
            toast({ title: "Validation Error", description: "Please select a vendor", variant: "destructive" });
            return;
        }
        if (items.some(i => !i.materialId || i.qty <= 0)) {
            toast({ title: "Validation Error", description: "Please complete all line items with valid quantities", variant: "destructive" });
            return;
        }

        createPO({
            vendor_id: vendorId,
            warehouse_id: warehouseId,
            po_date: poDate,
            delivery_date: deliveryDate || undefined,
            notes: notes || undefined,
            items: items.map(i => ({
                material_id: i.materialId,
                qty_ordered: i.qty,
                unit_price: i.price
            }))
        }, {
            onSuccess: () => {
                navigate('/purchasing/orders');
            }
        });
    };

    return (
        <AppLayout>
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in pb-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" type="button" onClick={() => navigate('/purchasing/orders')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">New Purchase Order</h1>
                            <p className="text-muted-foreground">
                                Create a new order for a vendor
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={() => navigate('/purchasing/orders')}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Order
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* General Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Order Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Vendor</Label>
                                <Select value={vendorId} onValueChange={setVendorId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Vendor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vendors?.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name} ({v.code})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Order Date</Label>
                                    <Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Expected Delivery</Label>
                                    <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Notes</Label>
                                <Textarea
                                    placeholder="Additional instructions or terms..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Subtotal</span>
                                    <span className="font-mono">Rp {calculateTotal().toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="font-mono">Rp 0</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>Total</span>
                                    <span>Rp {calculateTotal().toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Line Items */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Items</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {items.map((item, index) => (
                                <div key={item.key} className="flex gap-4 items-end border-b pb-4 last:border-0 last:pb-0">
                                    <div className="grid gap-2 flex-1">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Material</Label>
                                        <Select value={item.materialId} onValueChange={(val) => handleItemChange(index, 'materialId', val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Material" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {materials?.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>{m.name} ({m.code}) - {m.unit_of_measure}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2 w-24">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Qty</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.qty}
                                            onChange={e => handleItemChange(index, 'qty', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid gap-2 w-36">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Unit Price</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={item.price}
                                            onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid gap-2 w-32">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Total</Label>
                                        <div className="h-10 flex items-center px-3 border rounded-md bg-muted font-mono text-sm">
                                            {(item.qty * item.price).toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/80 mb-0.5"
                                        onClick={() => handleRemoveItem(index)}
                                        disabled={items.length === 1}
                                    >
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </form>
        </AppLayout>
    );
}
