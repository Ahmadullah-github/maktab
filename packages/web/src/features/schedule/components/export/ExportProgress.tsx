/**
 * ExportProgress Component
 * Progress indicator for batch export operations
 *
 * Requirements: 4.1, 4.2, 4.3
 */

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Loader2, X } from 'lucide-react';

export interface ExportProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
  message: string;
}

export interface ExportProgressProps {
  progress: ExportProgress;
  onCancel: () => void;
}

/**
 * ExportProgress - Progress indicator for export operations
 *
 * Features:
 * - Progress bar with percentage display
 * - Status text showing "Exporting X of Y..." format
 * - Cancel button functionality
 * - Different states: preparing, generating, finalizing, complete, error
 * - RTL layout support
 *
 * Requirements: 4.1, 4.2, 4.3
 */
export function ExportProgress({ progress, onCancel }: ExportProgressProps) {
  const { t } = useTranslation();
  const { current, total, status, message } = progress;

  // Calculate percentage
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // Get status icon and color
  const getStatusIcon = () => {
    switch (status) {
      case 'preparing':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'generating':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'finalizing':
        return <Loader2 className="h-5 w-5 animate-spin text-amber-500" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }
  };

  // Get status text using translations
  const getStatusText = () => {
    switch (status) {
      case 'preparing':
        return t('schedule.export.progress.preparing', 'آماده‌سازی...');
      case 'generating':
        return total > 1
          ? t('schedule.export.progress.generating', 'در حال تولید {{current}} از {{total}}...', {
              current,
              total,
            })
          : t('schedule.export.progress.generating', 'در حال تولید...');
      case 'finalizing':
        return t('schedule.export.progress.finalizing', 'نهایی‌سازی...');
      case 'complete':
        return t('schedule.export.progress.complete', 'تکمیل شد');
      case 'error':
        return t('schedule.export.progress.error', 'خطا در صادرات');
      default:
        return message || t('schedule.export.progress.preparing', 'در حال پردازش...');
    }
  };

  // Determine if cancel button should be shown
  const showCancel = status !== 'complete' && status !== 'error';

  return (
    <div className="flex flex-col items-center gap-4 py-6" dir="rtl">
      {/* Status Icon */}
      <div className="flex items-center justify-center">{getStatusIcon()}</div>

      {/* Status Text */}
      <div className="text-center">
        <p className="text-lg font-medium">{getStatusText()}</p>
        {message && message !== getStatusText() && (
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        )}
      </div>

      {/* Progress Bar */}
      {status !== 'error' && total > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <Progress value={percentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {current} {t('schedule.export.of', 'از')} {total}
            </span>
            <span>{percentage}%</span>
          </div>
        </div>
      )}

      {/* Cancel Button */}
      {showCancel && (
        <Button variant="outline" onClick={onCancel} className="gap-2">
          <X className="h-4 w-4" />
          {t('schedule.export.cancel', 'انصراف')}
        </Button>
      )}

      {/* Error State Actions */}
      {status === 'error' && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('schedule.export.close', 'بستن')}
          </Button>
        </div>
      )}
    </div>
  );
}
