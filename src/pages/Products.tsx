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
import { Plus, Search, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Sample data for demo
const sampleProducts = [
  { id: '1', code: 'TS-001', name: 'Kaos Polos Basic', basePrice: 45000, variants: 9, isActive: true },
  { id: '2', code: 'TS-002', name: 'Kaos Raglan Sport', basePrice: 55000, variants: 9, isActive: true },
  { id: '3', code: 'TS-003', name: 'Polo Shirt Classic', basePrice: 75000, variants: 9, isActive: true },
  { id: '4', code: 'TS-004', name: 'Jersey Olahraga', basePrice: 85000, variants: 9, isActive: true },
  { id: '5', code: 'TS-005', name: 'Hoodie Premium', basePrice: 150000, variants: 9, isActive: false },
];

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filteredProducts = sampleProducts.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground">
              Manage your product catalog and variants
            </p>
          </div>
          <Button onClick={() => navigate('/products/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleProducts.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total SKUs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleProducts.reduce((sum, p) => sum + p.variants, 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleProducts.filter((p) => p.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Table */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
                  <TableHead className="text-right">Base Price</TableHead>
                  <TableHead className="text-center">Variants</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {product.code}
                    </TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">
                      Rp {product.basePrice.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">{product.variants}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.isActive ? 'default' : 'secondary'}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-muted-foreground">No products found</p>
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
