/**
 * Constants for the Schedule feature module
 */

import {
  DayOfWeek,
  type CellSize,
  type DisplayPreset,
  type DisplaySettings,
  type FontSize,
} from './types';

/**
 * Days of week with Persian and English labels
 * Afghan week starts on Saturday
 */
export const DAYS_OF_WEEK = [
  { value: DayOfWeek.Saturday, labelFa: 'شنبه', labelEn: 'Saturday' },
  { value: DayOfWeek.Sunday, labelFa: 'یکشنبه', labelEn: 'Sunday' },
  { value: DayOfWeek.Monday, labelFa: 'دوشنبه', labelEn: 'Monday' },
  { value: DayOfWeek.Tuesday, labelFa: 'سه‌شنبه', labelEn: 'Tuesday' },
  { value: DayOfWeek.Wednesday, labelFa: 'چهارشنبه', labelEn: 'Wednesday' },
  { value: DayOfWeek.Thursday, labelFa: 'پنجشنبه', labelEn: 'Thursday' },
  { value: DayOfWeek.Friday, labelFa: 'جمعه', labelEn: 'Friday' },
] as const;

/**
 * Grade categories matching Afghanistan's four-tier classification
 */
export const GRADE_CATEGORIES = {
  ALPHA_PRIMARY: {
    gradeRange: [1, 2, 3],
    labelFa: 'ابتدایی الف',
    labelEn: 'Alpha-Primary',
  },
  BETA_PRIMARY: {
    gradeRange: [4, 5, 6],
    labelFa: 'ابتدایی ب',
    labelEn: 'Beta-Primary',
  },
  MIDDLE: {
    gradeRange: [7, 8, 9],
    labelFa: 'متوسطه',
    labelEn: 'Middle',
  },
  HIGH: {
    gradeRange: [10, 11, 12],
    labelFa: 'ثانوی',
    labelEn: 'High',
  },
} as const;

/**
 * Constraint types used by the solver
 */
export enum CONSTRAINT_TYPES {
  TEACHER_AVAILABILITY = 'teacher_availability',
  TEACHER_MAX_PERIODS_PER_DAY = 'teacher_max_periods_per_day',
  TEACHER_MAX_PERIODS_PER_WEEK = 'teacher_max_periods_per_week',
  TEACHER_MAX_CONSECUTIVE = 'teacher_max_consecutive',
  CLASS_NO_GAPS = 'class_no_gaps',
  CLASS_SUBJECT_DISTRIBUTION = 'class_subject_distribution',
  ROOM_CAPACITY = 'room_capacity',
  ROOM_TYPE_MATCH = 'room_type_match',
  ROOM_NO_CONFLICT = 'room_no_conflict',
  SUBJECT_PERIODS_PER_WEEK = 'subject_periods_per_week',
  SINGLE_TEACHER_MODE = 'single_teacher_mode',
  FIXED_LESSONS = 'fixed_lessons',
}

/**
 * Default display settings for schedule rendering
 * Updated to use 'compact' by default for better screen real estate
 *
 * Phase 1 Enhancement: Addresses Issue #12
 * - showSubjectName is literal 'true' (enforced by type system)
 */
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showSubjectName: true, // TypeScript enforces this must be exactly true
  showTeacherName: true,
  showRoomName: true,
  cellSize: 'compact',
  fontSize: 'md',
  colorBy: 'none',
} as const;

/**
 * Display presets for quick configuration
 */
export const DISPLAY_PRESETS: DisplayPreset[] = [
  {
    key: 'full-detail',
    labelFa: 'جزئیات کامل',
    labelEn: 'Full Detail',
    settings: {
      showTeacherName: true,
      showRoomName: true,
      cellSize: 'normal',
      fontSize: 'md',
    },
  },
  {
    key: 'compact',
    labelFa: 'فشرده',
    labelEn: 'Compact',
    settings: {
      showTeacherName: true,
      showRoomName: false,
      cellSize: 'compact',
      fontSize: 'sm',
    },
  },
  {
    key: 'print-friendly',
    labelFa: 'مناسب چاپ',
    labelEn: 'Print-Friendly',
    settings: {
      showTeacherName: true,
      showRoomName: true,
      cellSize: 'large',
      fontSize: 'lg',
    },
  },
];

/**
 * localStorage key for display settings
 */
export const DISPLAY_SETTINGS_STORAGE_KEY = 'maktab-schedule-display-settings';

/**
 * Cell size to CSS class/dimension mapping
 * Aggressively optimized for maximum screen real estate
 */
export const CELL_SIZE_MAP: Record<
  CellSize,
  { minHeight: string; minWidth: string; className: string }
> = {
  compact: { minHeight: '45px', minWidth: '85px', className: 'cell-compact' },
  normal: { minHeight: '55px', minWidth: '100px', className: 'cell-normal' },
  large: { minHeight: '65px', minWidth: '120px', className: 'cell-large' },
};

/**
 * Font size to Tailwind class mapping
 */
export const FONT_SIZE_MAP: Record<FontSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/**
 * Query keys for TanStack Query
 */
export const SCHEDULE_QUERY_KEYS = {
  all: ['schedules'] as const,
  lists: () => [...SCHEDULE_QUERY_KEYS.all, 'list'] as const,
  detail: (id: number) => ['schedule', id] as const,
  generateStatus: () => [...SCHEDULE_QUERY_KEYS.all, 'generate-status'] as const,
};

// ============================================================================
// Phase 7: Swap Validation Engine Constants
// ============================================================================

/**
 * Constraint type definitions for swap validation
 * Hard constraints block swaps, soft constraints generate warnings
 */
export const SWAP_CONSTRAINT_TYPES = {
  // Hard constraints (block swap)
  TEACHER_UNAVAILABLE: {
    severity: 'hard' as const,
    code: 'teacher_unavailable',
    messageFa: 'معلم در این زمان در دسترس نیست',
  },
  TEACHER_CONFLICT: {
    severity: 'hard' as const,
    code: 'teacher_conflict',
    messageFa: 'معلم در این زمان کلاس دیگری دارد',
  },
  ROOM_CONFLICT: {
    severity: 'hard' as const,
    code: 'room_conflict',
    messageFa: 'اتاق در این زمان اشغال است',
  },
  CLASS_CONFLICT: {
    severity: 'hard' as const,
    code: 'class_conflict',
    messageFa: 'کلاس در این زمان درس دیگری دارد',
  },
  ROOM_TYPE_MISMATCH: {
    severity: 'hard' as const,
    code: 'room_type_mismatch',
    messageFa: 'نوع اتاق با نیاز درس مطابقت ندارد',
  },

  // Soft constraints (warning)
  TEACHER_PREFERENCE: {
    severity: 'soft' as const,
    code: 'teacher_preference',
    messageFa: 'این زمان با ترجیح معلم مطابقت ندارد',
  },
  CONSECUTIVE_EXCEEDED: {
    severity: 'soft' as const,
    code: 'consecutive_exceeded',
    messageFa: 'تعداد ساعات متوالی معلم بیش از حد مجاز می‌شود',
  },
  DIFFICULT_AFTERNOON: {
    severity: 'soft' as const,
    code: 'difficult_afternoon',
    messageFa: 'درس سخت در بعدازظهر توصیه نمی‌شود',
  },
} as const;

/**
 * Type for swap constraint keys
 */
export type SwapConstraintType = keyof typeof SWAP_CONSTRAINT_TYPES;

/**
 * Type for constraint severity
 */
export type ConstraintSeverity = 'hard' | 'soft';
