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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCompany } from '@/hooks/useCompany';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  children?: NavItem[];
  module?: 'finance' | 'marketplace' | 'analytics' | 'manufacturing';
}

const navigation: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Products', href: '/products', icon: Package },
  { title: 'Materials', href: '/materials', icon: Layers },
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
  { title: 'Vendors', href: '/vendors', icon: Truck },
  { title: 'Customers', href: '/customers', icon: Users },
  { title: 'Marketplace', href: '/marketplace', icon: ShoppingCart, module: 'marketplace' },
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
  { title: 'Chart of Accounts', href: '/coa', icon: BookOpen, module: 'finance' },
  { title: 'Accounting Periods', href: '/periods', icon: Calendar, module: 'finance' },
  { title: 'Analytics', href: '/analytics', icon: BarChart3, module: 'analytics' },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>(['/inventory']);
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

  const filteredNavigation = navigation.filter(item => {
    if (!item.module) return true; // Always show if no module specified
    return activeModules[item.module as keyof typeof activeModules] === true;
  });

  return (
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
        <ul className="space-y-1 px-2">
          {filteredNavigation.map((item) => {
            const isActive = isActiveRoute(item.href);
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openMenus.includes(item.href);

            if (hasChildren) {
              return (
                <li key={item.href}>
                  <Collapsible open={!collapsed && isOpen} onOpenChange={() => toggleMenu(item.href)}>
                    <CollapsibleTrigger asChild>
                      <button
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
                                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
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
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
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
      </div>
    </aside>
  );
}
