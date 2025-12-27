
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBOMs } from '@/hooks/useProduction';
import { Plus, Factory, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function BOMs() {
    const { data: boms, isLoading } = useBOMs();
    const [isCreateOpen, setIsCreateOpen] = useState(false); // Placeholder for create modal

    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Bill of Materials</h1>
                        <p className="text-muted-foreground">
                            Manage product recipes and production formulas
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create BOM
                    </Button>
                </div>

                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Factory className="h-5 w-5 text-primary" />
                            All BOMs
                        </CardTitle>
                        <CardDescription>
                            List of all active and inactive product formulas
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {boms && boms.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product Code</TableHead>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead>Version</TableHead>
                                        <TableHead>Base Qty</TableHead>
                                        <TableHead>Yield %</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {boms.map((bom) => (
                                        <TableRow key={bom.id}>
                                            <TableCell className="font-mono">{bom.product?.code}</TableCell>
                                            <TableCell>{bom.product?.name}</TableCell>
                                            <TableCell><Badge variant="outline">{bom.version}</Badge></TableCell>
                                            <TableCell>{bom.base_qty}</TableCell>
                                            <TableCell>{bom.yield_percentage}%</TableCell>
                                            <TableCell>
                                                <Badge variant={bom.is_active ? 'default' : 'secondary'}>
                                                    {bom.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm">View</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Factory className="h-12 w-12 text-muted-foreground/50" />
                                <h3 className="mt-4 text-lg font-semibold">No BOMs Found</h3>
                                <p className="max-w-sm text-sm text-muted-foreground mt-2">
                                    Get started by creating your first Bill of Materials to define how your products are made.
                                </p>
                                <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create First BOM
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
