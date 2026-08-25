/**
 * Debug logger utility for the Rooms feature
 *
 * Provides structured logging with different levels for debugging,
 * component lifecycle tracking, and API call monitoring
 *
 * Requirements: 1.1
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

/**
 * Determines if debug logging is enabled
 * Can be controlled via environment variable or localStorage
 */
function isDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('debug:rooms') === 'true';
  }
  return import.meta.env.DEV;
}

/**
 * Formats a log message with timestamp and context
 */
function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [rooms] [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }

  return `${prefix} ${message}`;
}

/**
 * Logger instance for the Rooms feature
 *
 * Usage:
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.debug('Fetching rooms');
 * logger.info('Room created', { id: 1, name: 'Lab 101' });
 * logger.warn('Room already exists', { name: 'Lab 101' });
 * logger.error('Failed to save room', { error });
 * ```
 */
export const logger = {
  /**
   * Debug level logging - only shown when debug mode is enabled
   */
  debug(message: string, context?: LogContext): void {
    if (isDebugEnabled()) {
      console.debug(formatMessage('debug', message, context));
    }
  },

  /**
   * Info level logging - general information
   */
  info(message: string, context?: LogContext): void {
    console.info(formatMessage('info', message, context));
  },

  /**
   * Warning level logging - potential issues
   */
  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('warn', message, context));
  },

  /**
   * Error level logging - errors and failures
   */
  error(message: string, context?: LogContext): void {
    console.error(formatMessage('error', message, context));
  },
};

/**
 * Component lifecycle logging helpers
 *
 * Usage in React components:
 * ```typescript
 * useEffect(() => {
 *   componentLogger.mount('RoomDataGrid');
 *   return () => componentLogger.unmount('RoomDataGrid');
 * }, []);
 * ```
 */
export const componentLogger = {
  /**
   * Log component mount event
   */
  mount(componentName: string, props?: LogContext): void {
    logger.debug(`${componentName} mounted`, props);
  },

  /**
   * Log component unmount event
   */
  unmount(componentName: string): void {
    logger.debug(`${componentName} unmounted`);
  },

  /**
   * Log component update/render event
   */
  update(componentName: string, reason?: string, context?: LogContext): void {
    logger.debug(`${componentName} updated${reason ? `: ${reason}` : ''}`, context);
  },
};

/**
 * API call logging helpers
 *
 * Usage:
 * ```typescript
 * apiLogger.request('GET', '/api/rooms');
 * apiLogger.response('GET', '/api/rooms', 200, { count: 10 });
 * apiLogger.error('POST', '/api/rooms', error);
 * ```
 */
export const apiLogger = {
  /**
   * Log API request
   */
  request(method: string, url: string, body?: unknown): void {
    logger.debug(`API Request: ${method} ${url}`, body ? { body } : undefined);
  },

  /**
   * Log API response
   */
  response(method: string, url: string, status: number, context?: LogContext): void {
    logger.debug(`API Response: ${method} ${url} [${status}]`, context);
  },

  /**
   * Log API error
   */
  error(method: string, url: string, error: unknown): void {
    logger.error(`API Error: ${method} ${url}`, { error });
  },
};
