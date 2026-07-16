/**
 * Solver Response Types and Error Categorization
 * Types for handling solver responses, errors, and quality scores
 * Based on SOLVER_ERROR_REFERENCE.md
 */

// ============================================================================
// Core Response Types
// ============================================================================

/**
 * Main solver response structure
 * Returned from POST /api/generate endpoint
 */
export interface SolverResponse {
  status: 'success' | 'partial' | 'failed';
  data: TimetableData | null;
  errors: SolverErrorDetail[];
  warnings: SolverErrorDetail[];
  quality_score: QualityScore | null;
  metadata: SolverResponseMetadata;
  savedTimetable?: SavedTimetableSummary;
}

/**
 * Timetable data from solver (placeholder - actual structure in schedule/types.ts)
 */
export interface TimetableData {
  lessons: unknown[];
  metadata: unknown;
  statistics: unknown;
}

/**
 * Metadata about the solver run
 */
export interface SolverResponseMetadata {
  solveTimeSeconds: number;
  strategy: string;
  numConstraintsApplied: number;
  timestamp: string;
  optimization_preferences_revision: number | null;
  enabled_objectives: string[];
}

export type SolverGenerationPhase =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'validation'
  | 'modelBuilding'
  | 'solvingPhase1'
  | 'solvingPhase2'
  | 'formatting'
  | 'saving'
  | 'cancelling';

export type SolverRunOutcome = 'success' | 'partial' | 'failed' | 'cancelled';

export interface SavedTimetableSummary {
  id: number;
  name: string;
  description: string;
  data: unknown;
  schoolId: number | null;
  academicYearId: number | null;
  termId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SolverLastRun {
  outcome: SolverRunOutcome;
  finishedAt: string;
  messageFarsi?: string;
  messageEnglish?: string;
  timetableId?: number;
}

export interface SolverStatus {
  isRunning: boolean;
  processId?: number;
  startedAt?: string;
  phase: SolverGenerationPhase;
  phaseFarsi?: string;
  strategy?: string;
  percentComplete?: number;
  estimatedSecondsRemaining?: number;
  canCancel: boolean;
  lastRun?: SolverLastRun;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Detailed error information from solver
 */
export interface SolverErrorDetail {
  error_code: string;
  severity: 'error' | 'warning' | 'info';
  message_key: string;
  message_farsi: string;
  message_english: string;
  affected_entities: AffectedEntity[];
  context: Record<string, unknown>;
}

/**
 * Entity affected by an error
 */
export interface AffectedEntity {
  entity_type: 'teacher' | 'class' | 'room' | 'subject';
  entity_id: string;
  entity_name: string;
}

// ============================================================================
// Error Categories
// ============================================================================

/**
 * Error category for grouping errors in UI
 */
export type ErrorCategory = 'teacher' | 'room' | 'class' | 'subject' | 'solver' | 'validation';

/**
 * Mapping of error codes to their categories
 * Based on SOLVER_ERROR_REFERENCE.md
 */
export const ERROR_CATEGORIES: Record<string, ErrorCategory> = {
  // Teacher errors
  TEACHER_OVERLOAD: 'teacher',
  TEACHER_OVERLOAD_PREDICTED: 'teacher',
  TEACHER_AVAILABILITY_CONFLICT: 'teacher',
  TEACHER_AVAILABILITY_MISSING_DAY: 'teacher',
  TEACHER_AVAILABILITY_PERIOD_MISMATCH: 'teacher',
  NO_QUALIFIED_TEACHER: 'teacher',
  SINGLE_TEACHER_UNKNOWN_TEACHER: 'teacher',
  SINGLE_TEACHER_MISSING_SUBJECTS: 'teacher',
  SINGLE_TEACHER_MAX_PERIODS: 'teacher',
  SINGLE_TEACHER_AVAILABILITY: 'teacher',
  CLASS_TEACHER_NO_SUBJECTS: 'teacher',
  TEACHER_NO_SUBJECTS: 'teacher', // Pre-validation: teacher has no subjects assigned
  NO_TEACHERS: 'teacher', // Pre-validation: no teachers defined

  // Room errors
  ROOM_CONFLICT: 'room',
  ROOM_CAPACITY_WARNING: 'room',
  FIXED_ROOM_INCOMPATIBLE: 'room',
  NO_ROOMS: 'room', // Pre-validation: no rooms defined
  NO_VALID_RESOURCES: 'room', // No valid teachers or rooms for a class/subject
  MISSING_ROOM_TYPE: 'room', // Required room type not available (pre-solve check)

  // Class errors
  CLASS_PERIOD_SHORTAGE: 'class',
  EMPTY_PERIODS_ERROR: 'class',
  OVER_ALLOCATION_ERROR: 'class',
  CLASS_NO_SUBJECTS: 'class', // Pre-validation: class has no subject requirements
  NO_CLASSES: 'class', // Pre-validation: no classes defined

  // Subject errors
  SUBJECT_DISTRIBUTION_WARNING: 'subject',
  SUBJECT_CONSECUTIVE_WARNING: 'subject',
  SUBJECT_DAILY_LIMIT_INFEASIBLE: 'subject',
  UNKNOWN_SUBJECT_REFERENCE: 'subject',
  INVALID_CUSTOM_SUBJECT_CATEGORY: 'subject',
  NO_SUBJECTS: 'subject', // Pre-validation: no subjects defined

  // Solver runtime errors
  NO_FEASIBLE_SOLUTION: 'solver',
  SOLVER_TIMEOUT: 'solver',
  INTERNAL_ERROR: 'solver',
  NO_VALID_TIME_SLOTS: 'solver',

  // Validation errors
  VALIDATION_ERROR: 'validation',
  PERIOD_CONFIG_MISSING_DAY: 'validation',
  PERIOD_CONFIG_OUT_OF_RANGE: 'validation',
  INVALID_CATEGORY: 'validation',
  FIXED_LESSON_UNKNOWN_CLASS: 'validation',
  FIXED_LESSON_UNKNOWN_SUBJECT: 'validation',
  FIXED_LESSON_UNKNOWN_ROOM: 'validation',
  FIXED_LESSON_UNKNOWN_TEACHER: 'validation',

  // Ministry validation errors (can be warning or error)
  MINISTRY_SUBJECT_HOURS: 'validation',
  TOTAL_PERIODS_MISMATCH: 'validation',
};

/**
 * Get the category for an error code
 * Falls back to 'solver' for unknown error codes
 */
export function getErrorCategory(errorCode: string): ErrorCategory {
  return ERROR_CATEGORIES[errorCode] || 'solver';
}

// ============================================================================
// Error Quick Actions
// ============================================================================

/**
 * Quick action types for error recovery
 */
export type ErrorQuickActionType =
  | 'edit_teacher'
  | 'add_teacher'
  | 'edit_class'
  | 'add_subject'
  | 'edit_room'
  | 'edit_config';

/**
 * Quick action for error recovery
 */
export interface ErrorQuickAction {
  type: ErrorQuickActionType;
  labelFa: string;
  labelEn: string;
  entityId?: string;
  entityType?: AffectedEntity['entity_type'];
}

/**
 * Mapping of error codes to their quick actions
 */
export const ERROR_QUICK_ACTIONS: Record<string, ErrorQuickAction> = {
  TEACHER_OVERLOAD: {
    type: 'edit_teacher',
    labelFa: 'ویرایش استاد',
    labelEn: 'Edit Teacher',
  },
  TEACHER_OVERLOAD_PREDICTED: {
    type: 'edit_teacher',
    labelFa: 'ویرایش استاد',
    labelEn: 'Edit Teacher',
  },
  TEACHER_AVAILABILITY_CONFLICT: {
    type: 'edit_teacher',
    labelFa: 'ویرایش استاد',
    labelEn: 'Edit Teacher',
  },
  NO_QUALIFIED_TEACHER: {
    type: 'add_teacher',
    labelFa: 'افزودن استاد',
    labelEn: 'Add Teacher',
  },
  TEACHER_NO_SUBJECTS: {
    type: 'edit_teacher',
    labelFa: 'تعیین مضمون برای استاد',
    labelEn: 'Assign Subject to Teacher',
  },
  NO_TEACHERS: {
    type: 'add_teacher',
    labelFa: 'افزودن استاد',
    labelEn: 'Add Teacher',
  },
  CLASS_PERIOD_SHORTAGE: {
    type: 'edit_class',
    labelFa: 'ویرایش صنف',
    labelEn: 'Edit Class',
  },
  EMPTY_PERIODS_ERROR: {
    type: 'add_subject',
    labelFa: 'افزودن مضمون',
    labelEn: 'Add Subject',
  },
  OVER_ALLOCATION_ERROR: {
    type: 'edit_class',
    labelFa: 'ویرایش صنف',
    labelEn: 'Edit Class',
  },
  CLASS_NO_SUBJECTS: {
    type: 'edit_class',
    labelFa: 'تعیین مضامین برای صنف',
    labelEn: 'Assign Subjects to Class',
  },
  NO_CLASSES: {
    type: 'edit_class',
    labelFa: 'افزودن صنف',
    labelEn: 'Add Class',
  },
  NO_SUBJECTS: {
    type: 'add_subject',
    labelFa: 'افزودن مضمون',
    labelEn: 'Add Subject',
  },
  NO_ROOMS: {
    type: 'edit_room',
    labelFa: 'افزودن اتاق',
    labelEn: 'Add Room',
  },
  NO_VALID_RESOURCES: {
    type: 'edit_room',
    labelFa: 'افزودن اتاق مناسب',
    labelEn: 'Add Suitable Room',
  },
  MISSING_ROOM_TYPE: {
    type: 'edit_room',
    labelFa: 'افزودن اتاق با نوع مورد نیاز',
    labelEn: 'Add Room with Required Type',
  },
};

/**
 * Get quick action for an error code
 * Returns null if no quick action is available
 */
export function getErrorQuickAction(
  errorCode: string,
  context?: Record<string, unknown>
): ErrorQuickAction | null {
  const action = ERROR_QUICK_ACTIONS[errorCode];
  if (!action) return null;

  // Add entity ID from context if available
  const entityId =
    (context?.teacherId as string) ||
    (context?.classId as string) ||
    (context?.subjectId as string) ||
    (context?.roomId as string);

  return {
    ...action,
    entityId,
  };
}

// ============================================================================
// Quality Score Types
// ============================================================================

/**
 * Overall quality score with breakdown
 */
export interface QualityScore {
  overall: number;
  breakdown: QualityBreakdown;
  objective_results: ObjectiveResult[];
  suggestions: QualitySuggestion[];
}

export interface ObjectiveResult {
  key: string;
  strength: number;
  violation_units: number;
  opportunity_units: number;
  satisfaction_percent: number;
  affected_entities: AffectedEntity[];
}

/**
 * Breakdown of quality metrics
 */
export interface QualityBreakdown {
  teacher_gaps: QualityMetric;
  afternoon_difficult_subjects: QualityMetric;
  same_day_subject_repetition: QualityMetric;
  teacher_load_balance: QualityMetric;
}

/**
 * Individual quality metric
 */
export interface QualityMetric {
  count: number;
  penalty: number;
  details: unknown[];
}

/**
 * Improvement suggestion from solver
 */
export interface QualitySuggestion {
  suggestion_code: string;
  message_key: string;
  message_params: Record<string, unknown>;
  message_farsi: string;
  message_english: string;
  affected_entities: AffectedEntity[];
  expected_improvement: number;
}

// ============================================================================
// Quality Level Helpers
// ============================================================================

/**
 * Quality level based on score
 */
export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Get quality level from score
 * excellent: >= 80, good: 60-79, fair: 40-59, poor: < 40
 */
export function getQualityLevel(score: number): QualityLevel {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

/**
 * Get color class for quality score
 * green >= 80, amber 60-79, red < 60
 */
export function getQualityColorClass(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

/**
 * Get background color class for quality score
 */
export function getQualityBgClass(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-amber-100';
  return 'bg-red-100';
}

// ============================================================================
// Grouped Errors Type
// ============================================================================

/**
 * Errors grouped by category for display
 */
export type GroupedErrors = Partial<Record<ErrorCategory, SolverErrorDetail[]>>;

/**
 * Group errors by category
 */
export function groupErrorsByCategory(errors: SolverErrorDetail[]): GroupedErrors {
  return errors.reduce((acc, error) => {
    const category = getErrorCategory(error.error_code);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category]!.push(error);
    return acc;
  }, {} as GroupedErrors);
}

/**
 * Category display info for UI
 */
export const ERROR_CATEGORY_INFO: Record<
  ErrorCategory,
  { labelFa: string; labelEn: string; icon: string }
> = {
  teacher: {
    labelFa: 'خطاهای استاد',
    labelEn: 'Teacher Errors',
    icon: 'User',
  },
  room: {
    labelFa: 'خطاهای اتاق',
    labelEn: 'Room Errors',
    icon: 'DoorOpen',
  },
  class: {
    labelFa: 'خطاهای صنف',
    labelEn: 'Class Errors',
    icon: 'GraduationCap',
  },
  subject: {
    labelFa: 'خطاهای مضمون',
    labelEn: 'Subject Errors',
    icon: 'BookOpen',
  },
  solver: {
    labelFa: 'خطاهای سیستم',
    labelEn: 'System Errors',
    icon: 'AlertTriangle',
  },
  validation: {
    labelFa: 'خطاهای اعتبارسنجی',
    labelEn: 'Validation Errors',
    icon: 'ShieldAlert',
  },
};
