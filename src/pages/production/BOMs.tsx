
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useBOMs } from '@/hooks/useProduction';
import { Plus, Factory } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function BOMs() {
    const { companyId } = useApp();
    const { data: boms, isLoading, error, refetch } = useBOMs(companyId);
    const [isCreateOpen, setIsCreateOpen] = useState(false); // Placeholder for create modal

    if (error) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load BOMs"
                    message={error.message}
                    onRetry={() => refetch()}
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Bill of Materials</h1>
                        <p className="text-muted-foreground">
                            Manage product recipes and production formulas
                        </p>
                    </div>
                    <Button onClick={() => window.location.href = '/production/boms/create'}>
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
                        {isLoading ? (
                            <TableSkeleton rows={5} columns={7} />
                        ) : !boms || boms.length === 0 ? (
                            <EmptyState
                                icon={Factory}
                                title="No BOMs Found"
                                description="Get started by creating your first Bill of Materials to define how your products are made."
                                action={
                                    <Button onClick={() => window.location.href = '/production/boms/create'}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create First BOM
                                    </Button>
                                }
                            />
                        ) : (
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
                                        <TableRow key={bom.id} className="cursor-pointer hover:bg-muted/50">
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
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
