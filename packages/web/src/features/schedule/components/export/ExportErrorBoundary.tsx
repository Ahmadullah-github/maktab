/**
 * ExportErrorBoundary Component
 *
 * Specialized error boundary for export components with:
 * - Export-specific error messages
 * - Fallback UI for export failures
 * - Error logging for debugging and monitoring
 *
 * Requirements: 10.3
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';

/**
 * Export error types for categorization
 */
export type ExportErrorType =
  | 'network'
  | 'timeout'
  | 'validation'
  | 'generation'
  | 'download'
  | 'unknown';

/**
 * Export error with additional context
 */
export interface ExportError extends Error {
  type?: ExportErrorType;
  scheduleId?: number;
  format?: 'pdf' | 'excel';
  scope?: 'current' | 'all-classes' | 'all-teachers';
}

interface ExportErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onRetry?: () => void;
  scheduleId?: number;
}

interface ExportErrorBoundaryState {
  hasError: boolean;
  error: ExportError | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Categorize error based on message content
 */
function categorizeError(error: Error): ExportErrorType {
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return 'network';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'validation';
  }
  if (message.includes('generation') || message.includes('generate')) {
    return 'generation';
  }
  if (message.includes('download')) {
    return 'download';
  }
  return 'unknown';
}

/**
 * Log export error for debugging and monitoring
 */
function logExportError(
  error: ExportError,
  errorInfo: ErrorInfo | null,
  context?: { scheduleId?: number }
): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    type: error.type || categorizeError(error),
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    context: {
      scheduleId: context?.scheduleId || error.scheduleId,
      format: error.format,
      scope: error.scope,
    },
  };

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[ExportErrorBoundary] Export error:', errorLog);
  }

  // In production, this could be sent to a monitoring service
  // Example: sendToMonitoringService(errorLog);
}

/**
 * ExportErrorBoundary - Catches errors in export component tree
 *
 * Features:
 * - Export-specific error categorization
 * - User-friendly error messages in Farsi
 * - Retry functionality
 * - Error logging for debugging
 *
 * Requirements: 10.3
 */
class ExportErrorBoundaryClass extends Component<
  ExportErrorBoundaryProps,
  ExportErrorBoundaryState
> {
  constructor(props: ExportErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ExportErrorBoundaryState> {
    const exportError = error as ExportError;
    if (!exportError.type) {
      exportError.type = categorizeError(error);
    }
    return { hasError: true, error: exportError };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const exportError = error as ExportError;
    this.setState({ errorInfo });

    // Log error for debugging and monitoring
    logExportError(exportError, errorInfo, {
      scheduleId: this.props.scheduleId,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  /**
   * Get user-friendly error message based on error type
   */
  getErrorMessage(): { title: string; description: string } {
    const { t } = this.props;
    const { error } = this.state;
    const errorType = error?.type || 'unknown';

    const messages: Record<ExportErrorType, { title: string; description: string }> = {
      network: {
        title: t('schedule.export.errors.networkError', 'خطای شبکه'),
        description: t(
          'schedule.export.errors.networkErrorDesc',
          'اتصال به سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید.'
        ),
      },
      timeout: {
        title: t('schedule.export.errors.timeout', 'زمان صادرات به پایان رسید'),
        description: t(
          'schedule.export.errors.timeoutDesc',
          'عملیات صادرات بیش از حد طول کشید. لطفاً دوباره تلاش کنید.'
        ),
      },
      validation: {
        title: t('schedule.export.errors.validationError', 'خطای اعتبارسنجی'),
        description: t(
          'schedule.export.errors.validationErrorDesc',
          'داده‌های ورودی نامعتبر است. لطفاً تنظیمات را بررسی کنید.'
        ),
      },
      generation: {
        title: t('schedule.export.errors.generationError', 'خطا در تولید فایل'),
        description: t(
          'schedule.export.errors.generationErrorDesc',
          'تولید فایل صادراتی با مشکل مواجه شد. لطفاً دوباره تلاش کنید.'
        ),
      },
      download: {
        title: t('schedule.export.errors.downloadFailed', 'خطا در دانلود'),
        description: t(
          'schedule.export.errors.downloadFailedDesc',
          'دانلود فایل با مشکل مواجه شد. لطفاً دوباره تلاش کنید.'
        ),
      },
      unknown: {
        title: t('schedule.export.errors.unknownError', 'خطای ناشناخته'),
        description: t(
          'schedule.export.errors.unknownErrorDesc',
          'یک خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.'
        ),
      },
    };

    return messages[errorType];
  }

  render(): ReactNode {
    const { t, children, fallback, onRetry } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      const { title, description } = this.getErrorMessage();

      return (
        <div className="flex min-h-[300px] items-center justify-center p-6" dir="rtl">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show technical details in development */}
              {import.meta.env.DEV && error && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {error.message}
                  </p>
                  {error.type && (
                    <p className="font-mono text-xs text-muted-foreground mt-1">
                      Type: {error.type}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-2">
                {onRetry && (
                  <Button onClick={this.handleRetry} variant="default" className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('schedule.export.retry', 'تلاش مجدد')}
                  </Button>
                )}
                <Button onClick={this.handleReset} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  {t('schedule.export.close', 'بستن')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

export const ExportErrorBoundary = withTranslation()(ExportErrorBoundaryClass);

export type { ExportErrorBoundaryProps };
