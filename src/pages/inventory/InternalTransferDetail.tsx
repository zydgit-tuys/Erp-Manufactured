import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CheckCircle, Clock, Warehouse } from 'lucide-react';
import { useInternalTransfer, usePostTransfer } from '@/hooks/useInventory';
import { useApp } from '@/contexts/AppContext';

export default function InternalTransferDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { userId } = useApp();

    // Hooks
    const { data: transfer, isLoading } = useInternalTransfer(id!);
    const postTransfer = usePostTransfer();

    if (isLoading) return <AppLayout>Loading...</AppLayout>;
    if (!transfer) return <AppLayout>Transfer not found</AppLayout>;

    const handlePost = () => {
        postTransfer.mutate(
            { transferId: transfer.id, userId },
            {
                onSuccess: () => {
                    // Refetch handled by hook invalidation
                }
            }
        );
    };

    const getStatusBadge = (status: string) => {
        if (status === 'draft') return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" /> Draft</Badge>;
        if (status === 'posted') return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" /> Posted</Badge>;
        return <Badge variant="secondary">{status}</Badge>;
    };

    return (
        <AppLayout>
            <div className="space-y-6 max-w-5xl mx-auto pb-10">
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory/transfers')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{transfer.transfer_number}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(transfer.status)}
                                <span className="text-muted-foreground text-sm">
                                    {transfer.transfer_date}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {transfer.status === 'draft' && (
                            <Button onClick={handlePost} disabled={postTransfer.isPending}>
                                {postTransfer.isPending ? 'Posting...' : 'Post Transfer'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Info Card */}
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Source</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Warehouse className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xl font-semibold">
                                    {(transfer as any).source_location?.name || 'Unknown'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-muted-foreground">Destination</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2">
                                <Warehouse className="h-5 w-5 text-muted-foreground" />
                                <span className="text-xl font-semibold">
                                    {(transfer as any).destination_location?.name || 'Unknown'}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Lines */}
                <Card>
                    <CardHeader>
                        <CardTitle>Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Qty</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(transfer as any).lines?.map((line: any) => (
                                    <TableRow key={line.id}>
                                        <TableCell className="font-mono">
                                            {line.material?.code || line.product_variant?.sku || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {line.material?.name ||
                                                (line.product_variant?.product?.name ? `${line.product_variant.product.name}` : '-')}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {line.qty} {line.material?.unit_of_measure || line.product_variant?.product?.unit_of_measure}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{line.notes}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
