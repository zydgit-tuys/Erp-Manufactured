import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Users } from 'lucide-react';
import { useCreateCustomer, useUpdateCustomer, useCustomer, useDeleteCustomer } from '@/hooks/useMasterData';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function CreateCustomer() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const { data: existingCustomer, isLoading: isLoadingCustomer } = useCustomer(id);
    const createCustomer = useCreateCustomer();
    const updateCustomer = useUpdateCustomer();
    const deleteCustomer = useDeleteCustomer();

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        tax_id: '',
        payment_terms: 'COD' as 'COD' | 'NET_7' | 'NET_14' | 'NET_30' | 'NET_60' | 'CUSTOM',
        custom_payment_days: 0,
        customer_type: 'retail',
        credit_limit: 0,
        credit_hold: false,
        discount_percentage: 0,
        status: 'active' as 'active' | 'inactive' | 'blocked',
        notes: ''
    });

    useEffect(() => {
        if (existingCustomer) {
            setFormData({
                code: existingCustomer.code,
                name: existingCustomer.name,
                contact_person: existingCustomer.contact_person || '',
                phone: existingCustomer.phone || '',
                email: existingCustomer.email || '',
                address: existingCustomer.address || '',
                city: existingCustomer.city || '',
                tax_id: existingCustomer.tax_id || '',
                payment_terms: existingCustomer.payment_terms || 'COD',
                custom_payment_days: existingCustomer.custom_payment_days || 0,
                customer_type: existingCustomer.customer_type || 'retail',
                credit_limit: existingCustomer.credit_limit || 0,
                credit_hold: existingCustomer.credit_hold || false,
                discount_percentage: existingCustomer.discount_percentage || 0,
                status: existingCustomer.status || 'active',
                notes: existingCustomer.notes || ''
            });
        }
    }, [existingCustomer]);

    const handleSave = async () => {
        if (isEditMode && id) {
            await updateCustomer.mutateAsync({ id, ...formData });
        } else {
            await createCustomer.mutateAsync(formData);
        }
        navigate('/customers');
    };

    const handleDelete = async () => {
        if (id) {
            await deleteCustomer.mutateAsync(id);
            navigate('/customers');
        }
    };

    if (isEditMode && isLoadingCustomer) {
        return <AppLayout>Loading...</AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {isEditMode ? 'Edit Customer' : 'New Customer'}
                        </h1>
                        <p className="text-muted-foreground">
                            {isEditMode ? 'Update customer details' : 'Add a new client'}
                        </p>
                    </div>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            Customer Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer Code</Label>
                                <Input
                                    placeholder="e.g. C-001"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Customer Name</Label>
                                <Input
                                    placeholder="Customer Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Contact Person</Label>
                                <Input
                                    placeholder="Name"
                                    value={formData.contact_person}
                                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                    placeholder="+62..."
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                placeholder="customer@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Address</Label>
                            <Input
                                placeholder="Full Address"
                                value={formData.address}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Customer Type</Label>
                                <Select
                                    value={formData.customer_type}
                                    onValueChange={(val) => setFormData({ ...formData, customer_type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="retail">Retail</SelectItem>
                                        <SelectItem value="wholesale">Wholesale</SelectItem>
                                        <SelectItem value="distributor">Distributor</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>City</Label>
                                <Input
                                    placeholder="City"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tax ID / NPWP</Label>
                                <Input
                                    placeholder="Tax ID"
                                    value={formData.tax_id}
                                    onChange={e => setFormData({ ...formData, tax_id: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Payment Terms</Label>
                                <Select
                                    value={formData.payment_terms}
                                    onValueChange={(val: any) => setFormData({ ...formData, payment_terms: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select payment terms" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="COD">COD (Cash on Delivery)</SelectItem>
                                        <SelectItem value="NET_7">Net 7 Days</SelectItem>
                                        <SelectItem value="NET_14">Net 14 Days</SelectItem>
                                        <SelectItem value="NET_30">Net 30 Days</SelectItem>
                                        <SelectItem value="NET_60">Net 60 Days</SelectItem>
                                        <SelectItem value="CUSTOM">Custom</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.payment_terms === 'CUSTOM' && (
                                <div className="space-y-2">
                                    <Label>Custom Payment Days</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.custom_payment_days}
                                        onChange={e => setFormData({ ...formData, custom_payment_days: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Credit Limit (IDR)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.credit_limit}
                                    onChange={e => setFormData({ ...formData, credit_limit: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Discount Percentage (%)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={formData.discount_percentage}
                                    onChange={e => setFormData({ ...formData, discount_percentage: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label>Credit Hold</Label>
                                <p className="text-sm text-muted-foreground">
                                    Block new sales orders if enabled
                                </p>
                            </div>
                            <Switch
                                checked={formData.credit_hold}
                                onCheckedChange={checked => setFormData({ ...formData, credit_hold: checked })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input
                                placeholder="Internal notes..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(val: any) => setFormData({ ...formData, status: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                    <SelectItem value="blocked">Blocked</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-between">
                    {isEditMode ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" type="button">Delete Customer</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the customer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : <div></div>}

                    <div className="flex gap-4">
                        <Button variant="outline" onClick={() => navigate('/customers')}>Cancel</Button>
                        <Button onClick={handleSave} disabled={createCustomer.isPending || updateCustomer.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            {isEditMode ? 'Update Customer' : 'Save Customer'}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
