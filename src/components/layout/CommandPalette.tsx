import * as React from "react"
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    Package,
    ShoppingCart,
    Factory,
    Users,
    Box,
    Plus,
    Search,
    FileText
} from "lucide-react"

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { useNavigate } from "react-router-dom"

export function CommandPalette() {
    const [open, setOpen] = React.useState(false)
    const navigate = useNavigate()

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setOpen((open) => !open)
            }
        }

        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false)
        command()
    }, [])

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Quick Actions">
                    <CommandItem onSelect={() => runCommand(() => navigate('/purchasing/new'))}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Create Purchase Order</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/sales/new'))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Create Sales Order</span>
                        <CommandShortcut>⌘S</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/master-data/products'))}>
                        <Plus className="mr-2 h-4 w-4" />
                        <span>New Product</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => runCommand(() => navigate('/dashboard'))}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/inventory/raw-materials'))}>
                        <Package className="mr-2 h-4 w-4" />
                        <span>Inventory</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/purchasing/orders'))}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Purchasing</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/sales/orders'))}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Sales</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/production/work-orders'))}>
                        <Factory className="mr-2 h-4 w-4" />
                        <span>Production</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/reports/margin'))}>
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Reports</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/settings/team'))}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Master Data">
                    <CommandItem onSelect={() => runCommand(() => navigate('/master-data/products'))}>
                        <Box className="mr-2 h-4 w-4" />
                        <span>Products</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/master-data/vendors'))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Vendors</span>
                    </CommandItem>
                    <CommandItem onSelect={() => runCommand(() => navigate('/master-data/customers'))}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Customers</span>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    )
}
