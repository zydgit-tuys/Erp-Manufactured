

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSizes, useColors, useCategories, useWarehouses, useCreateSize, useCreateColor, useCreateCategory, useCreateWarehouse, useDeleteSize, useDeleteColor, useDeleteCategory, useDeleteWarehouse, useUpdateWarehouse, useCreateBin } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function MasterDataTab() {
    const { companyId } = useApp();

    return (
        <Card className="shadow-card">
            <CardHeader>
                <CardTitle>Master Data Management</CardTitle>
                <CardDescription>Manage product attributes and warehouses</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="sizes">
                    <TabsList className="mb-4">
                        <TabsTrigger value="sizes">Sizes</TabsTrigger>
                        <TabsTrigger value="colors">Colors</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
                        <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sizes">
                        <SizeManager companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="colors">
                        <ColorManager companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="categories">
                        <CategoryManager companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="warehouses">
                        <WarehouseManager companyId={companyId} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

function SizeManager({ companyId }: { companyId: string }) {
    const { data: sizes } = useSizes(companyId);
    const createSize = useCreateSize();
    const deleteSize = useDeleteSize();
    const [newSize, setNewSize] = useState({ code: '', name: '' });

    const handleAdd = () => {
        if (!newSize.code || !newSize.name) return;
        createSize.mutate({ code: newSize.code, name: newSize.name });
        setNewSize({ code: '', name: '' });
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                    <Label>Code</Label>
                    <Input placeholder="e.g. S" value={newSize.code} onChange={e => setNewSize({ ...newSize, code: e.target.value })} />
                </div>
                <div className="space-y-2 flex-[2]">
                    <Label>Name</Label>
                    <Input placeholder="e.g. Small" value={newSize.name} onChange={e => setNewSize({ ...newSize, name: e.target.value })} />
                </div>
                <Button onClick={handleAdd} disabled={createSize.isPending}>
                    <Plus className="mr-2 h-4 w-4" /> Add Size
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sizes?.map((size: any) => (
                        <TableRow key={size.id}>
                            <TableCell className="font-mono">{size.code}</TableCell>
                            <TableCell>{size.name}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => deleteSize.mutate(size.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {!sizes?.length && (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">No sizes defined. Add one above.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function ColorManager({ companyId }: { companyId: string }) {
    const { data: colors } = useColors(companyId);
    const createColor = useCreateColor();
    const deleteColor = useDeleteColor();
    const [newColor, setNewColor] = useState({ code: '', name: '', hex_code: '#000000' });

    const handleAdd = () => {
        if (!newColor.code || !newColor.name) return;
        createColor.mutate(newColor);
        setNewColor({ code: '', name: '', hex_code: '#000000' });
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                    <Label>Code</Label>
                    <Input placeholder="e.g. RED" value={newColor.code} onChange={e => setNewColor({ ...newColor, code: e.target.value })} />
                </div>
                <div className="space-y-2 flex-[2]">
                    <Label>Name</Label>
                    <Input placeholder="e.g. Bright Red" value={newColor.name} onChange={e => setNewColor({ ...newColor, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>Hex</Label>
                    <div className="flex gap-2">
                        <Input type="color" className="w-12 p-1 h-10" value={newColor.hex_code} onChange={e => setNewColor({ ...newColor, hex_code: e.target.value })} />
                    </div>
                </div>
                <Button onClick={handleAdd} disabled={createColor.isPending}>
                    <Plus className="mr-2 h-4 w-4" /> Add Color
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {colors?.map((color: any) => (
                        <TableRow key={color.id}>
                            <TableCell className="font-mono">{color.code}</TableCell>
                            <TableCell>{color.name}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: color.hex_code }}></div>
                                    <span className="text-xs text-muted-foreground">{color.hex_code}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => deleteColor.mutate(color.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {!colors?.length && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">No colors defined. Add one above.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function CategoryManager({ companyId }: { companyId: string }) {
    const { data: categories } = useCategories(companyId);
    const createCategory = useCreateCategory();
    const deleteCategory = useDeleteCategory();
    const [newCategory, setNewCategory] = useState({ name: '', description: '' });

    const handleAdd = () => {
        if (!newCategory.name) return;
        createCategory.mutate(newCategory);
        setNewCategory({ name: '', description: '' });
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                    <Label>Name</Label>
                    <Input placeholder="e.g. T-Shirts" value={newCategory.name} onChange={e => setNewCategory({ ...newCategory, name: e.target.value })} />
                </div>
                <div className="space-y-2 flex-[2]">
                    <Label>Description</Label>
                    <Input placeholder="Optional description" value={newCategory.description} onChange={e => setNewCategory({ ...newCategory, description: e.target.value })} />
                </div>
                <Button onClick={handleAdd} disabled={createCategory.isPending}>
                    <Plus className="mr-2 h-4 w-4" /> Add Category
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {categories?.map((cat: any) => (
                        <TableRow key={cat.id}>
                            <TableCell className="font-medium">{cat.name}</TableCell>
                            <TableCell>{cat.description}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => deleteCategory.mutate(cat.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    {!categories?.length && (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">No categories defined. Add one above.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function WarehouseManager({ companyId }: { companyId: string }) {
    const { data: warehouses } = useWarehouses(companyId);
    const createWarehouse = useCreateWarehouse();
    const deleteWarehouse = useDeleteWarehouse();
    const [newWarehouse, setNewWarehouse] = useState<{
        name: string;
        code: string;
        address: string;
        city: string;
    }>({
        name: '',
        code: '',
        address: '',
        city: ''
    });

    const handleAdd = () => {
        if (!newWarehouse.name || !newWarehouse.code) return;
        createWarehouse.mutate(newWarehouse);
        setNewWarehouse({ name: '', code: '', address: '', city: '' });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Warehouse Name *</Label>
                    <Input placeholder="e.g. Main Warehouse" value={newWarehouse.name} onChange={e => setNewWarehouse({ ...newWarehouse, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>Code *</Label>
                    <Input placeholder="e.g. WH-001" value={newWarehouse.code} onChange={e => setNewWarehouse({ ...newWarehouse, code: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>Address</Label>
                    <Input placeholder="Jl. Sudirman No. 1" value={newWarehouse.address} onChange={e => setNewWarehouse({ ...newWarehouse, address: e.target.value })} />
                </div>
                <div className="space-y-2">
                    <Label>City</Label>
                    <Input placeholder="Jakarta" value={newWarehouse.city} onChange={e => setNewWarehouse({ ...newWarehouse, city: e.target.value })} />
                </div>
                <Button onClick={handleAdd} disabled={createWarehouse.isPending} className="col-span-2">
                    <Plus className="mr-2 h-4 w-4" /> Add Warehouse
                </Button>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {warehouses?.map((wh: any) => (
                        <TableRow key={wh.id} className={!wh.is_active ? "opacity-50 bg-muted/50" : ""}>
                            <TableCell className="font-mono">{wh.code}</TableCell>
                            <TableCell className="font-medium">
                                <div>{wh.name}</div>
                                <div className="text-xs text-muted-foreground">{wh.address}</div>
                            </TableCell>
                            <TableCell>{wh.city}</TableCell>
                            <TableCell>
                                <WarehouseStatusToggle warehouse={wh} />
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <InitBinButton warehouseId={wh.id} />
                                    <Button variant="ghost" size="icon" onClick={() => deleteWarehouse.mutate(wh.id)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    {!warehouses?.length && (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No warehouses defined. Add one above.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

function InitBinButton({ warehouseId }: { warehouseId: string }) {
    const createBin = useCreateBin();

    // We strictly want to fix "No bin" error, so we just blindly insert 'GEN' if it's missing.
    // The previous manual deletion/recreation wasn't possible for user.
    const handleFix = () => {
        createBin.mutate({
            warehouse_id: warehouseId,
            code: 'GEN',
            name: 'General',
            is_active: true
        });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleFix}
            disabled={createBin.isPending}
        >
            <Plus className="mr-1 h-3 w-3" /> Fix Bin
        </Button>
    )
}

function WarehouseStatusToggle({ warehouse }: { warehouse: any }) {
    const updateWarehouse = useUpdateWarehouse();

    return (
        <div className="flex items-center space-x-2">
            <Switch
                checked={warehouse.is_active}
                onCheckedChange={(checked) =>
                    updateWarehouse.mutate({ id: warehouse.id, is_active: checked })
                }
                disabled={updateWarehouse.isPending}
            />
            <span className="text-xs text-muted-foreground">
                {warehouse.is_active ? 'Active' : 'Inactive'}
            </span>
        </div>
    );
}

