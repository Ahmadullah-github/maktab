/**
 * Structured logger utility with configurable log levels
 * @module utils/logger
 */

import {
  LOG_LEVELS,
  DEFAULT_PRODUCTION_LOG_LEVEL,
  DEFAULT_DEVELOPMENT_LOG_LEVEL,
} from '../constants';
import type { RequestContext } from '../types/common.types';

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: RequestContext;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Structured logger with configurable levels and JSON output support
 */
class Logger {
  private level: number;
  private useJson: boolean;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel | undefined;
    
    // Determine log level
    const defaultLevel = isProduction 
      ? DEFAULT_PRODUCTION_LOG_LEVEL 
      : DEFAULT_DEVELOPMENT_LOG_LEVEL;
    const levelName = envLevel && envLevel in LOG_LEVELS ? envLevel : defaultLevel;
    this.level = LOG_LEVELS[levelName as LogLevel];
    
    // Use JSON format in production by default, can be overridden
    this.useJson = process.env.LOG_FORMAT === 'json' || isProduction;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  /**
   * Enable or disable JSON output format
   */
  setJsonFormat(enabled: boolean): void {
    this.useJson = enabled;
  }

  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.level;
  }

  /**
   * Format and output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    context?: RequestContext,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.output(level, entry);
  }

  /**
   * Output the log entry to console
   */
  private output(level: LogLevel, entry: LogEntry): void {
    const output = this.useJson 
      ? JSON.stringify(entry) 
      : this.formatPretty(entry);

    switch (level) {
      case 'ERROR':
        console.error(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  /**
   * Format log entry for human-readable output
   */
  private formatPretty(entry: LogEntry): string {
    const parts: string[] = [
      entry.timestamp,
      `[${entry.level}]`,
      entry.message,
    ];

    if (entry.context) {
      const ctx = entry.context;
      if (ctx.requestId) parts.push(`reqId=${ctx.requestId}`);
      if (ctx.method && ctx.path) parts.push(`${ctx.method} ${ctx.path}`);
    }

    if (entry.data) {
      parts.push(JSON.stringify(entry.data));
    }

    if (entry.error) {
      parts.push(`\n  Error: ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n  Stack: ${entry.error.stack}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Log a debug message
   */
  debug(
    message: string,
    data?: Record<string, unknown>,
    context?: RequestContext
  ): void {
    this.log('DEBUG', message, context, data);
  }

  /**
   * Log an info message
   */
  info(
    message: string,
    data?: Record<string, unknown>,
    context?: RequestContext
  ): void {
    this.log('INFO', message, context, data);
  }

  /**
   * Log a warning message
   */
  warn(
    message: string,
    data?: Record<string, unknown>,
    context?: RequestContext
  ): void {
    this.log('WARN', message, context, data);
  }

  /**
   * Log an error message with optional error object
   */
  error(
    message: string,
    error?: Error,
    data?: Record<string, unknown>,
    context?: RequestContext
  ): void {
    this.log('ERROR', message, context, data, error);
  }

  /**
   * Log a request completion with timing
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: RequestContext
  ): void {
    this.info(
      `${method} ${path} ${statusCode} ${durationMs}ms`,
      { statusCode, durationMs },
      { ...context, method, path }
    );
  }

  /**
   * Create a child logger with preset context
   */
  child(context: RequestContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with preset context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private context: RequestContext
  ) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.parent.debug(message, data, this.context);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.parent.info(message, data, this.context);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.parent.warn(message, data, this.context);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.parent.error(message, error, data, this.context);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for testing or custom instances
export { Logger, ChildLogger };
export type { LogLevel, LogEntry };
