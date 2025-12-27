import { describe, it, expect } from '@jest/globals';
import { successResponse, errorResponse, validationError } from '../utils/response';

describe('Response Utils', () => {
    describe('successResponse', () => {
        it('should create a success response', () => {
            const result = successResponse({ id: 1, name: 'Test' });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 1, name: 'Test' });
        });

        it('should include optional message', () => {
            const result = successResponse({}, 'Operation successful');

            expect(result.message).toBe('Operation successful');
        });
    });

    describe('errorResponse', () => {
        it('should create an error response from string', () => {
            const result = errorResponse('Something went wrong');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Something went wrong');
        });

        it('should create an error response from Error object', () => {
            const error = new Error('Test error');
            const result = errorResponse(error);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Test error');
        });
    });

    describe('validationError', () => {
        it('should create a validation error response', () => {
            const errors = { email: 'Invalid email', password: 'Too short' };
            const result = validationError(errors);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Validation failed');
            expect(result.data).toEqual(errors);
        });
    });
});
