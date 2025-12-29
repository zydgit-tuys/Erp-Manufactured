
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWorkCenters, useOperations } from '@/hooks/useProduction';
import { Plus, Settings, Factory, Gauge } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function Operations() {
    const { companyId } = useApp();
    const { data: workCenters, isLoading: wcLoading, error: wcError, refetch: wcRefetch } = useWorkCenters(companyId);
    const { data: operations, isLoading: opLoading, error: opError, refetch: opRefetch } = useOperations(companyId);
    const [isWCCreateOpen, setIsWCCreateOpen] = useState(false);
    const [isOpCreateOpen, setIsOpCreateOpen] = useState(false);

    if (wcError || opError) {
        return (
            <AppLayout>
                <ErrorState
                    title="Failed to load Operations data"
                    message={wcError?.message || opError?.message || 'Unknown error'}
                    onRetry={() => {
                        wcRefetch();
                        opRefetch();
                    }}
                />
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Operations & Work Centers</h1>
                        <p className="text-muted-foreground">
                            Define standard manufacturing processes and capacity
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="operations" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="operations">Standard Operations</TabsTrigger>
                        <TabsTrigger value="workcenters">Work Centers</TabsTrigger>
                    </TabsList>

                    <TabsContent value="operations" className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={() => setIsOpCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Operation
                            </Button>
                        </div>
                        <Card className="shadow-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-primary" />
                                    Standard Operations
                                </CardTitle>
                                <CardDescription>
                                    Standard steps for routing (Cutting, Sewing, Finishing)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {opLoading ? (
                                    <TableSkeleton rows={5} columns={6} />
                                ) : !operations || operations.length === 0 ? (
                                    <EmptyState
                                        icon={Settings}
                                        title="No Operations Defined"
                                        description="Define standard operations like Cutting, Sewing, or QC."
                                        action={
                                            <Button onClick={() => setIsOpCreateOpen(true)}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Operation
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Default Work Center</TableHead>
                                                <TableHead>Std Time (Min)</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {operations.map((op) => (
                                                <TableRow key={op.id}>
                                                    <TableCell className="font-mono">{op.code}</TableCell>
                                                    <TableCell>{op.name}</TableCell>
                                                    <TableCell>{op.work_center?.name || '-'}</TableCell>
                                                    <TableCell>{op.standard_time_minutes}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={op.is_active ? 'default' : 'secondary'}>
                                                            {op.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm">Edit</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="workcenters" className="space-y-4">
                        <div className="flex justify-end">
                            <Button onClick={() => setIsWCCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Work Center
                            </Button>
                        </div>
                        <Card className="shadow-card">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Factory className="h-5 w-5 text-primary" />
                                    Work Centers
                                </CardTitle>
                                <CardDescription>
                                    Production lines, stations, or machines
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {wcLoading ? (
                                    <TableSkeleton rows={5} columns={6} />
                                ) : !workCenters || workCenters.length === 0 ? (
                                    <EmptyState
                                        icon={Gauge}
                                        title="No Work Centers"
                                        description="Define where production happens (e.g., Sewing Line 1, Cutting Table)."
                                        action={
                                            <Button onClick={() => setIsWCCreateOpen(true)}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Work Center
                                            </Button>
                                        }
                                    />
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Code</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Capacity (Hrs/Day)</TableHead>
                                                <TableHead>Cost/Hour</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {workCenters.map((wc) => (
                                                <TableRow key={wc.id}>
                                                    <TableCell className="font-mono">{wc.code}</TableCell>
                                                    <TableCell>{wc.name}</TableCell>
                                                    <TableCell>{wc.capacity_per_day}</TableCell>
                                                    <TableCell>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(wc.cost_per_hour)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={wc.is_active ? 'default' : 'secondary'}>
                                                            {wc.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm">Edit</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
