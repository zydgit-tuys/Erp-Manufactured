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
import { Plus, Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const sampleCustomers: Array<{
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  creditLimit: number;
  isActive: boolean;
}> = [];

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredCustomers = sampleCustomers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">
              Manage your customer database
            </p>
          </div>
          <Button onClick={() => navigate('/customers/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleCustomers.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Customers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleCustomers.filter((c) => c.isActive).length}
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
                  placeholder="Search customers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Credit Limit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {customer.code}
                    </TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.contactPerson}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-right">
                      Rp {customer.creditLimit.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={customer.isActive ? 'default' : 'secondary'}>
                        {customer.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No customers yet</p>
                      <Button
                        variant="link"
                        onClick={() => navigate('/customers/new')}
                        className="mt-2"
                      >
                        Add your first customer
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
