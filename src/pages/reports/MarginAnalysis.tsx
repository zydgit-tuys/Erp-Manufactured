import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePickerWithRange } from '../../components/ui/date-range-picker';
import { addDays, format, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useApp } from '@/contexts/AppContext';
import { useMarginAnalysis } from '@/hooks/useReports';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, DollarSign, Percent } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

export default function MarginAnalysis() {
    const { companyId } = useApp();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
    const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

    const { data: rows, isLoading } = useMarginAnalysis(companyId, startDate, endDate);

    // Calculate Aggregates
    const totalRevenue = rows?.reduce((sum, r) => sum + r.revenue, 0) || 0;
    const totalCOGS = rows?.reduce((sum, r) => sum + r.cogs, 0) || 0;
    const totalMargin = totalRevenue - totalCOGS;
    const avgMarginPercentage = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Margin Analysis</h1>
                        <p className="text-muted-foreground">
                            Analyze profitability by invoice and product
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                        <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" /> Export
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> Total Revenue
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Rp {totalRevenue.toLocaleString('id-ID')}</div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Total COGS
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Rp {totalCOGS.toLocaleString('id-ID')}</div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> Net Margin
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${totalMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
                                Rp {totalMargin.toLocaleString('id-ID')}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Percent className="h-4 w-4" /> Margin %
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${avgMarginPercentage >= 20 ? 'text-success' : avgMarginPercentage >= 10 ? 'text-warning' : 'text-destructive'}`}>
                                {avgMarginPercentage.toFixed(2)}%
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Detailed Table */}
                <Card className="shadow-card">
                    <CardHeader>
                        <CardTitle>Detailed Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <TableSkeleton rows={5} columns={7} />
                        ) : !rows || rows.length === 0 ? (
                            <EmptyState
                                icon={TrendingUp}
                                title="No data found"
                                description="Adjust your date range to see analysis."
                            />
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Invoice</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">COGS</TableHead>
                                        <TableHead className="text-right">Margin</TableHead>
                                        <TableHead className="text-right">%</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((row) => (
                                        <TableRow key={`${row.invoice_id}-${row.product_variant_id}`}>
                                            <TableCell className="font-mono">{row.invoice_number}</TableCell>
                                            <TableCell>{format(new Date(row.invoice_date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>{row.customer_name}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{row.product_name}</div>
                                                <div className="text-xs text-muted-foreground">{row.sku}</div>
                                            </TableCell>
                                            <TableCell className="text-right">Rp {row.revenue.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-right">Rp {row.cogs.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className={`text-right font-medium ${row.margin >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                Rp {row.margin.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={row.margin_percentage >= 20 ? 'success' : row.margin_percentage >= 10 ? 'warning' : 'destructive'}>
                                                    {row.margin_percentage.toFixed(1)}%
                                                </Badge>
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
