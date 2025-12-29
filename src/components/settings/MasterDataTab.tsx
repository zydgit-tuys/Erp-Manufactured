

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSizes, useColors, useCategories, useCreateSize, useCreateColor, useCreateCategory, useDeleteSize, useDeleteColor, useDeleteCategory } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function MasterDataTab() {
    const { companyId } = useApp();

    return (
        <Card className="shadow-card">
            <CardHeader>
                <CardTitle>Master Data Management</CardTitle>
                <CardDescription>Manage product attributes like Sizes, Colors, and Categories</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="sizes">
                    <TabsList className="mb-4">
                        <TabsTrigger value="sizes">Sizes (S, M, L)</TabsTrigger>
                        <TabsTrigger value="colors">Colors (Red, Blue)</TabsTrigger>
                        <TabsTrigger value="categories">Categories</TabsTrigger>
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

