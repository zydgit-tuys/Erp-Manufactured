import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Layers,
  Truck,
  Users,
  BookOpen,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Boxes,
  Factory,
  PackageCheck,
  ClipboardCheck,
  ArrowLeftRight,
  ShoppingCart,
  BarChart3,
  Banknote,
  FileText,
  ShoppingBag,
  Wallet,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCompany } from '@/hooks/useCompany';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: NavItem[];
  module?: 'finance' | 'marketplace' | 'analytics' | 'manufacturing';
}

interface NavSection {
  title: string;
  icon?: React.ElementType;
  items: NavItem[];
}

const navigationSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Master Data',
    icon: Database,
    items: [
      { title: 'Products', href: '/products', icon: Package },
      { title: 'Materials', href: '/materials', icon: Layers },
      { title: 'Customers', href: '/customers', icon: Users },
      { title: 'Vendors', href: '/vendors', icon: Truck },
    ]
  },
  {
    title: 'Transactions',
    icon: ShoppingBag,
    items: [
      {
        title: 'Sales',
        href: '/sales',
        icon: ShoppingBag,
        children: [
          { title: 'Sales Orders', href: '/sales/orders', icon: ClipboardCheck },
          { title: 'POS', href: '/sales/pos', icon: ShoppingCart },
          { title: 'Invoices', href: '/sales/invoices', icon: FileText },
          { title: 'Shipments', href: '/sales/shipments', icon: Truck },
        ]
      },
      {
        title: 'Purchasing',
        href: '/purchasing',
        icon: ShoppingCart,
        children: [
          { title: 'Purchase Orders', href: '/purchasing/orders', icon: ClipboardCheck },
          { title: 'Receipts', href: '/purchasing/receipts', icon: PackageCheck },
          { title: 'Vendor Invoices', href: '/purchasing/invoices', icon: Banknote },
        ]
      },
      {
        title: 'Inventory',
        href: '/inventory',
        icon: Boxes,
        children: [
          { title: 'Raw Materials', href: '/inventory/raw', icon: Layers },
          { title: 'Work in Progress', href: '/inventory/wip', icon: Factory },
          { title: 'Finished Goods', href: '/inventory/fg', icon: PackageCheck },
          { title: 'Adjustments', href: '/inventory/adjustments', icon: ClipboardCheck },
          { title: 'Transfers', href: '/inventory/transfers', icon: ArrowLeftRight },
        ]
      },
    ]
  },
  {
    title: 'Operations',
    icon: Factory,
    items: [
      {
        title: 'Production',
        href: '/production',
        icon: Factory,
        module: 'manufacturing',
        children: [
          { title: 'Bill of Materials', href: '/production/boms', icon: Layers },
          { title: 'Work Orders', href: '/production/work-orders', icon: ClipboardCheck },
          { title: 'Operations', href: '/production/operations', icon: Settings },
        ],
      },
    ]
  },
  {
    title: 'Finance',
    icon: Wallet,
    items: [
      { title: 'Chart of Accounts', href: '/coa', icon: BookOpen, module: 'finance' },
      { title: 'Accounting Periods', href: '/periods', icon: Calendar, module: 'finance' },
    ]
  },
  {
    title: 'System',
    icon: Settings,
    items: [
      { title: 'Analytics', href: '/analytics', icon: BarChart3, module: 'analytics' },
      { title: 'Marketplace', href: '/marketplace', icon: ShoppingCart, module: 'marketplace' },
      { title: 'Settings', href: '/settings', icon: Settings },
    ]
  },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['/inventory', '/sales', '/purchasing']);
  const { data: company } = useCompany();

  const toggleMenu = (href: string) => {
    setOpenMenus(prev =>
      prev.includes(href)
        ? prev.filter(h => h !== href)
        : [...prev, href]
    );
  };

  const isActiveRoute = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const activeModules = company?.settings?.modules || {};

  const filterItems = (items: NavItem[]): NavItem[] => {
    return items.filter(item => {
      if (!item.module) return true;
      return activeModules[item.module as keyof typeof activeModules] === true;
    });
  };

  const filteredSections = navigationSections
    .map(section => ({
      ...section,
      items: filterItems(section.items)
    }))
    .filter(section => section.items.length > 0);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex h-screen flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold">
                Z
              </div>
              <span className="font-semibold text-lg">Ziyada ERP</span>
            </Link>
          )}
          {collapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold mx-auto">
              Z
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6">
            {filteredSections.map((section, sectionIndex) => (
              <div key={section.title}>
                {/* Section Header */}
                {!collapsed && section.title !== 'Dashboard' && (
                  <div className="px-4 mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                      {section.icon && <section.icon className="h-3.5 w-3.5" />}
                      <span>{section.title}</span>
                    </div>
                  </div>
                )}

                {/* Section Items */}
                <ul className="space-y-1 px-2">
                  {section.items.map((item) => {
                    const isActive = isActiveRoute(item.href);
                    const hasChildren = item.children && item.children.length > 0;
                    const isOpen = openMenus.includes(item.href);

                    if (hasChildren) {
                      return (
                        <li key={item.href}>
                          <Collapsible
                            open={isOpen}
                            onOpenChange={() => !collapsed && toggleMenu(item.href)}
                          >
                            <CollapsibleTrigger asChild>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      toggleMenu(item.href);
                                    }}
                                    className={cn(
                                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                      isActive
                                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                    )}
                                  >
                                    <item.icon className="h-5 w-5 flex-shrink-0" />
                                    {!collapsed && (
                                      <>
                                        <span className="flex-1 text-left">{item.title}</span>
                                        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                                      </>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                {collapsed && (
                                  <TooltipContent side="right">
                                    {item.title}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <ul className="mt-1 space-y-1 pl-4">
                                {item.children?.map((child) => {
                                  const isChildActive = location.pathname === child.href;
                                  return (
                                    <li key={child.href}>
                                      <Link
                                        to={child.href}
                                        className={cn(
                                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                          isChildActive
                                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                                            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                                        )}
                                      >
                                        <child.icon className="h-4 w-4 flex-shrink-0" />
                                        <span>{child.title}</span>
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </CollapsibleContent>
                          </Collapsible>
                        </li>
                      );
                    }

                    return (
                      <li key={item.href}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              to={item.href}
                              className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                              )}
                            >
                              <item.icon className="h-5 w-5 flex-shrink-0" />
                              {!collapsed && <span>{item.title}</span>}
                            </Link>
                          </TooltipTrigger>
                          {collapsed && (
                            <TooltipContent side="right">
                              {item.title}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>

                {/* Divider between sections (except last) */}
                {!collapsed && sectionIndex < filteredSections.length - 1 && (
                  <div className="mx-4 mt-4 border-t border-sidebar-border/50" />
                )}
              </div>
            ))}
          </div>
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(!collapsed)}
                className="w-full justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    <span>Collapse</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                Expand Sidebar
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
