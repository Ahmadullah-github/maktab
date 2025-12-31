/**
 * ErrorBoundary Component
 *
 * React error boundary for catching and displaying runtime errors
 * Shows user-friendly error messages in Farsi
 *
 * Requirements: 11.2, 11.5
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';

interface ErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary - Catches JavaScript errors in child component tree
 *
 * Requirements: 11.2, 11.5
 */
class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { t, children, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>{t('errorBoundary.title')}</CardTitle>
              <CardDescription>{t('errorBoundary.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {import.meta.env.DEV && error && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-mono text-xs text-muted-foreground">{error.message}</p>
                </div>
              )}
              <div className="flex justify-center">
                <Button onClick={this.handleReset} variant="outline">
                  <RefreshCw className="me-2 h-4 w-4" />
                  {t('errorBoundary.retry')}
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

export const ErrorBoundary = withTranslation()(ErrorBoundaryClass);

export type { ErrorBoundaryProps };
