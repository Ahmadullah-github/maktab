/**
 * Debug logging utilities for Schedule feature
 *
 * Provides structured logging for development and debugging
 * Following the pattern from teachers feature
 */

const FEATURE_PREFIX = '[Schedule]';
const DEBUG_ENABLED = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Creates a formatted log message with feature prefix
 */
function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `${timestamp} ${FEATURE_PREFIX} [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Main logger for Schedule feature
 */
export const logger = {
  /**
   * Debug level logging (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (DEBUG_ENABLED) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    console.info(formatMessage('info', message, context));
  },

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext): void {
    console.error(formatMessage('error', message, context));
  },
};

/**
 * API-specific logger for request/response tracking
 */
export const apiLogger = {
  /**
   * Log API request
   */
  request(method: string, endpoint: string, payload?: unknown): void {
    logger.debug(`API Request: ${method} ${endpoint}`, payload ? { payload } : undefined);
  },

  /**
   * Log API response
   */
  response(method: string, endpoint: string, status: number, data?: unknown): void {
    logger.debug(`API Response: ${method} ${endpoint} [${status}]`, data ? { data } : undefined);
  },

  /**
   * Log API error
   */
  error(method: string, endpoint: string, error: unknown): void {
    logger.error(`API Error: ${method} ${endpoint}`, { error });
  },
};
