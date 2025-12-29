import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
    title?: string;
    message: string;
    onRetry?: () => void;
}

export function ErrorState({
    title = 'Something went wrong',
    message,
    onRetry
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-3">
                <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
                {message}
            </p>
            {onRetry && (
                <Button onClick={onRetry} variant="outline">
                    Try Again
                </Button>
            )}
        </div>
    );
}
