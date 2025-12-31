/**
 * Period Structure Constants
 * Data-driven configuration values for teaching period settings
 * Requirements: 8.2, 8.3, 8.4
 */

/**
 * Period count limits for validation
 * Used for default periods per day and dynamic/category-based periods
 */
export const PERIOD_LIMITS = {
  MIN: 1,
  MAX: 12,
  DEFAULT: 7,
} as const;

/**
 * Period duration limits in minutes
 */
export const DURATION_LIMITS = {
  MIN: 15,
  MAX: 120,
  DEFAULT: 45,
} as const;

/**
 * Break duration limits in minutes
 */
export const BREAK_DURATION_LIMITS = {
  MIN: 5,
  MAX: 60,
  DEFAULT: 15,
} as const;

/**
 * Afghan education system grade categories
 * Each category contains a key for identification and the grades it includes
 */
export const GRADE_CATEGORIES = [
  { key: 'Alpha-Primary', grades: [1, 2, 3], labelKey: 'alphaPrimary' },
  { key: 'Beta-Primary', grades: [4, 5, 6], labelKey: 'betaPrimary' },
  { key: 'Middle', grades: [7, 8, 9], labelKey: 'middle' },
  { key: 'High', grades: [10, 11, 12], labelKey: 'high' },
] as const;

/**
 * Grade category key type
 */
export type GradeCategoryKey = (typeof GRADE_CATEGORIES)[number]['key'];

/**
 * All valid grades (1-12)
 */
export const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Grade type
 */
export type Grade = (typeof ALL_GRADES)[number];

/**
 * Default break configuration
 * Common break after 3rd period
 */
export const DEFAULT_BREAK_CONFIG = {
  afterPeriod: 3,
  duration: 15,
} as const;

/**
 * Prayer break name options
 */
export const PRAYER_BREAK_NAMES = [
  'ظهر', // Dhuhr
  'عصر', // Asr
] as const;

/**
 * Default prayer break configuration
 */
export const DEFAULT_PRAYER_BREAK = {
  name: 'ظهر',
  time: '12:00',
  duration: 15,
} as const;
