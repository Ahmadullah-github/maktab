/**
 * Export Schedule Hook
 *
 * TanStack Query mutation hook for handling schedule exports with:
 * - Progress tracking for batch operations
 * - Automatic download triggering
 * - Cancellation support
 * - Error handling and retry logic
 * - User feedback notifications
 *
 * Requirements: 2.1, 8.2, 4.3, 4.4, 4.5, 10.5
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import type { ExportProgress, ExportRequest } from '@/schemas/export.schema';
import { exportApi, isExportJob } from '../api/export.api';

/**
 * Hook return interface
 */
export interface UseExportScheduleReturn {
  exportSchedule: (request: ExportRequest) => Promise<void>;
  isExporting: boolean;
  progress: ExportProgress | null;
  error: string | null;
  cancelExport: () => void;
}

/**
 * Progress polling interval in milliseconds
 */
const PROGRESS_POLL_INTERVAL = 1000;

/**
 * Maximum number of progress polling attempts
 */
const MAX_POLL_ATTEMPTS = 300; // 5 minutes at 1 second intervals

/**
 * Export error types for specific error messages
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */
type ExportErrorType =
  | 'PDF_GENERATION'
  | 'EXCEL_GENERATION'
  | 'NETWORK_TIMEOUT'
  | 'BATCH_LIMIT'
  | 'UNKNOWN';

/**
 * Parse error type from error message
 */
function parseErrorType(message: string): ExportErrorType {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('pdf')) return 'PDF_GENERATION';
  if (lowerMessage.includes('excel')) return 'EXCEL_GENERATION';
  if (lowerMessage.includes('timeout')) return 'NETWORK_TIMEOUT';
  if (
    lowerMessage.includes('maximum 50') ||
    lowerMessage.includes('batch limit') ||
    lowerMessage.includes('too many schedules')
  ) {
    return 'BATCH_LIMIT';
  }
  return 'UNKNOWN';
}

/**
 * Export Schedule Hook
 *
 * Provides a complete export workflow with progress tracking,
 * automatic downloads, error handling, and user notifications.
 *
 * Requirements: 2.1, 8.2, 4.3, 4.4, 4.5, 10.5
 */
export function useExportSchedule(): UseExportScheduleReturn {
  const { t } = useTranslation();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const pollAttempts = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Get localized error message based on error type
   * Requirements: 10.5
   */
  const getLocalizedErrorMessage = useCallback(
    (errorType: ExportErrorType, originalMessage?: string): string => {
      switch (errorType) {
        case 'PDF_GENERATION':
          return t('schedule.export.errors.pdfGeneration', 'Error generating PDF file');
        case 'EXCEL_GENERATION':
          return t('schedule.export.errors.excelGeneration', 'Error generating Excel file');
        case 'NETWORK_TIMEOUT':
          return t('schedule.export.errors.timeout', 'Export timed out. Please try again.');
        case 'BATCH_LIMIT':
          return t(
            'schedule.export.errors.tooManySchedules',
            'Maximum 50 schedules can be exported'
          );
        default:
          return (
            originalMessage ||
            t('schedule.export.errors.networkError', 'Network error. Please try again.')
          );
      }
    },
    [t]
  );

  /**
   * Show success notification
   * Requirements: 4.4
   */
  const showSuccessNotification = useCallback(
    (isBatch: boolean) => {
      if (isBatch) {
        toast.success(
          t('schedule.export.success.batchComplete', 'Batch export completed successfully')
        );
      } else {
        toast.success(t('schedule.export.success.downloadStarted', 'File download started'));
      }
    },
    [t]
  );

  /**
   * Show error notification with actionable message
   * Requirements: 4.5, 10.5
   */
  const showErrorNotification = useCallback(
    (error: Error | string) => {
      const message = typeof error === 'string' ? error : error.message;
      const errorType = parseErrorType(message);
      const localizedMessage = getLocalizedErrorMessage(errorType, message);

      toast.error(localizedMessage);
    },
    [getLocalizedErrorMessage]
  );

  /**
   * Show progress notification for batch operations
   * Requirements: 4.4
   */
  const showProgressNotification = useCallback(
    (current: number, total: number) => {
      // Only show progress toast for significant milestones (25%, 50%, 75%)
      const percentage = Math.round((current / total) * 100);
      if (percentage === 25 || percentage === 50 || percentage === 75) {
        toast.info(
          t('schedule.export.progress.generating', 'Generating {{current}} of {{total}}...', {
            current,
            total,
          }),
          { duration: 2000 }
        );
      }
    },
    [t]
  );

  /**
   * Clear polling state
   */
  const clearPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    pollAttempts.current = 0;
    setProgress(null);
    setCurrentJobId(null);
  }, []);

  /**
   * Start progress polling for batch exports
   * Requirements: 4.1, 4.2
   */
  const startProgressPolling = useCallback(
    (jobId: string) => {
      setCurrentJobId(jobId);
      pollAttempts.current = 0;

      // Show initial progress notification
      toast.info(t('schedule.export.progress.preparing', 'Preparing export...'), {
        duration: 2000,
      });

      const pollOnce = async (): Promise<void> => {
        try {
          pollAttempts.current++;

          if (pollAttempts.current > MAX_POLL_ATTEMPTS) {
            clearPolling();
            showErrorNotification(
              t('schedule.export.errors.timeout', 'Export timed out. Please try again.'),
            );
            return;
          }

          const progressData = await exportApi.getExportProgress(jobId);

          setProgress(progressData);

          // Show progress notifications for batch operations
          if (progressData.status === 'generating' && progressData.total > 1) {
            showProgressNotification(progressData.current, progressData.total);
          }

          // Handle completion
          if (progressData.status === 'complete') {
            if (pollTimer.current) {
              clearTimeout(pollTimer.current);
              pollTimer.current = null;
            }

            const job = await exportApi.getExportJob(jobId);

            if (!job.downloadUrl || !job.filename) {
              clearPolling();
              showErrorNotification(
                t(
                  'schedule.export.errors.downloadFailed',
                  'Export completed but the download is not available.'
                ),
              );
              return;
            }

            await exportApi.downloadFile(job.downloadUrl, job.filename);
            clearPolling();
            showSuccessNotification(true);
            return;
          }

          // Handle error
          if (progressData.status === 'error') {
            clearPolling();
            showErrorNotification(progressData.message);
            return;
          }

          if (progressData.status === 'cancelled') {
            clearPolling();
            toast.info(t('schedule.export.cancel', 'Export cancelled'));
            return;
          }
        } catch (error) {
          console.error('Progress polling error:', error);

          // Stop polling on repeated errors
          if (pollAttempts.current > 5) {
            clearPolling();
            showErrorNotification(
              t('schedule.export.errors.networkError', 'Network error. Please try again.'),
            );
            return;
          }
        }

        pollTimer.current = setTimeout(() => void pollOnce(), PROGRESS_POLL_INTERVAL);
      };

      pollTimer.current = setTimeout(() => void pollOnce(), PROGRESS_POLL_INTERVAL);
    },
    [
      t,
      clearPolling,
      showSuccessNotification,
      showErrorNotification,
      showProgressNotification,
    ]
  );

  useEffect(
    () => () => {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
      }
    },
    []
  );

  /**
   * Main export mutation
   */
  const exportMutation = useMutation({
    mutationFn: async (request: ExportRequest) => {
      const response = await exportApi.exportSchedule(request);

      if (isExportJob(response)) {
        // Batch export - start progress polling
        startProgressPolling(response.jobId);
        return response;
      } else {
        // Single export - trigger immediate download
        await exportApi.downloadFile(response.downloadUrl, response.filename);
        showSuccessNotification(false);
        return response;
      }
    },
    onError: (error: Error) => {
      clearPolling();
      showErrorNotification(error);
    },
  });

  /**
   * Cancel export operation
   * Requirements: 4.3
   */
  const cancelExport = useCallback(async () => {
    if (!currentJobId) {
      return;
    }

    try {
      await exportApi.cancelExport(currentJobId);
      clearPolling();
      toast.info(t('schedule.export.cancel', 'Export cancelled'));
    } catch (error) {
      console.error('Cancel export error:', error);
      toast.error(t('schedule.export.errors.networkError', 'Failed to cancel export'));
    }
  }, [t, currentJobId, clearPolling]);

  /**
   * Export schedule function
   */
  const exportSchedule = useCallback(
    async (request: ExportRequest) => {
      // Clear any existing polling
      clearPolling();

      // Start the export
      await exportMutation.mutateAsync(request);
    },
    [exportMutation, clearPolling]
  );

  return {
    exportSchedule,
    isExporting: exportMutation.isPending || !!currentJobId,
    progress,
    error: exportMutation.error?.message || null,
    cancelExport,
  };
}

/**
 * Hook for checking if an export is currently in progress
 * Useful for disabling UI elements during exports
 */
export function useIsExporting(): boolean {
  const { isExporting } = useExportSchedule();
  return isExporting;
}
