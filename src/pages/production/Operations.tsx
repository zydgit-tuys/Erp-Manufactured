
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useWorkCenters, useOperations } from '@/hooks/useProduction';
import { Plus, Settings, Factory, Loader2, Gauge } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from 'react';

export default function Operations() {
    const { data: workCenters, isLoading: wcLoading, error: wcError } = useWorkCenters();
    const { data: operations, isLoading: opLoading, error: opError } = useOperations();
    const [isWCCreateOpen, setIsWCCreateOpen] = useState(false);
    const [isOpCreateOpen, setIsOpCreateOpen] = useState(false);

    if (wcLoading || opLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center h-screen">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </AppLayout>
        );
    }

    if (wcError || opError) {
        return (
            <AppLayout>
                <div className="p-8 text-red-600">
                    <h2 className="text-xl font-bold">Error loading data</h2>
                    <p>{wcError?.message || opError?.message}</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="space-y-6">
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
                                {operations && operations.length > 0 ? (
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Settings className="h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mt-4 text-lg font-semibold">No Operations Defined</h3>
                                        <p className="max-w-sm text-sm text-muted-foreground mt-2">
                                            Define standard operations like Cutting, Sewing, or QC.
                                        </p>
                                        <Button className="mt-6" onClick={() => setIsOpCreateOpen(true)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Operation
                                        </Button>
                                    </div>
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
                                {workCenters && workCenters.length > 0 ? (
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Gauge className="h-12 w-12 text-muted-foreground/50" />
                                        <h3 className="mt-4 text-lg font-semibold">No Work Centers</h3>
                                        <p className="max-w-sm text-sm text-muted-foreground mt-2">
                                            Define where production happens (e.g., Sewing Line 1, Cutting Table).
                                        </p>
                                        <Button className="mt-6" onClick={() => setIsWCCreateOpen(true)}>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Work Center
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
