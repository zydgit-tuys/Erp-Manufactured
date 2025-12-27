import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, Plus, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  isHeader: boolean;
  children?: Account[];
}

const chartOfAccounts: Account[] = [
  {
    id: '1',
    code: '1000',
    name: 'Assets',
    type: 'asset',
    isHeader: true,
    children: [
      {
        id: '1.1',
        code: '1100',
        name: 'Current Assets',
        type: 'asset',
        isHeader: true,
        children: [
          { id: '1.1.1', code: '1110', name: 'Cash', type: 'asset', isHeader: false },
          { id: '1.1.2', code: '1120', name: 'Bank', type: 'asset', isHeader: false },
          { id: '1.1.3', code: '1130', name: 'Accounts Receivable', type: 'asset', isHeader: false },
          { id: '1.1.4', code: '1140', name: 'Inventory - Raw Materials', type: 'asset', isHeader: false },
          { id: '1.1.5', code: '1150', name: 'Inventory - WIP', type: 'asset', isHeader: false },
          { id: '1.1.6', code: '1160', name: 'Inventory - Finished Goods', type: 'asset', isHeader: false },
        ],
      },
      {
        id: '1.2',
        code: '1200',
        name: 'Fixed Assets',
        type: 'asset',
        isHeader: true,
        children: [
          { id: '1.2.1', code: '1210', name: 'Machinery & Equipment', type: 'asset', isHeader: false },
          { id: '1.2.2', code: '1220', name: 'Accumulated Depreciation', type: 'asset', isHeader: false },
        ],
      },
    ],
  },
  {
    id: '2',
    code: '2000',
    name: 'Liabilities',
    type: 'liability',
    isHeader: true,
    children: [
      {
        id: '2.1',
        code: '2100',
        name: 'Current Liabilities',
        type: 'liability',
        isHeader: true,
        children: [
          { id: '2.1.1', code: '2110', name: 'Accounts Payable', type: 'liability', isHeader: false },
          { id: '2.1.2', code: '2120', name: 'Accrued Expenses', type: 'liability', isHeader: false },
          { id: '2.1.3', code: '2130', name: 'Tax Payable', type: 'liability', isHeader: false },
        ],
      },
    ],
  },
  {
    id: '3',
    code: '3000',
    name: 'Equity',
    type: 'equity',
    isHeader: true,
    children: [
      { id: '3.1', code: '3100', name: "Owner's Capital", type: 'equity', isHeader: false },
      { id: '3.2', code: '3200', name: 'Retained Earnings', type: 'equity', isHeader: false },
    ],
  },
  {
    id: '4',
    code: '4000',
    name: 'Revenue',
    type: 'revenue',
    isHeader: true,
    children: [
      { id: '4.1', code: '4100', name: 'Sales Revenue', type: 'revenue', isHeader: false },
      { id: '4.2', code: '4200', name: 'Sales Discount', type: 'revenue', isHeader: false },
      { id: '4.3', code: '4300', name: 'Sales Returns', type: 'revenue', isHeader: false },
    ],
  },
  {
    id: '5',
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'expense',
    isHeader: true,
    children: [
      { id: '5.1', code: '5100', name: 'Material Cost', type: 'expense', isHeader: false },
      { id: '5.2', code: '5200', name: 'Direct Labor Cost', type: 'expense', isHeader: false },
      { id: '5.3', code: '5300', name: 'Manufacturing Overhead', type: 'expense', isHeader: false },
    ],
  },
  {
    id: '6',
    code: '6000',
    name: 'Operating Expenses',
    type: 'expense',
    isHeader: true,
    children: [
      { id: '6.1', code: '6100', name: 'Salaries & Wages', type: 'expense', isHeader: false },
      { id: '6.2', code: '6200', name: 'Rent Expense', type: 'expense', isHeader: false },
      { id: '6.3', code: '6300', name: 'Utilities', type: 'expense', isHeader: false },
      { id: '6.4', code: '6400', name: 'Depreciation Expense', type: 'expense', isHeader: false },
      { id: '6.5', code: '6500', name: 'Other Operating Expenses', type: 'expense', isHeader: false },
    ],
  },
];

function AccountTreeItem({ account, level = 0 }: { account: Account; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = account.children && account.children.length > 0;

  const typeColors: Record<string, string> = {
    asset: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    liability: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    equity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    revenue: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    expense: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors',
          account.isHeader && 'font-semibold'
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
          {account.code}
        </span>
        <span className="flex-1">{account.name}</span>
        {level === 0 && (
          <Badge variant="secondary" className={cn('text-xs', typeColors[account.type])}>
            {account.type}
          </Badge>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {account.children!.map((child) => (
            <AccountTreeItem key={child.id} account={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChartOfAccounts() {
  const totalAccounts = chartOfAccounts.reduce((sum, acc) => {
    const countChildren = (a: Account): number => {
      if (!a.children) return 1;
      return 1 + a.children.reduce((s, c) => s + countChildren(c), 0);
    };
    return sum + countChildren(acc);
  }, 0);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
            <p className="text-muted-foreground">
              Konveksi accounting template
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">10</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">5</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">3</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">4</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">15</div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Account Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {chartOfAccounts.map((account) => (
                <AccountTreeItem key={account.id} account={account} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
