/**
 * Assignment Error Handler Service
 * Handles error messages, translations, and conflict resolution suggestions
 *
 * Requirements: 8.1, 8.2, 8.3, 6.5
 */

import type { AssignmentConflict, ConflictType } from '../types';

// ============================================================================
// Error Code Definitions
// ============================================================================

/**
 * Assignment error codes for categorizing errors
 */
export enum AssignmentErrorCode {
  TEACHER_SUBJECT_INCOMPATIBLE = 'teacher_subject_incompatible',
  WORKLOAD_EXCEEDED = 'workload_exceeded',
  AVAILABILITY_CONFLICT = 'availability_conflict',
  DUPLICATE_ASSIGNMENT = 'duplicate_assignment',
  INVALID_PERIODS = 'invalid_periods',
  CLASS_NOT_FOUND = 'class_not_found',
  SUBJECT_NOT_FOUND = 'subject_not_found',
  TEACHER_NOT_FOUND = 'teacher_not_found',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  UNKNOWN_ERROR = 'unknown_error',
}

// ============================================================================
// Error Message Maps
// ============================================================================

/**
 * Farsi error messages for each error code
 */
const errorMessagesFa: Record<AssignmentErrorCode, string> = {
  [AssignmentErrorCode.TEACHER_SUBJECT_INCOMPATIBLE]: 'این معلم مجاز به تدریس این مضمون نیست',
  [AssignmentErrorCode.WORKLOAD_EXCEEDED]: 'تخصیص این کلاس باعث تجاوز از حداکثر ساعات معلم می‌شود',
  [AssignmentErrorCode.AVAILABILITY_CONFLICT]: 'معلم در این زمان در دسترس نیست',
  [AssignmentErrorCode.DUPLICATE_ASSIGNMENT]: 'این تخصیص قبلاً وجود دارد',
  [AssignmentErrorCode.INVALID_PERIODS]: 'تعداد ساعات نامعتبر است',
  [AssignmentErrorCode.CLASS_NOT_FOUND]: 'صنف مورد نظر یافت نشد',
  [AssignmentErrorCode.SUBJECT_NOT_FOUND]: 'مضمون مورد نظر یافت نشد',
  [AssignmentErrorCode.TEACHER_NOT_FOUND]: 'معلم مورد نظر یافت نشد',
  [AssignmentErrorCode.NETWORK_ERROR]: 'خطا در ارتباط با سرور',
  [AssignmentErrorCode.VALIDATION_ERROR]: 'اطلاعات وارد شده نامعتبر است',
  [AssignmentErrorCode.UNKNOWN_ERROR]: 'خطای نامشخص رخ داده است',
};

/**
 * English error messages for each error code
 */
const errorMessagesEn: Record<AssignmentErrorCode, string> = {
  [AssignmentErrorCode.TEACHER_SUBJECT_INCOMPATIBLE]:
    'This teacher is not qualified to teach this subject',
  [AssignmentErrorCode.WORKLOAD_EXCEEDED]:
    "This assignment would exceed the teacher's maximum workload",
  [AssignmentErrorCode.AVAILABILITY_CONFLICT]: 'Teacher is not available at this time',
  [AssignmentErrorCode.DUPLICATE_ASSIGNMENT]: 'This assignment already exists',
  [AssignmentErrorCode.INVALID_PERIODS]: 'Invalid number of periods',
  [AssignmentErrorCode.CLASS_NOT_FOUND]: 'Class not found',
  [AssignmentErrorCode.SUBJECT_NOT_FOUND]: 'Subject not found',
  [AssignmentErrorCode.TEACHER_NOT_FOUND]: 'Teacher not found',
  [AssignmentErrorCode.NETWORK_ERROR]: 'Network error occurred',
  [AssignmentErrorCode.VALIDATION_ERROR]: 'Invalid input data',
  [AssignmentErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
};

// ============================================================================
// Resolution Suggestion Maps
// ============================================================================

/**
 * Farsi resolution suggestions for each conflict type
 */
const resolutionSuggestionsFa: Record<ConflictType, string[]> = {
  workload_exceeded: [
    'تعداد صنف‌های تخصیص یافته را کاهش دهید',
    'حداکثر ساعات معلم را افزایش دهید',
    'به معلم دیگری تخصیص دهید',
  ],
  subject_incompatible: [
    'مضمون را به لیست مضامین مجاز معلم اضافه کنید',
    'معلم مناسب دیگری انتخاب کنید',
  ],
  availability_conflict: [
    'زمان‌بندی حضور معلم را بررسی کنید',
    'زمان دیگری برای این کلاس انتخاب کنید',
  ],
  coverage_insufficient: [
    'معلم‌های بیشتری به این مضمون تخصیص دهید',
    'تعداد صنف‌های نیازمند این مضمون را بررسی کنید',
  ],
  duplicate_assignment: [
    'یکی از تخصیص‌های تکراری را حذف کنید',
    'صنف‌های تخصیص یافته را بررسی کنید',
  ],
};

/**
 * English resolution suggestions for each conflict type
 */
const resolutionSuggestionsEn: Record<ConflictType, string[]> = {
  workload_exceeded: [
    'Reduce the number of assigned classes',
    "Increase the teacher's maximum hours",
    'Assign to a different teacher',
  ],
  subject_incompatible: [
    "Add the subject to the teacher's allowed subjects",
    'Select a different qualified teacher',
  ],
  availability_conflict: [
    "Check the teacher's availability schedule",
    'Choose a different time for this class',
  ],
  coverage_insufficient: [
    'Assign more teachers to this subject',
    'Review the number of classes requiring this subject',
  ],
  duplicate_assignment: ['Remove one of the duplicate assignments', 'Review the assigned classes'],
};

// ============================================================================
// AssignmentErrorHandler Class
// ============================================================================

/**
 * Assignment Error Handler
 * Provides methods for handling and formatting assignment errors
 *
 * Requirements: 8.3, 6.5
 */
export class AssignmentErrorHandler {
  private locale: 'fa' | 'en';

  constructor(locale: 'fa' | 'en' = 'fa') {
    this.locale = locale;
  }

  /**
   * Set the current locale
   */
  setLocale(locale: 'fa' | 'en'): void {
    this.locale = locale;
  }

  /**
   * Get error message for an error code
   */
  getErrorMessage(code: AssignmentErrorCode): string {
    const messages = this.locale === 'fa' ? errorMessagesFa : errorMessagesEn;
    return messages[code] || messages[AssignmentErrorCode.UNKNOWN_ERROR];
  }

  /**
   * Get error message from a conflict
   */
  getConflictMessage(conflict: AssignmentConflict): string {
    return this.locale === 'fa' ? conflict.messageFa || conflict.message : conflict.message;
  }

  /**
   * Get resolution suggestions for a conflict type
   */
  getResolutionSuggestions(conflictType: ConflictType): string[] {
    const suggestions = this.locale === 'fa' ? resolutionSuggestionsFa : resolutionSuggestionsEn;
    return suggestions[conflictType] || [];
  }

  /**
   * Get resolution suggestion from a conflict
   */
  getConflictResolution(conflict: AssignmentConflict): string | undefined {
    if (this.locale === 'fa') {
      return conflict.suggestedResolutionFa || conflict.suggestedResolution;
    }
    return conflict.suggestedResolution;
  }

  /**
   * Map conflict type to error code
   */
  conflictTypeToErrorCode(conflictType: ConflictType): AssignmentErrorCode {
    const mapping: Record<ConflictType, AssignmentErrorCode> = {
      workload_exceeded: AssignmentErrorCode.WORKLOAD_EXCEEDED,
      subject_incompatible: AssignmentErrorCode.TEACHER_SUBJECT_INCOMPATIBLE,
      availability_conflict: AssignmentErrorCode.AVAILABILITY_CONFLICT,
      coverage_insufficient: AssignmentErrorCode.VALIDATION_ERROR,
      duplicate_assignment: AssignmentErrorCode.DUPLICATE_ASSIGNMENT,
    };
    return mapping[conflictType] || AssignmentErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Handle validation error and return formatted message
   */
  handleValidationError(conflict: AssignmentConflict): string {
    return this.getConflictMessage(conflict);
  }

  /**
   * Handle API error and return AssignmentConflict
   */
  handleApiError(error: unknown): AssignmentConflict {
    if (error instanceof Error) {
      // Check for network errors
      if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Network')
      ) {
        return {
          type: 'workload_exceeded', // Using existing type as fallback
          severity: 'error',
          message: errorMessagesEn[AssignmentErrorCode.NETWORK_ERROR],
          messageFa: errorMessagesFa[AssignmentErrorCode.NETWORK_ERROR],
          affectedEntities: {},
        };
      }

      return {
        type: 'workload_exceeded',
        severity: 'error',
        message: error.message,
        messageFa: error.message,
        affectedEntities: {},
      };
    }

    return {
      type: 'workload_exceeded',
      severity: 'error',
      message: errorMessagesEn[AssignmentErrorCode.UNKNOWN_ERROR],
      messageFa: errorMessagesFa[AssignmentErrorCode.UNKNOWN_ERROR],
      affectedEntities: {},
    };
  }

  /**
   * Format multiple conflicts into a single message
   */
  formatConflictsSummary(conflicts: AssignmentConflict[]): string {
    if (conflicts.length === 0) return '';

    if (conflicts.length === 1) {
      return this.getConflictMessage(conflicts[0]);
    }

    const prefix =
      this.locale === 'fa'
        ? `${conflicts.length} مشکل شناسایی شد:`
        : `${conflicts.length} issues detected:`;

    const messages = conflicts.map((c) => `• ${this.getConflictMessage(c)}`).join('\n');

    return `${prefix}\n${messages}`;
  }

  /**
   * Check if conflicts contain any errors (not just warnings)
   */
  hasErrors(conflicts: AssignmentConflict[]): boolean {
    return conflicts.some((c) => c.severity === 'error');
  }

  /**
   * Filter conflicts by severity
   */
  filterBySeverity(
    conflicts: AssignmentConflict[],
    severity: 'error' | 'warning'
  ): AssignmentConflict[] {
    return conflicts.filter((c) => c.severity === severity);
  }

  /**
   * Get the most severe conflict from a list
   */
  getMostSevereConflict(conflicts: AssignmentConflict[]): AssignmentConflict | null {
    if (conflicts.length === 0) return null;

    // Errors take priority over warnings
    const errors = this.filterBySeverity(conflicts, 'error');
    if (errors.length > 0) return errors[0];

    return conflicts[0];
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default error handler instance
 */
export const assignmentErrorHandler = new AssignmentErrorHandler('fa');

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick helper to get error message
 */
export function getAssignmentErrorMessage(
  code: AssignmentErrorCode,
  locale: 'fa' | 'en' = 'fa'
): string {
  const messages = locale === 'fa' ? errorMessagesFa : errorMessagesEn;
  return messages[code] || messages[AssignmentErrorCode.UNKNOWN_ERROR];
}

/**
 * Quick helper to format conflict message
 */
export function formatConflictMessage(
  conflict: AssignmentConflict,
  locale: 'fa' | 'en' = 'fa'
): string {
  return locale === 'fa' ? conflict.messageFa || conflict.message : conflict.message;
}

/**
 * Quick helper to get resolution suggestions
 */
export function getResolutionSuggestions(
  conflictType: ConflictType,
  locale: 'fa' | 'en' = 'fa'
): string[] {
  const suggestions = locale === 'fa' ? resolutionSuggestionsFa : resolutionSuggestionsEn;
  return suggestions[conflictType] || [];
}
