/**
 * Readiness Data Types and Validation Types
 * Types for pre-generation readiness checking and validation
 */

// ============================================================================
// Readiness Data Types
// ============================================================================

/**
 * Readiness data containing counts of all required entities
 * Used by the ReadinessChecklist component
 */
export interface ReadinessData {
  /** Number of teachers in the system */
  teacherCount: number;
  /** Number of classes in the system */
  classCount: number;
  /** Number of subjects in the system */
  subjectCount: number;
  /** Number of rooms in the system */
  roomCount: number;
}

/**
 * Status of a readiness item
 * - ready: count > 0, shown with green checkmark
 * - warning: count = 0, shown with amber warning
 * - error: critical issue, shown with red error
 */
export type ReadinessStatus = 'ready' | 'warning' | 'error';

/**
 * Get readiness status based on count
 */
export function getReadinessStatus(count: number): ReadinessStatus {
  return count > 0 ? 'ready' : 'warning';
}

/**
 * Check if all critical data is present for generation
 * Critical: teachers, classes, subjects (rooms are optional)
 */
export function isCriticalDataReady(data: ReadinessData): boolean {
  return data.teacherCount > 0 && data.classCount > 0 && data.subjectCount > 0;
}

// ============================================================================
// Validation Warning Types
// ============================================================================

/**
 * Types of validation warnings
 */
export type ValidationWarningType =
  | 'teacher_no_subjects'
  | 'class_no_subjects'
  | 'period_mismatch'
  | 'teacher_availability_incomplete'
  | 'subject_no_teacher';

/**
 * Validation warning for pre-generation checks
 */
export interface ValidationWarning {
  /** Type of warning */
  type: ValidationWarningType;
  /** ID of the affected entity */
  entityId: string;
  /** Name of the affected entity (for display) */
  entityName: string;
  /** Persian message describing the issue */
  messageFa: string;
  /** English message describing the issue */
  messageEn: string;
  /** Entity type for navigation */
  entityType: 'teacher' | 'class' | 'subject' | 'room';
}

/**
 * Validation warning messages in Persian and English
 */
export const VALIDATION_WARNING_MESSAGES: Record<
  ValidationWarningType,
  { fa: string; en: string }
> = {
  teacher_no_subjects: {
    fa: 'استاد هیچ مضمونی ندارد',
    en: 'Teacher has no subjects assigned',
  },
  class_no_subjects: {
    fa: 'صنف هیچ مضمونی ندارد',
    en: 'Class has no subjects configured',
  },
  period_mismatch: {
    fa: 'تعداد ساعات مورد نیاز با ساعات موجود مطابقت ندارد',
    en: 'Required periods do not match available periods',
  },
  teacher_availability_incomplete: {
    fa: 'دسترسی استاد کامل نیست',
    en: 'Teacher availability is incomplete',
  },
  subject_no_teacher: {
    fa: 'مضمون استاد ندارد',
    en: 'Subject has no teacher assigned',
  },
};

/**
 * Create a validation warning
 */
export function createValidationWarning(
  type: ValidationWarningType,
  entityId: string,
  entityName: string,
  entityType: ValidationWarning['entityType']
): ValidationWarning {
  const messages = VALIDATION_WARNING_MESSAGES[type];
  return {
    type,
    entityId,
    entityName,
    messageFa: messages.fa,
    messageEn: messages.en,
    entityType,
  };
}

// ============================================================================
// Readiness Validation Types
// ============================================================================

/**
 * Complete readiness validation result
 */
export interface ReadinessValidation {
  /** Whether the system is ready for generation */
  isReady: boolean;
  /** Issues that block generation */
  blockingIssues: BlockingIssue[];
  /** Warnings that don't block but should be addressed */
  warnings: ValidationWarning[];
}

/**
 * Blocking issue that prevents generation
 */
export interface BlockingIssue {
  /** Type of blocking issue */
  type: BlockingIssueType;
  /** Persian message */
  messageFa: string;
  /** English message */
  messageEn: string;
  /** Navigation path to fix the issue */
  navigationPath?: string;
}

/**
 * Types of blocking issues
 */
export type BlockingIssueType =
  | 'no_teachers'
  | 'no_classes'
  | 'no_subjects'
  | 'no_periods_configured';

/**
 * Blocking issue messages
 */
export const BLOCKING_ISSUE_MESSAGES: Record<
  BlockingIssueType,
  { fa: string; en: string; path: string }
> = {
  no_teachers: {
    fa: 'هیچ استادی ثبت نشده است',
    en: 'No teachers registered',
    path: '/teachers',
  },
  no_classes: {
    fa: 'هیچ صنفی ثبت نشده است',
    en: 'No classes registered',
    path: '/classes',
  },
  no_subjects: {
    fa: 'هیچ مضمونی ثبت نشده است',
    en: 'No subjects registered',
    path: '/subjects',
  },
  no_periods_configured: {
    fa: 'تنظیمات ساعات انجام نشده است',
    en: 'Period configuration not set',
    path: '/settings',
  },
};

/**
 * Create a blocking issue
 */
export function createBlockingIssue(type: BlockingIssueType): BlockingIssue {
  const messages = BLOCKING_ISSUE_MESSAGES[type];
  return {
    type,
    messageFa: messages.fa,
    messageEn: messages.en,
    navigationPath: messages.path,
  };
}

/**
 * Get blocking issues from readiness data
 */
export function getBlockingIssues(data: ReadinessData): BlockingIssue[] {
  const issues: BlockingIssue[] = [];

  if (data.teacherCount === 0) {
    issues.push(createBlockingIssue('no_teachers'));
  }
  if (data.classCount === 0) {
    issues.push(createBlockingIssue('no_classes'));
  }
  if (data.subjectCount === 0) {
    issues.push(createBlockingIssue('no_subjects'));
  }

  return issues;
}

// ============================================================================
// Readiness Item Configuration
// ============================================================================

/**
 * Configuration for a readiness checklist item
 */
export interface ReadinessItemConfig {
  /** Unique key for the item */
  key: 'teachers' | 'classes' | 'subjects' | 'rooms';
  /** Persian label */
  labelFa: string;
  /** English label */
  labelEn: string;
  /** Icon name from Lucide */
  icon: string;
  /** Navigation path when clicked */
  navigationPath: string;
  /** Whether this item is critical for generation */
  isCritical: boolean;
}

/**
 * Readiness checklist item configurations
 */
export const READINESS_ITEMS: ReadinessItemConfig[] = [
  {
    key: 'teachers',
    labelFa: 'استادان',
    labelEn: 'Teachers',
    icon: 'Users',
    navigationPath: '/teachers',
    isCritical: true,
  },
  {
    key: 'classes',
    labelFa: 'صنف‌ها',
    labelEn: 'Classes',
    icon: 'GraduationCap',
    navigationPath: '/classes',
    isCritical: true,
  },
  {
    key: 'subjects',
    labelFa: 'مضامین',
    labelEn: 'Subjects',
    icon: 'BookOpen',
    navigationPath: '/subjects',
    isCritical: true,
  },
  {
    key: 'rooms',
    labelFa: 'اتاق‌ها',
    labelEn: 'Rooms',
    icon: 'DoorOpen',
    navigationPath: '/rooms',
    isCritical: false,
  },
];

/**
 * Get count from readiness data by key
 */
export function getReadinessCount(data: ReadinessData, key: ReadinessItemConfig['key']): number {
  const countMap: Record<ReadinessItemConfig['key'], number> = {
    teachers: data.teacherCount,
    classes: data.classCount,
    subjects: data.subjectCount,
    rooms: data.roomCount,
  };
  return countMap[key];
}
