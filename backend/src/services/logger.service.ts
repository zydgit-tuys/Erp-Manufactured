/**
 * Logging Service
 * Structured logging for production monitoring
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export interface LogContext {
    userId?: string;
    companyId?: string;
    requestId?: string;
    duration?: number;
    method?: string;
    error?: string;
    stack?: string;
    metadata?: Record<string, any>;
    [key: string]: any; // Allow additional properties
}

class Logger {
    private level: LogLevel = LogLevel.INFO;

    setLevel(level: LogLevel) {
        this.level = level;
    }

    private log(level: LogLevel, message: string, context?: LogContext) {
        if (level < this.level) return;

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: LogLevel[level],
            message,
            ...context,
        };

        // In production, send to logging service (e.g., CloudWatch, Datadog)
        // For now, console with structured format
        console.log(JSON.stringify(logEntry));
    }

    debug(message: string, context?: LogContext) {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: LogContext) {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: LogContext) {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, error?: Error, context?: LogContext) {
        this.log(LogLevel.ERROR, message, {
            ...context,
            error: error?.message,
            stack: error?.stack,
        });
    }

    /**
     * Performance monitoring decorator.
     * 
     * @example
     * ```typescript
     * class MyService {
     *   @LogPerformance()
     *   async slowOperation() {
     *     // Execution time will be logged
     *   }
 }
     * ```
     */
    static Performance() {
        return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
            const originalMethod = descriptor.value;

            descriptor.value = async function (...args: any[]) {
                const start = Date.now();
                try {
                    const result = await originalMethod.apply(this, args);
                    const duration = Date.now() - start;

                    logger.info(`${propertyKey} completed`, { duration, method: propertyKey });

                    return result;
                } catch (error: any) {
                    const duration = Date.now() - start;
                    logger.error(`${propertyKey} failed`, error, { duration, method: propertyKey });
                    throw error;
                }
            };

            return descriptor;
        };
    }
}

export const logger = new Logger();

/**
 * Request correlation ID middleware helper
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
