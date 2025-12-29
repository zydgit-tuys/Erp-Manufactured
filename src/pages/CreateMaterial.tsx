import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { useCreateMaterial, useUpdateMaterial, useMaterial, useDeleteMaterial, useMaterialCategories } from '@/hooks/useMaterials';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from '@/contexts/AppContext';

export default function CreateMaterial() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = !!id;

    const { data: existingMaterial, isLoading: isLoadingMaterial } = useMaterial(id!);
    const createMaterial = useCreateMaterial();
    const updateMaterial = useUpdateMaterial();
    const deleteMaterial = useDeleteMaterial();

    const { companyId } = useApp();
    const { data: materialCategories } = useMaterialCategories(companyId);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        category_id: '',
        unit_of_measure: 'PCS',
        standard_cost: 0,
        reorder_level: 0,
        supplier_code: '',
        lead_time_days: 0,
        notes: '',
        status: 'active'
    });

    useEffect(() => {
        if (existingMaterial) {
            setFormData({
                code: existingMaterial.code,
                name: existingMaterial.name,
                description: existingMaterial.description || '',
                category_id: (existingMaterial as any).category_id || '',
                unit_of_measure: existingMaterial.unit_of_measure,
                standard_cost: existingMaterial.standard_cost || 0,
                reorder_level: existingMaterial.reorder_level || 0,
                supplier_code: (existingMaterial as any).supplier_code || '',
                lead_time_days: (existingMaterial as any).lead_time_days || 0,
                notes: (existingMaterial as any).notes || '',
                status: existingMaterial.status || 'active'
            });
        }
    }, [existingMaterial]);

    const handleSave = async () => {
        // Convert empty string to null for UUID fields
        const dataToSave = {
            ...formData,
            category_id: formData.category_id || null
        };

        if (isEditMode && id) {
            await updateMaterial.mutateAsync({ id, ...dataToSave });
        } else {
            await createMaterial.mutateAsync(dataToSave);
        }
        navigate('/materials');
    };

    const handleDelete = async () => {
        if (id) {
            await deleteMaterial.mutateAsync(id);
            navigate('/materials');
        }
    };

    if (isEditMode && isLoadingMaterial) {
        return <AppLayout>Loading...</AppLayout>;
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/materials')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {isEditMode ? 'Edit Material' : 'New Material'}
                        </h1>
                        <p className="text-muted-foreground">
                            {isEditMode ? 'Update material details' : 'Add a new raw material'}
                        </p>
                    </div>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            Material Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Material Code</Label>
                                <Input
                                    placeholder="e.g. FAB-001"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Material Name</Label>
                                <Input
                                    placeholder="Material Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                placeholder="Description"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(val) => setFormData({ ...formData, category_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {materialCategories?.map((cat: any) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                    ))}
                                    {!materialCategories?.length && (
                                        <SelectItem value="none" disabled>No categories found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Supplier Code</Label>
                                <Input
                                    placeholder="Vendor/Supplier Code"
                                    value={formData.supplier_code}
                                    onChange={e => setFormData({ ...formData, supplier_code: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Lead Time (Days)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.lead_time_days}
                                    onChange={e => setFormData({ ...formData, lead_time_days: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Unit of Measure</Label>
                                <Select
                                    value={formData.unit_of_measure}
                                    onValueChange={(val) => setFormData({ ...formData, unit_of_measure: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select UOM" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PCS">PCS</SelectItem>
                                        <SelectItem value="KG">KG</SelectItem>
                                        <SelectItem value="M">M</SelectItem>
                                        <SelectItem value="METER">METER</SelectItem>
                                        <SelectItem value="ROLL">ROLL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(val) => setFormData({ ...formData, status: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Standard Cost (IDR)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.standard_cost}
                                    onChange={e => setFormData({ ...formData, standard_cost: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Reorder Level (Min Stock)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={formData.reorder_level}
                                    onChange={e => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input
                                placeholder="Internal notes..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-between">
                    {isEditMode ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" type="button">Delete Material</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the material.
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
                        <Button variant="outline" onClick={() => navigate('/materials')}>Cancel</Button>
                        <Button onClick={handleSave} disabled={createMaterial.isPending || updateMaterial.isPending}>
                            <Save className="mr-2 h-4 w-4" />
                            {isEditMode ? 'Update Material' : 'Save Material'}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
