/**
 * Error Handling Service
 * Production-grade error handling with retry logic and logging
 */

export class AppError extends Error {
    constructor(
        public message: string,
        public statusCode: number = 500,
        public code?: string,
        public details?: any
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string) {
        super(
            `${resource}${identifier ? ` with identifier ${identifier}` : ''} not found`,
            404,
            'NOT_FOUND'
        );
    }
}

export class PermissionError extends AppError {
    constructor(action: string, resource: string) {
        super(`Permission denied to ${action} ${resource}`, 403, 'PERMISSION_DENIED');
    }
}

export class BusinessRuleError extends AppError {
    constructor(rule: string, details?: any) {
        super(`Business rule violation: ${rule}`, 422, 'BUSINESS_RULE_VIOLATION', details);
    }
}

/**
 * Retry decorator for transient failures.
 * 
 * Automatically retries failed operations with exponential backoff.
 * Use for network calls, database operations that may have transient issues.
 * 
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * 
 * @example
 * ```typescript
 * class MyService {
 *   @Retry(3, 1000)
 *   async fetchExternalData() {
 *     // This will retry up to 3 times with exponential backoff
 *   }
 * }
 * ```
 */
export function Retry(maxRetries: number = 3, baseDelay: number = 1000) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let lastError: any;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await originalMethod.apply(this, args);
                } catch (error: any) {
                    lastError = error;

                    // Don't retry validation or permission errors
                    if (error instanceof ValidationError || error instanceof PermissionError) {
                        throw error;
                    }

                    // Last attempt failed
                    if (attempt === maxRetries) {
                        throw error;
                    }

                    // Exponential backoff: 1s, 2s, 4s, 8s...
                    const delay = baseDelay * Math.pow(2, attempt);
                    await new Promise((resolve) => setTimeout(resolve, delay));

                    console.warn(
                        `Retry attempt ${attempt + 1}/${maxRetries} for ${propertyKey} after ${delay}ms`
                    );
                }
            }

            throw lastError;
        };

        return descriptor;
    };
}

/**
 * Circuit breaker pattern implementation.
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * 
 * **States:**
 * - CLOSED: Normal operation
 * - OPEN: Too many failures, reject immediately
 * - HALF_OPEN: Testing if service recovered
 */
export class CircuitBreaker {
    private failures: number = 0;
    private lastFailureTime: number = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

    constructor(
        private threshold: number = 5, // Open after 5 failures
        private timeout: number = 60000 // Try again after 60s
    ) { }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            // Check if timeout expired
            if (Date.now() - this.lastFailureTime > this.timeout) {
                this.state = 'HALF_OPEN';
            } else {
                throw new AppError('Service temporarily unavailable (circuit breaker OPEN)', 503);
            }
        }

        try {
            const result = await fn();

            // Success - reset or close circuit
            if (this.state === 'HALF_OPEN') {
                this.state = 'CLOSED';
                this.failures = 0;
            }

            return result;
        } catch (error) {
            this.failures++;
            this.lastFailureTime = Date.now();

            if (this.failures >= this.threshold) {
                this.state = 'OPEN';
                console.error(`Circuit breaker opened after ${this.failures} failures`);
            }

            throw error;
        }
    }

    getState() {
        return {
            state: this.state,
            failures: this.failures,
            lastFailureTime: this.lastFailureTime,
        };
    }

    reset() {
        this.failures = 0;
        this.state = 'CLOSED';
    }
}

/**
 * Safe wrapper for async operations with proper error handling.
 * 
 * @example
 * ```typescript
 * const [error, data] = await safe(
 *   supabaseServer.from('table').select()
 * );
 * 
 * if (error) {
 *   // Handle error
 * }
 * // Use data safely
 * ```
 */
export async function safe<T>(
    promise: Promise<T>
): Promise<[Error | null, T | null]> {
    try {
        const data = await promise;
        return [null, data];
    } catch (error) {
        return [error as Error, null];
    }
}
