import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Menu, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { navigationSections } from './AppSidebar';
import { useState } from 'react';
import { useCompany } from '@/hooks/useCompany';

export function MobileNav() {
    const [open, setOpen] = useState(false);
    const location = useLocation();
    const { data: company } = useCompany();
    const [openMenus, setOpenMenus] = useState<string[]>([]);

    const toggleMenu = (href: string) => {
        setOpenMenus(prev =>
            prev.includes(href)
                ? prev.filter(h => h !== href)
                : [...prev, href]
        );
    };

    const activeModules = company?.settings?.modules || {};

    const filteredSections = navigationSections
        .map(section => ({
            ...section,
            items: section.items.filter(item => {
                if (!item.module) return true;
                return activeModules[item.module as keyof typeof activeModules] === true;
            })
        }))
        .filter(section => section.items.length > 0);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                            Z
                        </div>
                        Ziyada ERP
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col h-full overflow-y-auto py-4">
                    <div className="space-y-6 px-4 pb-20">
                        {filteredSections.map((section) => (
                            <div key={section.title}>
                                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">
                                    {section.icon && <section.icon className="h-3.5 w-3.5" />}
                                    <span>{section.title}</span>
                                </div>
                                <ul className="space-y-1">
                                    {section.items.map((item) => {
                                        const isActive = location.pathname.startsWith(item.href) && item.href !== '/' || location.pathname === item.href;
                                        const hasChildren = item.children && item.children.length > 0;
                                        const isOpen = openMenus.includes(item.href);

                                        if (hasChildren) {
                                            return (
                                                <li key={item.href}>
                                                    <Collapsible open={isOpen} onOpenChange={() => toggleMenu(item.href)}>
                                                        <CollapsibleTrigger asChild>
                                                            <button className={cn(
                                                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors my-1",
                                                                isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                                            )}>
                                                                <div className="flex items-center gap-3">
                                                                    <item.icon className="h-4 w-4" />
                                                                    <span>{item.title}</span>
                                                                </div>
                                                                <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                                                            </button>
                                                        </CollapsibleTrigger>
                                                        <CollapsibleContent>
                                                            <ul className="mt-1 space-y-1 pl-6">
                                                                {item.children?.map(child => (
                                                                    <li key={child.href}>
                                                                        <Link
                                                                            to={child.href}
                                                                            onClick={() => setOpen(false)}
                                                                            className={cn(
                                                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                                                                location.pathname === child.href ? "text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                                                                            )}
                                                                        >
                                                                            <child.icon className="h-4 w-4" />
                                                                            <span>{child.title}</span>
                                                                        </Link>
                                                                    </li>
                                                                ))}
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
                                                    onClick={() => setOpen(false)}
                                                    className={cn(
                                                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors my-1",
                                                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
