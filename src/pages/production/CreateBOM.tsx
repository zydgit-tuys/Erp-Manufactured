
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Plus, Save, Trash, Layers } from 'lucide-react';
import { useCreateBOM } from '@/hooks/useProduction';
import { useProducts } from '@/hooks/useMasterData';
import { useMaterials } from '@/hooks/useMaterials';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

export default function CreateBOM() {
    const navigate = useNavigate();
    const { companyId } = useApp();
    const { toast } = useToast();

    // Hooks
    const { data: products } = useProducts(companyId);
    const { data: materials } = useMaterials(); // Assuming useMaterials exists in useMasterData or useMaterials.ts
    const createBOM = useCreateBOM();

    // State
    const [header, setHeader] = useState({
        product_id: '',
        version: '1.0',
        base_qty: 1,
        yield_percentage: 100,
        notes: '',
        is_active: true
    });

    const [lines, setLines] = useState<{
        material_id: string;
        qty_per: number;
        uom: string;
        scrap_percentage: number;
        stage: 'preparation' | 'assembly' | 'finishing' | 'packaging';
        notes: string;
    }[]>([]);

    // Determine UOM from selected material (helper)
    const getMaterialUOM = (id: string) => {
        const mat = materials?.find(m => m.id === id);
        return mat?.unit_of_measure || 'PCS';
    };

    const addLine = () => {
        setLines([...lines, {
            material_id: '',
            qty_per: 1,
            uom: 'PCS',
            scrap_percentage: 0,
            stage: 'assembly',
            notes: ''
        }]);
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        // @ts-ignore
        newLines[index][field] = value;

        // Auto-update UOM if material changes
        if (field === 'material_id') {
            newLines[index].uom = getMaterialUOM(value);
        }

        setLines(newLines);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!header.product_id) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please select a product.' });
            return;
        }
        if (lines.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please add at least one ingredient.' });
            return;
        }

        try {
            await createBOM.mutateAsync({
                header: header,
                lines: lines.map((l, i) => ({
                    ...l,
                    line_number: i + 1,
                    // Ensure uom is set
                    uom: l.uom || 'PCS'
                }))
            });
            navigate('/production/boms');
        } catch (error) {
            // Error handled by hook
        }
    };

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/production/boms')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Create Bill of Materials</h1>
                        <p className="text-muted-foreground">Define the recipe for a product</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Header Card */}
                    <Card className="md:col-span-3 shadow-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                Header Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Product</Label>
                                <Select onValueChange={val => setHeader({ ...header, product_id: val })} value={header.product_id}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Product" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products?.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Version</Label>
                                <Input value={header.version} onChange={e => setHeader({ ...header, version: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Base Quantity</Label>
                                <Input type="number" value={header.base_qty} onChange={e => setHeader({ ...header, base_qty: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Yield (%)</Label>
                                <Input type="number" value={header.yield_percentage} onChange={e => setHeader({ ...header, yield_percentage: Number(e.target.value) })} />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>Notes</Label>
                                <Input value={header.notes} onChange={e => setHeader({ ...header, notes: e.target.value })} />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ingredients Card */}
                    <Card className="md:col-span-3 shadow-card">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Ingredients (Materials)</CardTitle>
                                <CardDescription>Raw materials required to produce base quantity</CardDescription>
                            </div>
                            <Button onClick={addLine} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" /> Add Material
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[30%]">Material</TableHead>
                                        <TableHead className="w-[15%]">Qty Per</TableHead>
                                        <TableHead className="w-[10%]">UOM</TableHead>
                                        <TableHead className="w-[15%]">Scrap %</TableHead>
                                        <TableHead className="w-[15%]">Stage</TableHead>
                                        <TableHead className="w-[5%]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((line, index) => (
                                        <TableRow key={index}>
                                            <TableCell>
                                                <Select onValueChange={val => updateLine(index, 'material_id', val)} value={line.material_id}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Material" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {materials?.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>{m.code} - {m.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={line.qty_per} onChange={e => updateLine(index, 'qty_per', Number(e.target.value))} />
                                            </TableCell>
                                            <TableCell>
                                                <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm">{line.uom}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" value={line.scrap_percentage} onChange={e => updateLine(index, 'scrap_percentage', Number(e.target.value))} />
                                            </TableCell>
                                            <TableCell>
                                                <Select onValueChange={val => updateLine(index, 'stage', val)} value={line.stage}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="preparation">Preparation</SelectItem>
                                                        <SelectItem value="assembly">Assembly</SelectItem>
                                                        <SelectItem value="finishing">Finishing</SelectItem>
                                                        <SelectItem value="packaging">Packaging</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeLine(index)}>
                                                    <Trash className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {lines.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                No ingredients added. Click "Add Material" to start.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    <div className="md:col-span-3 flex justify-end gap-4">
                        <Button variant="outline" size="lg" onClick={() => navigate('/production/boms')}>Cancel</Button>
                        <Button size="lg" onClick={handleSave} disabled={createBOM.isPending}>
                            <Save className="mr-2 h-4 w-4" /> Save BOM
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
