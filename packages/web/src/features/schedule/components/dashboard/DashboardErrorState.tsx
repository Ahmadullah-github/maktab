/**
 * DashboardErrorState Component
 * Error state display for the Schedule Dashboard
 *
 * Features:
 * - Error message in Persian
 * - Retry button
 *
 * Requirements: 10.3, 10.4, 10.5
 */

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AlertCircle, Calendar, RefreshCw } from 'lucide-react';

/**
 * Props for DashboardErrorState component
 */
export interface DashboardErrorStateProps {
  /** Error object or message */
  error: Error | string | null;
  /** Callback when retry button is clicked */
  onRetry: () => void;
  /** Whether retry is in progress */
  isRetrying?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Extract error message from various error types
 */
function getErrorMessage(error: Error | string | null): string {
  if (!error) return 'خطای ناشناخته رخ داده است';
  if (typeof error === 'string') return error;
  return error.message || 'خطای ناشناخته رخ داده است';
}

/**
 * DashboardErrorState component
 *
 * Displays an error state with a Persian message and retry button.
 * Used when data fetching fails in the Schedule Dashboard.
 *
 * Requirements: 10.3, 10.4, 10.5
 */
export function DashboardErrorState({
  error,
  onRetry,
  isRetrying = false,
  className,
}: DashboardErrorStateProps) {
  const errorMessage = getErrorMessage(error);

  return (
    <div className={cn('flex flex-col gap-6 p-6', className)}>
      {/* Header - matches ScheduleDashboard header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">داشبورد جدول زمانی</h1>
      </div>

      {/* Error card */}
      <Card className="border-destructive/50 bg-destructive/5">
        <div className="flex flex-col items-center justify-center gap-4 p-8">
          {/* Error icon */}
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>

          {/* Error title (Persian) - Requirement: 10.4 */}
          <h2 className="text-lg font-semibold text-destructive">خطا در دریافت اطلاعات</h2>

          {/* Error message (Persian) - Requirement: 10.4 */}
          <p className="text-sm text-muted-foreground text-center max-w-md">{errorMessage}</p>

          {/* Retry button - Requirement: 10.5 */}
          <Button variant="outline" onClick={onRetry} disabled={isRetrying} className="gap-2 mt-2">
            <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
            {isRetrying ? 'در حال تلاش...' : 'تلاش مجدد'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
