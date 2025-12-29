import { useState } from 'react';
import { PaymentMethod } from '@/types/sales';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Search, ShoppingCart, CreditCard, Banknote, QrCode,
    Trash, Plus, Minus, RefreshCw, Loader2, ArrowLeft, ShoppingBag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubmitPOSOrder } from '@/hooks/useSales';
import { useProducts } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function POS() {
    const navigate = useNavigate();
    const { companyId, warehouseId } = useApp();
    const { toast } = useToast();

    // Data Loading
    const { data: products, isLoading } = useProducts(companyId);
    const { mutate: submitOrder, isPending } = useSubmitPOSOrder();

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<{
        variantId: string;
        name: string;
        sku: string;
        price: number;
        qty: number;
    }[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
    const [amountTendered, setAmountTendered] = useState<number | ''>('');

    // Filter Products
    const filteredProducts = products?.flatMap(p =>
        p.variants.map(v => ({
            ...v,
            productName: p.name,
            image: null // Placeholder for image if we had it
        }))
    ).filter(v =>
        v.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.sku.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    // Cart Actions
    const addToCart = (variant: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.variantId === variant.id);
            if (existing) {
                return prev.map(item =>
                    item.variantId === variant.id
                        ? { ...item, qty: item.qty + 1 }
                        : item
                );
            }
            return [...prev, {
                variantId: variant.id,
                name: `${variant.productName} (${variant.sku})`,
                sku: variant.sku,
                price: variant.price,
                qty: 1
            }];
        });
    };

    const updateQty = (variantId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.variantId === variantId) {
                const newQty = item.qty + delta;
                return newQty > 0 ? { ...item, qty: newQty } : item;
            }
            return item;
        }));
    };

    const removeFromCart = (variantId: string) => {
        setCart(prev => prev.filter(item => item.variantId !== variantId));
    };

    const clearCart = () => setCart([]);

    // Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const tax = 0; // Configurable later
    const total = subtotal + tax;
    const change = (typeof amountTendered === 'number' ? amountTendered : 0) - total;

    // Submit
    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (paymentMethod === 'CASH' && (typeof amountTendered !== 'number' || amountTendered < total)) {
            toast({ title: 'Invalid Payment', description: 'Amount tendered is insufficient.', variant: 'destructive' });
            return;
        }

        submitOrder({
            warehouse_id: warehouseId,
            sale_date: new Date().toISOString().split('T')[0],
            items: cart.map(i => ({
                variant_id: i.variantId,
                qty: i.qty,
                price: i.price,
                discount: 0
            })),
            payment_method: paymentMethod,
            amount_tendered: typeof amountTendered === 'number' ? amountTendered : undefined,
            notes: 'POS Sale'
        }, {
            onSuccess: () => {
                clearCart();
                setAmountTendered('');
            }
        });
    };

    return (
        <div className="flex h-screen bg-background overflow-hidden animate-fade-in">
            {/* Left: Product Grid */}
            <div className="flex-1 flex flex-col border-r">
                <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search products..."
                            className="pl-10 h-10"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4 bg-muted/10">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-full text-muted-foreground">
                            <Search className="h-12 w-12 mb-4 opacity-20" />
                            <p>No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(variant => (
                                <button
                                    key={variant.id}
                                    onClick={() => addToCart(variant)}
                                    className="flex flex-col text-left bg-card hover:bg-accent/50 border rounded-lg overflow-hidden transition-all shadow-sm hover:shadow-md group"
                                >
                                    <div className="h-32 bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-muted/80 transition-colors">
                                        {/* Placeholder for Product Image */}
                                        <ShoppingBag className="h-8 w-8 opacity-20" />
                                    </div>
                                    <div className="p-3">
                                        <div className="font-semibold truncate">{variant.productName}</div>
                                        <div className="text-xs text-muted-foreground mb-2">{variant.sku}</div>
                                        <div className="font-mono font-bold text-primary">
                                            Rp {variant.price.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* Right: Cart & Checkout */}
            <div className="w-[400px] flex flex-col bg-card shadow-xl z-10">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="font-bold text-lg flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Current Sale
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearCart} disabled={cart.length === 0} className="text-destructive hover:text-destructive">
                        <Trash className="h-4 w-4 mr-2" />
                        Clear
                    </Button>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                            <ShoppingCart className="h-12 w-12" />
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.variantId} className="flex gap-3 bg-muted/30 p-2 rounded-lg items-center">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium truncate">{item.name}</div>
                                        <div className="text-sm font-mono text-muted-foreground">
                                            {item.qty} x Rp {item.price.toLocaleString('id-ID')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQty(item.variantId, -1)}>
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center font-mono text-sm">{item.qty}</span>
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => addToCart({ id: item.variantId })}>
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <div className="font-mono font-bold w-20 text-right">
                                        {(item.price * item.qty).toLocaleString('id-ID')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="border-t p-4 space-y-4 bg-muted/10">
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-mono">Rp {subtotal.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span className="font-mono">Rp {tax}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total</span>
                            <span>Rp {total.toLocaleString('id-ID')}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                            onClick={() => setPaymentMethod('CASH')}
                            className="flex flex-col h-auto py-2 gap-1"
                        >
                            <Banknote className="h-4 w-4" />
                            <span className="text-xs">Cash</span>
                        </Button>
                        <Button
                            variant={paymentMethod === 'CREDIT_CARD' ? 'default' : 'outline'}
                            onClick={() => setPaymentMethod('CREDIT_CARD')}
                            className="flex flex-col h-auto py-2 gap-1"
                        >
                            <CreditCard className="h-4 w-4" />
                            <span className="text-xs">Card</span>
                        </Button>
                        <Button
                            variant={paymentMethod === 'BANK_TRANSFER' ? 'default' : 'outline'}
                            onClick={() => setPaymentMethod('BANK_TRANSFER')}
                            className="flex flex-col h-auto py-2 gap-1"
                        >
                            <QrCode className="h-4 w-4" />
                            <span className="text-xs">QRIS / Transfer</span>
                        </Button>
                    </div>

                    {paymentMethod === 'CASH' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs w-16">Tendered</Label>
                                <Input
                                    type="number"
                                    placeholder="Amount received"
                                    value={amountTendered}
                                    onChange={e => setAmountTendered(e.target.value ? parseFloat(e.target.value) : '')}
                                    className="font-mono text-right"
                                />
                            </div>
                            <div className="flex justify-between items-center bg-muted/50 p-2 rounded text-sm">
                                <span className={change < 0 ? 'text-destructive' : 'text-success'}>Change</span>
                                <span className={`font-mono font-bold ${change < 0 ? 'text-destructive' : 'text-success'}`}>
                                    Rp {(change > 0 ? change : 0).toLocaleString('id-ID')}
                                </span>
                            </div>
                        </div>
                    )}

                    <Button
                        size="lg"
                        className="w-full font-bold text-lg h-14"
                        disabled={cart.length === 0 || isPending}
                        onClick={handleCheckout}
                    >
                        {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShoppingCart className="mr-2 h-5 w-5" />}
                        Complete Sale
                    </Button>
                </div>
            </div>
        </div>
    );
}
