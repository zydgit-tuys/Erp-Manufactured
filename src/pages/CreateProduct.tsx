import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreateProduct, useUpdateProduct, useProduct, useSizes, useColors, useCategories, useCreateVariant, useUpdateVariant, useDeleteVariant } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface VariantRow {
    id: string; // temp id or db id
    size_id: string;
    color_id: string;
    price: number;
    cost: number;
}

export default function CreateProduct() {
    const navigate = useNavigate();
    const { id } = useParams(); // Get ID for Edit Mode
    const { companyId } = useApp();
    const { toast } = useToast();

    // Data Hooks
    const { data: sizes } = useSizes(companyId);
    const { data: colors } = useColors(companyId);
    const { data: categories } = useCategories(companyId);

    // CRUD Hooks
    const { data: existingProduct } = useProduct(id);
    const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct();
    const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct();
    const { mutateAsync: createVariant } = useCreateVariant();
    const { mutateAsync: updateVariant } = useUpdateVariant();
    const { mutateAsync: deleteVariant } = useDeleteVariant();

    // Form State
    const [product, setProduct] = useState({
        code: '',
        name: '',
        category: '',
        unit_of_measure: 'PCS',
        selling_price: 0,
        standard_cost: 0,
        barcode: '',
        notes: '',
        description: '',
        status: 'active'
    });

    const [variants, setVariants] = useState<VariantRow[]>([]);
    const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]); // Track deletions in Edit Mode

    // Load Existing Data
    useEffect(() => {
        if (existingProduct) {
            setProduct({
                code: existingProduct.code,
                name: existingProduct.name,
                category: existingProduct.category || '',
                unit_of_measure: existingProduct.unit_of_measure || 'PCS',
                selling_price: existingProduct.selling_price,
                standard_cost: (existingProduct as any).standard_cost || 0, // Cast if type missing
                barcode: (existingProduct as any).barcode || '',
                notes: (existingProduct as any).notes || '',
                description: existingProduct.description || '',
                status: (existingProduct as any).status || 'active'
            });

            if (existingProduct.variants) {
                setVariants(existingProduct.variants.map((v: any) => ({
                    id: v.id,
                    size_id: v.size_id || '',
                    color_id: v.color_id || '',
                    price: v.unit_price || 0,
                    cost: v.unit_cost || 0
                })));
            }
        }
    }, [existingProduct]);

    const handleAddVariantLocal = () => {
        setVariants([
            ...variants,
            {
                id: crypto.randomUUID(), // Temp ID
                size_id: '',
                color_id: '',
                price: product.selling_price,
                cost: product.standard_cost // Default to standard cost
            }
        ]);
    };

    const handleRemoveVariantLocal = (variantId: string) => {
        // If we are in Edit Mode (id exists) and this variantId is likely a real DB ID (not a temp UUID we just generated)
        if (id) {
            const original = existingProduct?.variants?.find((v: any) => v.id === variantId);
            if (original) {
                setDeletedVariantIds(prev => [...prev, variantId]);
            }
        }
        setVariants(variants.filter(v => v.id !== variantId));
    };

    const handleUpdateVariantLocal = (variantId: string, field: keyof VariantRow, value: any) => {
        setVariants(variants.map(v =>
            v.id === variantId ? { ...v, [field]: value } : v
        ));
    };

    const handleSave = async () => {
        if (!product.code || !product.name) {
            toast({ variant: "destructive", title: "Validation Error", description: "Product code and name are required." });
            return;
        }

        try {
            if (id) {
                // UPDATE MODE
                await updateProduct({ id, ...product });

                // Process Variants
                // 1. Deletions
                for (const delId of deletedVariantIds) {
                    await deleteVariant(delId);
                }

                // 2. Updates & Creates
                for (const v of variants) {
                    // Check if it's an existing variant by checking if it was in the original list
                    const original = existingProduct?.variants?.find((orig: any) => orig.id === v.id);

                    if (original) {
                        // Update
                        await updateVariant({
                            id: v.id,
                            price: v.price,
                            cost: v.cost,
                            status: 'active'
                        });
                    } else {
                        // Create (New Variant)
                        if (v.size_id && v.color_id) {
                            await createVariant({
                                product_id: id,
                                size_id: v.size_id,
                                color_id: v.color_id,
                                price: v.price,
                                cost: v.cost,
                                sku: '' // Let DB generate
                            });
                        }
                    }
                }
                toast({ title: "Success", description: "Product updated successfully." });

            } else {
                // CREATE MODE
                await createProduct({
                    ...product,
                    variants: variants.filter(v => v.size_id && v.color_id)
                });
            }
            navigate('/products');
        } catch (error: any) {
            console.error(error);
            // Toast is handled by hook onError usually
        }
    };

    const isSaving = isCreating || isUpdating;

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/products')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{id ? 'Edit Product' : 'New Product'}</h1>
                        <p className="text-muted-foreground">Define style and variants</p>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Product Details</CardTitle>
                            <CardDescription>General information for this style</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Product Code / Style</Label>
                                    <Input
                                        placeholder="e.g. TS-001"
                                        value={product.code}
                                        onChange={e => setProduct({ ...product, code: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Category</Label>
                                    <Select
                                        value={product.category}
                                        onValueChange={val => setProduct({ ...product, category: val })}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                                        <SelectContent>
                                            {categories?.map((cat: any) => (
                                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                            ))}
                                            {!categories?.length && (
                                                <SelectItem value="uncategorized" disabled>No categories found</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Product Name</Label>
                                <Input
                                    placeholder="e.g. Cotton Polos Basic"
                                    value={product.name}
                                    onChange={e => setProduct({ ...product, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Selling Price (IDR)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={product.selling_price}
                                        onChange={e => setProduct({ ...product, selling_price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Unit of Measure</Label>
                                    <Select value={product.unit_of_measure} onValueChange={val => setProduct({ ...product, unit_of_measure: val })}>
                                        <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="PCS">PCS</SelectItem>
                                            <SelectItem value="SET">SET</SelectItem>
                                            <SelectItem value="PACK">PACK</SelectItem>
                                            <SelectItem value="METER">METER</SelectItem>
                                            <SelectItem value="KG">KG</SelectItem>
                                            <SelectItem value="LITER">LITER</SelectItem>
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
                                        value={product.standard_cost}
                                        onChange={e => setProduct({ ...product, standard_cost: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Barcode</Label>
                                    <Input
                                        placeholder="e.g. 899..."
                                        value={product.barcode}
                                        onChange={e => setProduct({ ...product, barcode: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes</Label>
                                <Input
                                    placeholder="Internal notes..."
                                    value={product.notes}
                                    onChange={e => setProduct({ ...product, notes: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    placeholder="Product details..."
                                    value={product.description}
                                    onChange={e => setProduct({ ...product, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Status</Label>
                                <Select
                                    value={product.status}
                                    onValueChange={(val) => setProduct({ ...product, status: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="discontinued">Discontinued</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Variants (SKUs)</CardTitle>
                                    <CardDescription>Add size and color combinations</CardDescription>
                                </div>
                                <Button size="sm" onClick={handleAddVariantLocal} variant="outline">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Variant
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {variants.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                    No variants added. Product will be created as "Style Only" if left empty.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Size</TableHead>
                                            <TableHead>Color</TableHead>
                                            <TableHead className="w-[100px]">Price</TableHead>
                                            <TableHead className="w-[100px]">Cost</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {variants.map((variant) => (
                                            <TableRow key={variant.id}>
                                                <TableCell>
                                                    <Select value={variant.size_id} onValueChange={val => handleUpdateVariantLocal(variant.id, 'size_id', val)}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Size" /></SelectTrigger>
                                                        <SelectContent>
                                                            {sizes?.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Select value={variant.color_id} onValueChange={val => handleUpdateVariantLocal(variant.id, 'color_id', val)}>
                                                        <SelectTrigger className="h-8"><SelectValue placeholder="Color" /></SelectTrigger>
                                                        <SelectContent>
                                                            {colors?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        className="h-8"
                                                        value={variant.price}
                                                        onChange={e => handleUpdateVariantLocal(variant.id, 'price', parseFloat(e.target.value))}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        className="h-8"
                                                        value={variant.cost}
                                                        onChange={e => handleUpdateVariantLocal(variant.id, 'cost', parseFloat(e.target.value))}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveVariantLocal(variant.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end gap-4">
                    <Button variant="outline" onClick={() => navigate('/products')}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Product
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </AppLayout >
    );
}
