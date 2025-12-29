import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
    rows?: number;
    columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="flex gap-4">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton key={colIndex} className="h-12 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

interface CardSkeletonProps {
    count?: number;
}

export function CardSkeleton({ count = 3 }: CardSkeletonProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="space-y-3 rounded-lg border p-6">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ))}
        </div>
    );
}
