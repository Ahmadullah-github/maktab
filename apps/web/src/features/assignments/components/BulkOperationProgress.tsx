/**
 * Bulk Operation Progress Component
 * Displays progress for bulk assignment operations with cancellation support
 *
 * Requirements: 8.6
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

export type BulkOperationStatus = 'idle' | 'running' | 'completed' | 'cancelled' | 'error';

export interface BulkOperationResult {
  success: boolean;
  itemId: number | string;
  error?: string;
}

export interface BulkOperationProgressProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Title of the operation */
  title?: string;
  /** Description of the operation */
  description?: string;
  /** Total number of items to process */
  totalItems: number;
  /** Number of items completed */
  completedItems: number;
  /** Number of items that failed */
  failedItems: number;
  /** Current operation status */
  status: BulkOperationStatus;
  /** Callback when cancel is requested */
  onCancel?: () => void;
  /** Callback when close is requested after completion */
  onClose?: () => void;
  /** Whether cancellation is supported */
  canCancel?: boolean;
  /** Results of individual operations */
  results?: BulkOperationResult[];
  /** Whether to show detailed results */
  showDetails?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * BulkOperationProgress displays progress for bulk assignment operations
 *
 * @example
 * ```tsx
 * <BulkOperationProgress
 *   open={isProcessing}
 *   onOpenChange={setIsProcessing}
 *   totalItems={10}
 *   completedItems={5}
 *   failedItems={1}
 *   status="running"
 *   onCancel={handleCancel}
 * />
 * ```
 */
export function BulkOperationProgress({
  open,
  onOpenChange,
  title,
  description,
  totalItems,
  completedItems,
  failedItems,
  status,
  onCancel,
  onClose,
  canCancel = true,
  results = [],
  showDetails = false,
}: BulkOperationProgressProps) {
  const { t } = useTranslation();
  const [showResultDetails, setShowResultDetails] = useState(false);

  // Calculate progress percentage
  const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-6 w-6 text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-destructive" />;
      default:
        return null;
    }
  };

  // Get status message
  const getStatusMessage = (): string => {
    switch (status) {
      case 'running':
        return t('assignments.progress.processing', 'در حال پردازش...');
      case 'completed':
        if (failedItems > 0) {
          return t(
            'assignments.progress.completedWithErrors',
            '{{completed}} مورد انجام شد، {{failed}} مورد با خطا',
            { completed: completedItems - failedItems, failed: failedItems }
          );
        }
        return t('assignments.progress.completed', '{{completed}} از {{total}} انجام شد', {
          completed: completedItems,
          total: totalItems,
        });
      case 'cancelled':
        return t('assignments.progress.cancelled', 'عملیات لغو شد');
      case 'error':
        return t('assignments.progress.failed', '{{failed}} مورد با خطا مواجه شد', {
          failed: failedItems,
        });
      default:
        return '';
    }
  };

  // Handle close
  const handleClose = useCallback(() => {
    if (status === 'running') {
      // Don't allow closing while running
      return;
    }
    onClose?.();
    onOpenChange(false);
  }, [status, onClose, onOpenChange]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  // Auto-close after completion (optional)
  useEffect(() => {
    if (status === 'completed' && failedItems === 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, failedItems, handleClose]);

  return (
    <Dialog open={open} onOpenChange={status === 'running' ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e: Event) => status === 'running' && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {title || t('assignments.bulk.title', 'عملیات گروهی')}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('assignments.progress.progress', 'پیشرفت')}
              </span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Status Summary */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{getStatusMessage()}</span>
            <div className="flex gap-4">
              <span className="text-green-600">✓ {completedItems - failedItems}</span>
              {failedItems > 0 && <span className="text-destructive">✗ {failedItems}</span>}
            </div>
          </div>

          {/* Detailed Results (optional) */}
          {showDetails && results.length > 0 && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResultDetails(!showResultDetails)}
                className="w-full justify-between"
              >
                <span>{t('assignments.progress.details', 'جزئیات')}</span>
                <span>{showResultDetails ? '▲' : '▼'}</span>
              </Button>

              {showResultDetails && (
                <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`text-xs flex items-center gap-2 ${
                        result.success ? 'text-green-600' : 'text-destructive'
                      }`}
                    >
                      {result.success ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      <span>
                        {result.success
                          ? t('assignments.progress.itemSuccess', 'مورد {{id}} انجام شد', {
                              id: result.itemId,
                            })
                          : result.error ||
                            t('assignments.progress.itemFailed', 'مورد {{id}} با خطا مواجه شد', {
                              id: result.itemId,
                            })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {status === 'running' && canCancel && (
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel', 'انصراف')}
            </Button>
          )}
          {status !== 'running' && (
            <Button onClick={handleClose}>{t('common.close', 'بستن')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default BulkOperationProgress;
