export interface LogContext {
    requestId?: string;
    userId?: string;
    companyId?: string;
    operation?: string;
    [key: string]: any;
}

export class Logger {
    private context: LogContext;

    constructor(context: LogContext = {}) {
        this.context = context;
    }

    private log(level: string, message: string, data?: any) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.context,
            ...(data && { data })
        };

        console.log(JSON.stringify(logEntry));
    }

    info(message: string, data?: any) {
        this.log('INFO', message, data);
    }

    warn(message: string, data?: any) {
        this.log('WARN', message, data);
    }

    error(message: string, error?: any) {
        this.log('ERROR', message, {
            error: error?.message || error,
            stack: error?.stack
        });
    }

    debug(message: string, data?: any) {
        this.log('DEBUG', message, data);
    }
}

export function createLogger(context: LogContext): Logger {
    return new Logger(context);
}

// Retry utility with exponential backoff
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            const isLastAttempt = attempt === maxRetries - 1;

            if (isLastAttempt) {
                console.error(`Failed after ${maxRetries} attempts:`, error);
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Retry logic failed unexpectedly');
}

// Performance tracking utility
export class PerformanceTracker {
    private startTime: number;
    private checkpoints: Map<string, number>;

    constructor() {
        this.startTime = Date.now();
        this.checkpoints = new Map();
    }

    checkpoint(name: string) {
        this.checkpoints.set(name, Date.now() - this.startTime);
    }

    getMetrics() {
        return {
            totalDuration: Date.now() - this.startTime,
            checkpoints: Object.fromEntries(this.checkpoints)
        };
    }
}
