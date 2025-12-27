import { describe, it, expect } from '@jest/globals';
import { createLogger, LogLevel } from '../utils/logger';

describe('Logger Utils', () => {
    describe('createLogger', () => {
        it('should create a logger with context', () => {
            const logger = createLogger('TestContext');
            expect(logger).toBeDefined();
        });
    });

    describe('Logger instance', () => {
        const logger = createLogger('TestLogger');

        it('should have debug method', () => {
            expect(typeof logger.debug).toBe('function');
        });

        it('should have info method', () => {
            expect(typeof logger.info).toBe('function');
        });

        it('should have warn method', () => {
            expect(typeof logger.warn).toBe('function');
        });

        it('should have error method', () => {
            expect(typeof logger.error).toBe('function');
        });
    });

    describe('LogLevel enum', () => {
        it('should have correct log levels', () => {
            expect(LogLevel.DEBUG).toBe('DEBUG');
            expect(LogLevel.INFO).toBe('INFO');
            expect(LogLevel.WARN).toBe('WARN');
            expect(LogLevel.ERROR).toBe('ERROR');
        });
    });
});
