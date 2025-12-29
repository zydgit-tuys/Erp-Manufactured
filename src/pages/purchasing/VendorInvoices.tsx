import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useVendorInvoices, usePayVendorInvoice, useCreateVendorInvoice } from '@/hooks/useInvoicing';
import { useApp } from '@/contexts/AppContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, FileText, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVendors } from '@/hooks/useMasterData';
import { useAccountingPeriods } from '@/hooks/useAccounting';

export default function VendorInvoices() {
    const { companyId } = useApp();
    const { data: invoices, isLoading } = useVendorInvoices(companyId);
    const { data: vendors } = useVendors(companyId);
    const { data: periods } = useAccountingPeriods(companyId);

    const createInvoice = useCreateVendorInvoice();
    const payInvoice = usePayVendorInvoice();

    const [searchTerm, setSearchTerm] = useState('');
    const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');

    // Create Form State
    const [newInvoice, setNewInvoice] = useState({
        vendor_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        period_id: '',
        tax_amount: 0,
        lines: [] // Simplified: header only for MVP
    });

    const handlePay = async () => {
        if (!selectedInvoice || !paymentAmount) return;
        await payInvoice.mutateAsync({ id: selectedInvoice.id, amount: parseFloat(paymentAmount) });
        setIsPayDialogOpen(false);
        setPaymentAmount('');
        setSelectedInvoice(null);
    };

    const handleCreate = async () => {
        await createInvoice.mutateAsync(newInvoice);
        setIsCreateDialogOpen(false);
        setNewInvoice({ // Reset
            vendor_id: '',
            invoice_number: '',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            period_id: '',
            tax_amount: 0,
            lines: []
        });
    };

    const filteredInvoices = invoices?.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.vendor?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'partial_paid': return 'bg-blue-100 text-blue-800';
            case 'posted': return 'bg-yellow-100 text-yellow-800';
            case 'draft': return 'bg-gray-100 text-gray-800';
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
                        <h1 className="text-3xl font-bold tracking-tight">Vendor Invoices</h1>
                        <p className="text-muted-foreground">Manage accounts payable and vendor bills</p>
                    </div>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Record Bill
                    </Button>
                </div>

                <div className="flex gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Search by invoice # or vendor..."
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
                                description="No vendor invoices match your search."
                                action={<Button onClick={() => setIsCreateDialogOpen(true)}>Record First Bill</Button>}
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Invoice #</TableHead>
                                        <TableHead>Vendor</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead className="text-right">Paid</TableHead>
                                        <TableHead className="text-right">Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredInvoices.map((inv) => (
                                        <TableRow key={inv.id}>
                                            <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                                            <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                                            <TableCell>{inv.vendor?.name}</TableCell>
                                            <TableCell>{formatDate(inv.due_date)}</TableCell>
                                            <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                                            <TableCell className="text-right text-muted-foreground">{formatCurrency(inv.amount_paid)}</TableCell>
                                            <TableCell className="text-right font-bold text-red-600">{formatCurrency(inv.amount_outstanding)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={getStatusColor(inv.status)}>
                                                    {inv.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {inv.amount_outstanding > 0 && inv.status !== 'draft' && (
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        setSelectedInvoice(inv);
                                                        setPaymentAmount(inv.amount_outstanding.toString());
                                                        setIsPayDialogOpen(true);
                                                    }}>
                                                        <CreditCard className="mr-2 h-3 w-3" />
                                                        Pay
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
                            <DialogTitle>Record Payment</DialogTitle>
                            <DialogDescription>
                                Pay invoice {selectedInvoice?.invoice_number} for {selectedInvoice?.vendor?.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="gap-4 grid py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Outstanding Balance</Label>
                                    <div className="text-2xl font-bold">{selectedInvoice && formatCurrency(selectedInvoice.amount_outstanding)}</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Amount</Label>
                                <Input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handlePay}>Confirm Payment</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Create Dialog */}
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Record Vendor Bill</DialogTitle>
                            <DialogDescription>Enter details from the vendor's invoice.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Vendor</Label>
                                    <Select onValueChange={(val) => setNewInvoice({ ...newInvoice, vendor_id: val })}>
                                        <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                                        <SelectContent>
                                            {vendors?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Invoice Number</Label>
                                    <Input placeholder="e.g. INV-001" onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Invoice Date</Label>
                                    <Input type="date" value={newInvoice.invoice_date} onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <Input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Accounting Period</Label>
                                <Select onValueChange={(val) => setNewInvoice({ ...newInvoice, period_id: val })}>
                                    <SelectTrigger><SelectValue placeholder="Select Period" /></SelectTrigger>
                                    <SelectContent>
                                        {periods?.filter(p => p.status === 'open').map(p => <SelectItem key={p.id} value={p.id}>{p.period_code}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreate} disabled={!newInvoice.vendor_id || !newInvoice.invoice_number || !newInvoice.period_id}>
                                Create Bill
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </AppLayout>
    );
}
