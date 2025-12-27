/**
 * Logger Utility
 * Centralized logging for backend services
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
}

class Logger {
    private context: string;

    constructor(context: string = 'App') {
        this.context = context;
    }

    private log(level: LogLevel, message: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${this.context}]`;

        console.log(prefix, message, ...args);
    }

    debug(message: string, ...args: any[]) {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    info(message: string, ...args: any[]) {
        this.log(LogLevel.INFO, message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.log(LogLevel.WARN, message, ...args);
    }

    error(message: string, error?: Error, ...args: any[]) {
        this.log(LogLevel.ERROR, message, error?.stack || error, ...args);
    }
}

export function createLogger(context: string): Logger {
    return new Logger(context);
}

export const logger = new Logger('Backend');
