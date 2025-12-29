import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Search, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useVendors } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';

export default function Vendors() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { companyId } = useApp();

  const { data: vendors, isLoading, error, refetch } = useVendors(companyId);

  const filteredVendors = (vendors || []).filter(
    (vendor) =>
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load vendors"
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
            <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
            <p className="text-muted-foreground">
              Manage your suppliers
            </p>
          </div>
          <Button onClick={() => navigate('/vendors/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{vendors?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Vendors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vendors?.filter((v) => v.is_active).length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={5} />
            ) : filteredVendors.length === 0 ? (
              <EmptyState
                icon={Truck}
                title={searchQuery ? "No vendors found" : "No vendors yet"}
                description={
                  searchQuery
                    ? "Try adjusting your search terms"
                    : "Get started by adding your first vendor"
                }
                action={
                  !searchQuery && (
                    <Button onClick={() => navigate('/vendors/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Vendor
                    </Button>
                  )
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => (
                    <TableRow
                      key={vendor.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vendors/${vendor.id}`)}
                    >
                      <TableCell className="font-mono text-sm">
                        {vendor.code}
                      </TableCell>
                      <TableCell className="font-medium">{vendor.name}</TableCell>
                      <TableCell>{vendor.contact_person}</TableCell>
                      <TableCell>{vendor.phone}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={vendor.is_active ? 'default' : 'secondary'}>
                          {vendor.is_active ? 'Active' : 'Inactive'}
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
