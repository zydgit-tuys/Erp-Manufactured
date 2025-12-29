import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSalesInvoices, useReceivePayment } from '@/hooks/useInvoicing';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, FileText, Wallet, ArrowUpRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

export default function SalesInvoices() {
    const { companyId } = useApp();
    const { data: invoices, isLoading } = useSalesInvoices(companyId);
    const receivePayment = useReceivePayment();

    const [searchTerm, setSearchTerm] = useState('');
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');

    const handlePay = async () => {
        if (!selectedInvoice || !paymentAmount) return;
        await receivePayment.mutateAsync({ id: selectedInvoice.id, amount: parseFloat(paymentAmount) });
        setIsPayDialogOpen(false);
        setPaymentAmount('');
        setSelectedInvoice(null);
    };

    const filteredInvoices = invoices?.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'partial': return 'bg-blue-100 text-blue-800';
            case 'posted': return 'bg-purple-100 text-purple-800'; // Posted means sent/ready
            case 'draft': return 'bg-gray-100 text-gray-800';
            case 'overdue': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return (
            <AppLayout>
                <div className="p-8 space-y-4">
                    <Skeleton className="h-12 w-48" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in pb-10">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Sales Invoices</h1>
                        <p className="text-muted-foreground">Monitor accounts receivable and customer payments</p>
                    </div>
                    <Link to="/sales/new">
                        <Button variant="outline">
                            <ArrowUpRight className="mr-2 h-4 w-4" />
                            Go to Sales Orders
                        </Button>
                    </Link>
                </div>

                <div className="flex gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search by invoice # or customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="max-w-sm"
                    />
                </div>

                <Card>
                    <CardContent className="p-0">
                        {!filteredInvoices || filteredInvoices.length === 0 ? (
                            <EmptyState
                                icon={FileText}
                                title="No Invoices Found"
                                description="Sales invoices are generated automatically when you ship Sales Orders."
                                action={<Link to="/sales/new"><Button>Create Sales Order</Button></Link>}
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Received</TableHead>
                                        <TableHead className="text-right">Due</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                                            <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                                            <TableCell>{inv.customer?.name}</TableCell>
                                            <TableCell>{formatDate(inv.due_date)}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{formatCurrency(inv.amount_paid)}</TableCell>
                                            <TableCell className="text-right font-bold text-blue-600">{formatCurrency(inv.amount_due)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={getStatusColor(inv.payment_status || inv.status)}>
                                                    {(inv.payment_status || inv.status).toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.amount_due > 0 && inv.status === 'posted' && (
                                                    <Button size="sm" onClick={() => {
                                                        setSelectedInvoice(inv);
                                                        setPaymentAmount(inv.amount_due.toString());
                                                        setIsPayDialogOpen(true);
                                                    }}>
                                                        <Wallet className="mr-2 h-3 w-3" />
                                                        Receive
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Payment Dialog */}
                <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Receive Payment</DialogTitle>
                            <DialogDescription>
                                Record payment from {selectedInvoice?.customer?.name} for invoice {selectedInvoice?.invoice_number}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="gap-4 grid py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Amount Due</Label>
                                    <div className="text-2xl font-bold text-blue-600">{selectedInvoice && formatCurrency(selectedInvoice.amount_due)}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Received Amount</Label>
                                <Input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handlePay}>Confirm Receipt</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </AppLayout>
    );
}
