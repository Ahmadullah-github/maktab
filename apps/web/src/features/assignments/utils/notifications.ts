/**
 * Assignment Notifications Utility
 * Provides toast notifications for assignment operations
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import { toast } from 'sonner';
import {
  AssignmentErrorHandler,
  formatConflictMessage,
  getResolutionSuggestions,
} from '../services/errorHandler';
import type { AssignmentConflict } from '../types';

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationOptions {
  /** Duration in milliseconds (default: 4000) */
  duration?: number;
  /** Whether to show a close button */
  dismissible?: boolean;
  /** Custom action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ConflictNotificationOptions extends NotificationOptions {
  /** Whether to show resolution suggestions */
  showSuggestions?: boolean;
  /** Locale for messages */
  locale?: 'fa' | 'en';
}

// ============================================================================
// Success Notifications
// ============================================================================

/**
 * Show success notification for assignment creation
 * Requirements: 8.1
 */
export function notifyAssignmentSuccess(message?: string, options?: NotificationOptions): void {
  toast.success(message || 'تخصیص با موفقیت انجام شد', {
    duration: options?.duration ?? 4000,
    dismissible: options?.dismissible ?? true,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
}

/**
 * Show success notification for assignment removal
 * Requirements: 8.2
 */
export function notifyAssignmentRemoved(message?: string, options?: NotificationOptions): void {
  toast.success(message || 'تخصیص با موفقیت حذف شد', {
    duration: options?.duration ?? 4000,
    dismissible: options?.dismissible ?? true,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
}

/**
 * Show success notification for bulk assignment operations
 */
export function notifyBulkAssignmentSuccess(
  count: number,
  locale: 'fa' | 'en' = 'fa',
  options?: NotificationOptions
): void {
  const message =
    locale === 'fa'
      ? `${count} تخصیص با موفقیت انجام شد`
      : `${count} assignments completed successfully`;

  toast.success(message, {
    duration: options?.duration ?? 4000,
    dismissible: options?.dismissible ?? true,
  });
}

// ============================================================================
// Error Notifications
// ============================================================================

/**
 * Show error notification for assignment failure
 * Requirements: 8.3
 */
export function notifyAssignmentError(
  message?: string,
  description?: string,
  options?: NotificationOptions
): void {
  toast.error(message || 'خطا در تخصیص', {
    description,
    duration: options?.duration ?? 6000,
    dismissible: options?.dismissible ?? true,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
  });
}

/**
 * Show error notification for assignment removal failure
 */
export function notifyRemovalError(
  message?: string,
  description?: string,
  options?: NotificationOptions
): void {
  toast.error(message || 'خطا در حذف تخصیص', {
    description,
    duration: options?.duration ?? 6000,
    dismissible: options?.dismissible ?? true,
  });
}

// ============================================================================
// Conflict Notifications
// ============================================================================

/**
 * Show notification for a single conflict
 * Requirements: 8.3
 */
export function notifyConflict(
  conflict: AssignmentConflict,
  options?: ConflictNotificationOptions
): void {
  const locale = options?.locale ?? 'fa';
  const message = formatConflictMessage(conflict, locale);

  if (conflict.severity === 'error') {
    let description: string | undefined;

    if (options?.showSuggestions) {
      const suggestions = getResolutionSuggestions(conflict.type, locale);
      if (suggestions.length > 0) {
        description = suggestions[0];
      }
    }

    toast.error(message, {
      description,
      duration: options?.duration ?? 6000,
      dismissible: options?.dismissible ?? true,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  } else {
    toast.warning(message, {
      duration: options?.duration ?? 5000,
      dismissible: options?.dismissible ?? true,
    });
  }
}

/**
 * Show notification for multiple conflicts
 * Requirements: 8.3
 */
export function notifyConflicts(
  conflicts: AssignmentConflict[],
  options?: ConflictNotificationOptions
): void {
  if (conflicts.length === 0) return;

  const locale = options?.locale ?? 'fa';
  const errorHandler = new AssignmentErrorHandler(locale);

  // Get the most severe conflict
  const mostSevere = errorHandler.getMostSevereConflict(conflicts);
  if (!mostSevere) return;

  const hasErrors = errorHandler.hasErrors(conflicts);
  const message = errorHandler.formatConflictsSummary(conflicts);

  if (hasErrors) {
    toast.error(
      locale === 'fa'
        ? `${conflicts.length} مشکل در تخصیص`
        : `${conflicts.length} assignment issues`,
      {
        description: message,
        duration: options?.duration ?? 8000,
        dismissible: options?.dismissible ?? true,
      }
    );
  } else {
    toast.warning(
      locale === 'fa'
        ? `${conflicts.length} هشدار در تخصیص`
        : `${conflicts.length} assignment warnings`,
      {
        description: message,
        duration: options?.duration ?? 6000,
        dismissible: options?.dismissible ?? true,
      }
    );
  }
}

// ============================================================================
// Warning Notifications
// ============================================================================

/**
 * Show warning notification for workload approaching limit
 */
export function notifyWorkloadWarning(
  currentPeriods: number,
  maxPeriods: number,
  locale: 'fa' | 'en' = 'fa',
  options?: NotificationOptions
): void {
  const message =
    locale === 'fa'
      ? `بار کاری نزدیک به حداکثر است (${currentPeriods}/${maxPeriods} ساعت)`
      : `Workload approaching limit (${currentPeriods}/${maxPeriods} periods)`;

  toast.warning(message, {
    duration: options?.duration ?? 5000,
    dismissible: options?.dismissible ?? true,
  });
}

/**
 * Show warning notification for coverage issues
 */
export function notifyCoverageWarning(
  subjectName: string,
  unassignedCount: number,
  locale: 'fa' | 'en' = 'fa',
  options?: NotificationOptions
): void {
  const message =
    locale === 'fa'
      ? `${subjectName}: ${unassignedCount} صنف بدون معلم`
      : `${subjectName}: ${unassignedCount} classes without teacher`;

  toast.warning(message, {
    duration: options?.duration ?? 5000,
    dismissible: options?.dismissible ?? true,
  });
}

// ============================================================================
// Info Notifications
// ============================================================================

/**
 * Show info notification
 */
export function notifyAssignmentInfo(message: string, options?: NotificationOptions): void {
  toast.info(message, {
    duration: options?.duration ?? 4000,
    dismissible: options?.dismissible ?? true,
  });
}

// ============================================================================
// Loading Notifications
// ============================================================================

/**
 * Show loading notification with promise
 */
export function notifyAssignmentLoading<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string;
    error: string;
  }
): void {
  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
}

/**
 * Show loading notification for bulk operations
 */
export function notifyBulkOperationLoading<T>(
  promise: Promise<T>,
  locale: 'fa' | 'en' = 'fa'
): void {
  const messages =
    locale === 'fa'
      ? {
          loading: 'در حال پردازش...',
          success: 'عملیات با موفقیت انجام شد',
          error: 'خطا در انجام عملیات',
        }
      : {
          loading: 'Processing...',
          success: 'Operation completed successfully',
          error: 'Operation failed',
        };

  toast.promise(promise, messages);
}

// ============================================================================
// Confirmation Helpers
// ============================================================================

/**
 * Get confirmation dialog messages for assignment removal
 */
export function getRemovalConfirmationMessages(locale: 'fa' | 'en' = 'fa'): {
  title: string;
  description: string;
  confirm: string;
  cancel: string;
} {
  return locale === 'fa'
    ? {
        title: 'حذف تخصیص',
        description: 'آیا از حذف این تخصیص مطمئن هستید؟ این عمل قابل بازگشت نیست.',
        confirm: 'حذف',
        cancel: 'انصراف',
      }
    : {
        title: 'Remove Assignment',
        description:
          'Are you sure you want to remove this assignment? This action cannot be undone.',
        confirm: 'Remove',
        cancel: 'Cancel',
      };
}

/**
 * Get confirmation dialog messages for bulk removal
 */
export function getBulkRemovalConfirmationMessages(
  count: number,
  locale: 'fa' | 'en' = 'fa'
): {
  title: string;
  description: string;
  confirm: string;
  cancel: string;
} {
  return locale === 'fa'
    ? {
        title: 'حذف تخصیص‌ها',
        description: `آیا از حذف ${count} تخصیص مطمئن هستید؟ این عمل قابل بازگشت نیست.`,
        confirm: 'حذف همه',
        cancel: 'انصراف',
      }
    : {
        title: 'Remove Assignments',
        description: `Are you sure you want to remove ${count} assignments? This action cannot be undone.`,
        confirm: 'Remove All',
        cancel: 'Cancel',
      };
}
