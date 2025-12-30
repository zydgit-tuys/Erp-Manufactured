
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBOM } from '@/hooks/useProduction';
import { ArrowLeft, Layers, Pencil, Factory } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function BOMDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: bom, isLoading, error } = useBOM(id!);

    if (error) {
        return (
            <AppLayout>
                <ErrorState title="Failed to load BOM" message={error.message} />
            </AppLayout>
        );
    }

    if (isLoading || !bom) {
        return (
            <AppLayout>
                <div className="space-y-6 animate-pulse">
                    <div className="h-8 w-48 bg-muted rounded" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/production/boms')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{bom.product?.name}</h1>
                            <p className="text-muted-foreground font-mono">Ver: {bom.version}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={bom.is_active ? 'default' : 'secondary'} className="text-lg px-4 py-1">
                            {bom.is_active ? 'Active' : 'Archived'}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => navigate(`/production/boms/${id}/edit`)} disabled>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Key Info */}
                    <Card className="md:col-span-3 shadow-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Factory className="h-5 w-5 text-primary" />
                                Header Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-sm text-muted-foreground">Product Code</div>
                                <div className="font-mono">{bom.product?.code}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Base Quantity</div>
                                <div className="font-medium">{bom.base_qty}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Yield</div>
                                <div className="font-medium">{bom.yield_percentage}%</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted-foreground">Notes</div>
                                <div className="text-sm">{bom.notes || '-'}</div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ingredients */}
                    <Card className="md:col-span-3 shadow-card">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Layers className="h-5 w-5 text-primary" />
                                Ingredients
                            </CardTitle>
                            <CardDescription>
                                Raw materials and components
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Material</TableHead>
                                        <TableHead>Qty Per</TableHead>
                                        <TableHead>UOM</TableHead>
                                        <TableHead>Scrap %</TableHead>
                                        <TableHead>Stage</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bom.lines && bom.lines.length > 0 ? (
                                        bom.lines.map((line: any) => (
                                            <TableRow key={line.id}>
                                                <TableCell>
                                                    <div className="font-medium">{line.material?.name}</div>
                                                    <div className="text-xs text-muted-foreground font-mono">{line.material?.code}</div>
                                                </TableCell>
                                                <TableCell>{line.qty_per}</TableCell>
                                                <TableCell><Badge variant="outline">{line.uom}</Badge></TableCell>
                                                <TableCell>{line.scrap_percentage}%</TableCell>
                                                <TableCell className="capitalize">{line.stage}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{line.notes || '-'}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                No ingredients defined.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
