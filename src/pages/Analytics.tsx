import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3 } from 'lucide-react';

export default function Analytics() {
    return (
        <AppLayout>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
                <EmptyState
                    icon={BarChart3}
                    title="Business Analytics"
                    description="Deep insights into your sales, production, and inventory performance coming soon."
                    action={null}
                />
            </div>
        </AppLayout>
    );
}
