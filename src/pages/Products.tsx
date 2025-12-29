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
import { Plus, Search, Package, Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProducts, useUpdateProduct, useDeleteProduct } from '@/hooks/useMasterData';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { companyId } = useApp();

  // Data Hooks
  const { data: products, isLoading, error, refetch } = useProducts(companyId);
  const { mutateAsync: updateProduct } = useUpdateProduct();
  const { mutateAsync: deleteProduct } = useDeleteProduct();

  const filteredProducts = (products || []).filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusToggle = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    try {
      await updateProduct({
        id,
        is_active: !currentStatus
      });
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
        await deleteProduct(deleteId);
        setDeleteId(null);
      } catch (error) {
        console.error("Failed to delete product", error);
      }
    }
  };

  if (error) {
    return (
      <AppLayout>
        <ErrorState
          title="Failed to load products"
          message={error.message}
          onRetry={() => refetch()}
        />
      </AppLayout>
    );
  }

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
              <div className="text-2xl font-bold">{products?.length || 0}</div>
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
                {products?.reduce((sum, p) => sum + (p.variants?.length || 0), 0) || 0}
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
            {isLoading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title={searchQuery ? "No products found" : "No products yet"}
                description={
                  searchQuery
                    ? "Try adjusting your search terms"
                    : "Get started by adding your first product"
                }
                action={
                  !searchQuery && (
                    <Button onClick={() => navigate('/products/new')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Product
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
                    <TableHead className="text-right">Std Cost</TableHead>
                    <TableHead className="text-right">Base Price</TableHead>
                    <TableHead className="text-center">Variants</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow
                      key={product.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {product.code}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">{product.category || 'Uncategorized'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        Rp {(product.standard_cost || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        Rp {(product.selling_price || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-mono">
                          {product.variants?.length || 0} SKUs
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/products/${product.id}`);
                            }}
                          >
                            <Edit className="h-4 w-4 text-muted-foreground hover:text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteClick(product.id, e)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the product and all its variants.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
