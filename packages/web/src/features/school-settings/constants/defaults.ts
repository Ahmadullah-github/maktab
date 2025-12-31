/**
 * School Settings Constants
 * Data-driven configuration values for school operational settings
 * Requirements: 8.1, 8.3, 8.5
 */

/**
 * Afghan school week days (Saturday-Thursday)
 * Used as default selection for days of operation
 */
export const AFGHAN_WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
] as const;

/**
 * All week days including Friday
 * Used for rendering day selection checkboxes
 */
export const ALL_WEEK_DAYS = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

/**
 * Day type derived from ALL_WEEK_DAYS
 */
export type WeekDay = (typeof ALL_WEEK_DAYS)[number];

/**
 * Default school start time (HH:mm format)
 */
export const DEFAULT_START_TIME = '07:30';

/**
 * Default timezone for Afghan schools
 */
export const DEFAULT_TIMEZONE = 'Asia/Kabul';

/**
 * Valid timezone options with Farsi labels
 * Includes common timezones for the region
 */
export const VALID_TIMEZONES = [
  { value: 'Asia/Kabul', label: 'کابل (UTC+4:30)' },
  { value: 'Asia/Tehran', label: 'تهران (UTC+3:30)' },
  { value: 'Asia/Dubai', label: 'دبی (UTC+4)' },
  { value: 'Asia/Karachi', label: 'کراچی (UTC+5)' },
] as const;

/**
 * Timezone value type derived from VALID_TIMEZONES
 */
export type TimezoneValue = (typeof VALID_TIMEZONES)[number]['value'];

/**
 * Shift mode options
 */
export const SHIFT_MODES = ['single', 'multi'] as const;

/**
 * Shift mode type
 */
export type ShiftMode = (typeof SHIFT_MODES)[number];

/**
 * Default shift configuration for multi-shift mode
 */
export const DEFAULT_SHIFT_CONFIG = {
  morning: { start: '07:30', end: '12:30' },
  afternoon: { start: '13:00', end: '18:00' },
} as const;
