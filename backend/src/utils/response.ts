/**
 * Response Utilities
 * Standard response formatters for API endpoints
 */

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Success response wrapper
 */
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
        success: true,
        data,
        message,
    };
}

/**
 * Error response wrapper
 */
export function errorResponse(error: string | Error, message?: string): ApiResponse {
    const errorMessage = error instanceof Error ? error.message : error;

    return {
        success: false,
        error: errorMessage,
        message: message || 'An error occurred',
    };
}

/**
 * Validation error response
 */
export function validationError(errors: Record<string, string>): ApiResponse {
    return {
        success: false,
        error: 'Validation failed',
        data: errors,
    };
}
