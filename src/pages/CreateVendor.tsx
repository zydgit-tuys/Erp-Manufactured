import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Truck } from 'lucide-react';
import { useCreateVendor, useUpdateVendor, useVendor, useDeleteVendor } from '@/hooks/useMasterData';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function CreateVendor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const { data: existingVendor, isLoading: isLoadingVendor } = useVendor(id);
    const createVendor = useCreateVendor();
    const updateVendor = useUpdateVendor();
    const deleteVendor = useDeleteVendor();

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
        credit_limit: 0,
        status: 'active' as 'active' | 'inactive' | 'blocked',
        notes: ''
    });

    useEffect(() => {
        if (existingVendor) {
            setFormData({
                code: existingVendor.code,
                name: existingVendor.name,
                contact_person: existingVendor.contact_person || '',
                phone: existingVendor.phone || '',
                email: existingVendor.email || '',
                address: existingVendor.address || '',
                city: existingVendor.city || '',
                tax_id: existingVendor.tax_id || '',
                payment_terms: existingVendor.payment_terms || 'COD',
                custom_payment_days: existingVendor.custom_payment_days || 0,
                credit_limit: existingVendor.credit_limit || 0,
                status: existingVendor.status || 'active',
                notes: existingVendor.notes || ''
            });
        }
    }, [existingVendor]);

    const handleSave = async () => {
        if (isEditMode && id) {
            await updateVendor.mutateAsync({ id, ...formData });
        } else {
            await createVendor.mutateAsync(formData);
        }
        navigate('/vendors');
    };

    const handleDelete = async () => {
        if (id) {
            await deleteVendor.mutateAsync(id);
            navigate('/vendors');
        }
    };

    if (isEditMode && isLoadingVendor) {
        return <AppLayout>Loading...</AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/vendors')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {isEditMode ? 'Edit Vendor' : 'New Vendor'}
                        </h1>
                        <p className="text-muted-foreground">
                            {isEditMode ? 'Update vendor details' : 'Add a new supplier'}
                        </p>
                    </div>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-primary" />
                            Vendor Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Vendor Code</Label>
                                <Input
                                    placeholder="e.g. V-001"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input
                                    placeholder="Vendor Name"
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
                                placeholder="vendor@example.com"
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
                                <Button variant="destructive" type="button">Delete Vendor</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the vendor.
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
                        <Button variant="outline" onClick={() => navigate('/vendors')}>Cancel</Button>
                        <Button onClick={handleSave} disabled={createVendor.isPending || updateVendor.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            {isEditMode ? 'Update Vendor' : 'Save Vendor'}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
