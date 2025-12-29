import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { ShoppingCart } from 'lucide-react';

export default function Marketplace() {
    return (
        <AppLayout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
                <EmptyState
                    icon={ShoppingCart}
                    title="Marketplace Integration"
                    description="Connect your store to external marketplaces (Shopee, Tokopedia, TikTok Shop)."
                    action={null}
                />
            </div>
        </AppLayout>
    );
}
