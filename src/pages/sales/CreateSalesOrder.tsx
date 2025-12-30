import { useState } from 'react';
import { MathHelper } from '@/lib/math';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash, ArrowLeft, Loader2, Save, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCreateSalesOrder } from '@/hooks/useSales';
import { useCustomers, useProducts } from '@/hooks/useMasterData';
import { useProductStocks } from '@/hooks/useInventory';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function CreateSalesOrder() {
    const navigate = useNavigate();
    const { companyId, warehouseId } = useApp();
    const { toast } = useToast();

    const { mutate: createSO, isPending: isSaving } = useCreateSalesOrder();
    const { data: customers } = useCustomers(companyId);
    const { data: products } = useProducts(companyId);
    const { data: stocks } = useProductStocks(companyId);

    // Form State
    const [customerId, setCustomerId] = useState('');
    const [soDate, setSoDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    // Line Items State
    const [items, setItems] = useState<{
        key: string;
        variantId: string;
        qty: number;
        price: number;
        discount: number;
    }[]>([
        { key: '1', variantId: '', qty: 1, price: 0, discount: 0 }
    ]);

    const handleAddItem = () => {
        setItems([...items, { key: Date.now().toString(), variantId: '', qty: 1, price: 0, discount: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const handleItemChange = async (index: number, field: 'variantId' | 'qty' | 'price' | 'discount', value: any) => {
        const newItems = [...items];

        if (field === 'variantId') {
            const product = products?.find(p => p.variants.some(v => v.id === value));
            const variant = product?.variants.find(v => v.id === value);

            if (variant) {
                // Default to standard price
                let finalPrice = variant.price;

                // Smart Pricing: Check last sold price if customer is selected
                if (customerId) {
                    const { data: lastPriceData } = await supabase.rpc('get_last_sold_price', {
                        p_customer_id: customerId,
                        p_variant_id: value
                    });

                    if (lastPriceData && lastPriceData.length > 0) {
                        finalPrice = lastPriceData[0].unit_price;
                        toast({
                            title: "Smart Pricing Applied",
                            description: `Applied last sold price: Rp ${finalPrice.toLocaleString('id-ID')}`,
                            duration: 2000
                        });
                    }
                }

                newItems[index].price = finalPrice;
            }
        }

        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => {
            const lineTotal = MathHelper.calculateLineTotal(item.qty, item.price, item.discount);
            return MathHelper.add(sum, lineTotal);
        }, 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!customerId) {
            toast({ title: "Validation Error", description: "Please select a customer", variant: "destructive" });
            return;
        }
        if (items.some(i => !i.variantId || i.qty <= 0)) {
            toast({ title: "Validation Error", description: "Please complete all line items with valid quantities", variant: "destructive" });
            return;
        }

        // Stock Validation Hook
        const insufficientStock = items.filter(item => {
            const stock = stocks?.find(s => s.product_variant_id === item.variantId)?.total_current_qty || 0;
            return item.qty > stock;
        });

        if (insufficientStock.length > 0) {
            // Warn but allow (backorder support)
            toast({
                title: "Stock Warning",
                description: "Some items exceed available stock. Order will be created as backorder.",
                variant: 'destructive' // Actually just warning
            });
        }

        createSO({
            customer_id: customerId,
            warehouse_id: warehouseId,
            so_date: soDate,
            notes: notes || undefined,
            items: items.map(i => ({
                variant_id: i.variantId,
                qty: i.qty,
                price: i.price,
                discount: i.discount
            }))
        }, {
            onSuccess: () => {
                navigate('/sales/orders');
            }
        });
    };

    // Flatten products for select options
    const variantOptions = products?.flatMap(p =>
        p.variants.map(v => {
            const stock = stocks?.find(s => s.product_variant_id === v.id)?.total_current_qty || 0;
            return {
                id: v.id,
                label: `${p.name} - ${v.sku} (${v.attributes?.color || ''} ${v.attributes?.size || ''})`,
                price: v.price,
                stock: stock
            };
        })
    ) || [];

    return (
        <AppLayout>
            <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in pb-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="icon" type="button" onClick={() => navigate('/sales/orders')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">New Sales Order</h1>
                            <p className="text-muted-foreground">
                                Create a new order for a regular customer
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={() => navigate('/sales/orders')}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Save Order
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* General Info */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>Order Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Customer</Label>
                                    <Select value={customerId} onValueChange={setCustomerId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers?.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Order Date</Label>
                                    <Input type="date" value={soDate} onChange={e => setSoDate(e.target.value)} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Notes</Label>
                                <Textarea
                                    placeholder="Shipping instructions or internal notes..."
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
                                        <Label className={index > 0 ? 'sr-only' : ''}>Product</Label>
                                        <Select value={item.variantId} onValueChange={(val) => handleItemChange(index, 'variantId', val)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Product" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {variantOptions.map(v => (
                                                    <SelectItem key={v.id} value={v.id}>
                                                        <div className="flex justify-between w-full gap-4">
                                                            <span>{v.label}</span>
                                                            <span className={`text-xs ${v.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                {v.stock > 0 ? `${v.stock} avail` : 'Out of Stock'}
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2 w-20">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Qty</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={item.qty}
                                            onChange={e => handleItemChange(index, 'qty', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid gap-2 w-32">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Price</Label>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={item.price}
                                                disabled
                                                className="bg-muted pr-8"
                                                readOnly
                                            />
                                            {customerId && <History className="h-3 w-3 absolute right-2 top-3 text-muted-foreground opacity-50" />}
                                        </div>
                                    </div>
                                    <div className="grid gap-2 w-20">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Disc %</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={item.discount}
                                            onChange={e => handleItemChange(index, 'discount', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="grid gap-2 w-32">
                                        <Label className={index > 0 ? 'sr-only' : ''}>Total</Label>
                                        <div className="h-10 flex items-center px-3 border rounded-md bg-muted font-mono text-sm">
                                            {MathHelper.calculateLineTotal(item.qty, item.price, item.discount).toLocaleString('id-ID')}
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
