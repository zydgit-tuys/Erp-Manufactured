import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, ChevronDown, Plus, BookOpen, Edit2, Trash2, Settings, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useChartOfAccounts,
  useAccountMappings,
  useUpdateAccountMapping,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  Account
} from '@/hooks/useAccounting';
import { useApp } from '@/contexts/AppContext';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// --- Types & Constants ---
const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const ACCOUNT_CATEGORIES: Record<string, string[]> = {
  ASSET: ['CURRENT_ASSET', 'FIXED_ASSET', 'INVENTORY'],
  LIABILITY: ['CURRENT_LIABILITY', 'LONG_TERM_LIABILITY'],
  EQUITY: ['CAPITAL', 'RETAINED_EARNINGS'],
  REVENUE: ['SALES_REVENUE', 'OTHER_INCOME'],
  EXPENSE: ['COGS', 'OPERATING_EXPENSE', 'OTHER_EXPENSE']
};

// --- Components ---

function AccountTreeItem({ account, level = 0, onEdit, onDelete }: {
  account: Account;
  level?: number;
  onEdit: (account: Account) => void;
  onDelete: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = account.children && account.children.length > 0;

  const typeColors: Record<string, string> = {
    ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    LIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    EQUITY: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    REVENUE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    EXPENSE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  };

  return (
    <div className="group">
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors',
          account.is_header && 'font-semibold'
        )}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}
        <span className="font-mono text-sm text-muted-foreground w-16 flex-shrink-0">
          {account.account_code}
        </span>
        <span className="flex-1 truncate">{account.account_name}</span>

        {level === 0 && (
          <Badge variant="secondary" className={cn('text-xs mr-2', typeColors[account.account_type])}>
            {account.account_type}
          </Badge>
        )}

        {/* Actions (Visible on Hover) */}
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(account); }}>
            <Edit2 className="h-3 w-3" />
          </Button>
          {!account.is_header && !hasChildren && ( // Only leaf nodes or empty headers usually deleteable
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(account.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {account.children!.map((child) => (
            <AccountTreeItem key={child.id} account={child} level={level + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page Component ---

export default function ChartOfAccounts() {
  const { companyId } = useApp();
  const { toast } = useToast();

  // Data Fetching
  const { data: coaData, isLoading: isCoaLoading, refetch: refetchCoa } = useChartOfAccounts(companyId);
  const { data: mappingsData, isLoading: isMappingsLoading, refetch: refetchMappings } = useAccountMappings(companyId);

  // Mutations
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const updateMapping = useUpdateAccountMapping();

  // State
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<Account>>({
    account_type: 'ASSET',
    account_category: 'CURRENT_ASSET',
    is_header: false,
    is_active: true,
    normal_balance: 'DEBIT'
  });

  const handleAddAccount = () => {
    setEditingAccount(null);
    setFormData({
      account_type: 'ASSET',
      account_category: 'CURRENT_ASSET',
      is_header: false,
      is_active: true,
      normal_balance: 'DEBIT',
      company_id: companyId
    });
    setIsAccountDialogOpen(true);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccount(account);
    setFormData({ ...account });
    setIsAccountDialogOpen(true);
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Are you sure you want to delete this account? This cannot be undone if transactions exist.')) {
      await deleteAccount.mutateAsync(id);
    }
  };

  const handleSaveAccount = async () => {
    try {
      if (editingAccount) {
        await updateAccount.mutateAsync({ id: editingAccount.id, updates: formData });
      } else {
        await createAccount.mutateAsync(formData);
      }
      setIsAccountDialogOpen(false);
    } catch (error) {
      // Toast handled by hook
    }
  };

  const handleSeedMappings = async () => {
    try {
      const { error } = await supabase.rpc('seed_account_mappings', { p_company_id: companyId });
      if (error) throw error;

      toast({ title: 'Success', description: 'Default account mappings have been generated.' });
      refetchMappings();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Stats
  const accounts = coaData?.flat || [];
  const assetCount = accounts.filter(a => a.account_type === 'ASSET').length;
  const liabilityCount = accounts.filter(a => a.account_type === 'LIABILITY').length;
  const equityCount = accounts.filter(a => a.account_type === 'EQUITY').length;
  const revenueCount = accounts.filter(a => a.account_type === 'REVENUE').length;
  const expenseCount = accounts.filter(a => a.account_type === 'EXPENSE').length;

  if (isCoaLoading && !coaData) {
    return (
      <AppLayout>
        <div className="space-y-4 p-8">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Manage your financial accounts and system configurations
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddAccount}>
              <Plus className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Accounts Overview</TabsTrigger>
            <TabsTrigger value="structure">Account Tree</TabsTrigger>
            <TabsTrigger value="configuration">
              <Settings className="mr-2 h-3 w-3" />
              Account Mapping
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              {/* Stat Cards */}
              <Card className="shadow-card border-t-4 border-t-blue-500">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assets</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{assetCount}</div></CardContent>
              </Card>
              <Card className="shadow-card border-t-4 border-t-red-500">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Liabilities</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{liabilityCount}</div></CardContent>
              </Card>
              <Card className="shadow-card border-t-4 border-t-purple-500">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Equity</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{equityCount}</div></CardContent>
              </Card>
              <Card className="shadow-card border-t-4 border-t-green-500">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{revenueCount}</div></CardContent>
              </Card>
              <Card className="shadow-card border-t-4 border-t-orange-500">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{expenseCount}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick View</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-6 rounded-lg text-center text-muted-foreground">
                  Switch to "Account Tree" tab to manage hierarchy or "Configuration" to map default accounts.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structure">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Account Structure
                </CardTitle>
                <CardDescription>Click items to expand. Hover to edit actions.</CardDescription>
              </CardHeader>
              <CardContent>
                {!coaData?.tree || coaData.tree.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="No Accounts"
                    description="Start by adding your first account."
                    action={<Button onClick={handleAddAccount}>Add Account</Button>}
                  />
                ) : (
                  <div className="space-y-1">
                    {coaData.tree.map((account) => (
                      <AccountTreeItem
                        key={account.id}
                        account={account}
                        onEdit={handleEditAccount}
                        onDelete={handleDeleteAccount}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration">
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Account Mapping
                  </CardTitle>
                  <CardDescription>
                    Map system functions to your specific accounts. These defaults act as the "glue" for automated journaling.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleSeedMappings}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Defaults
                </Button>
              </CardHeader>
              <CardContent>
                {isMappingsLoading ? (
                  <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                ) : !mappingsData || mappingsData.length === 0 ? (
                  <EmptyState
                    icon={Settings}
                    title="No Mappings Configured"
                    description="Click 'Reset Defaults' to generate standard account mappings based on your COA."
                    action={<Button onClick={handleSeedMappings}>Generate Defaults</Button>}
                  />
                ) : (
                  <div className="grid gap-6">
                    {mappingsData.map((mapping: any) => (
                      <div key={mapping.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center gap-2">
                            {mapping.mapping_code.replace(/_/g, ' ')}
                            <Badge variant="outline" className="text-[10px] font-mono">{mapping.mapping_code}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{mapping.description}</p>
                        </div>
                        <div className="w-[300px]">
                          <Select
                            value={mapping.account_id || ''}
                            onValueChange={(val) => updateMapping.mutate({ id: mapping.id, account_id: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Account" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id} disabled={acc.is_header}>
                                  <span className="font-mono mr-2 text-muted-foreground">{acc.account_code}</span>
                                  {acc.account_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Modal */}
        <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit Account' : 'New Account'}</DialogTitle>
              <DialogDescription>
                {editingAccount ? 'Modify account details.' : 'Add a new account to your chart.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Code</Label>
                  <Input
                    value={formData.account_code || ''}
                    onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                    placeholder="e.g. 1010"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={formData.account_type || 'ASSET'}
                    onValueChange={(val: any) => setFormData({ ...formData, account_type: val, account_category: ACCOUNT_CATEGORIES[val][0] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input
                  value={formData.account_name || ''}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g. Cash in Hand"
                />
              </div>

              <div className="space-y-2">
                <Label>Sub-Category</Label>
                <Select
                  value={formData.account_category || ''}
                  onValueChange={(val) => setFormData({ ...formData, account_category: val })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(ACCOUNT_CATEGORIES[formData.account_type!] || []).map(c => (
                      <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Normal Balance</Label>
                  <Select
                    value={formData.normal_balance || 'DEBIT'}
                    onValueChange={(val: any) => setFormData({ ...formData, normal_balance: val })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parent Account (Optional)</Label>
                  <Select
                    value={formData.parent_account_id || 'none'}
                    onValueChange={(val) => setFormData({ ...formData, parent_account_id: val === 'none' ? undefined : val })}
                  >
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent className="max-h-[200px]">
                      <SelectItem value="none">None (Top Level)</SelectItem>
                      {accounts
                        .filter(a => a.id !== editingAccount?.id && a.is_header) // Can only be parent if header
                        .map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.account_code} - {a.account_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Checkbox for Is Header */}
              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_header"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={formData.is_header || false}
                  onChange={(e) => setFormData({ ...formData, is_header: e.target.checked })}
                />
                <Label htmlFor="is_header">Is Header Account (Cannot have transactions)</Label>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAccount}>
                {editingAccount ? 'Save Changes' : 'Create Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
