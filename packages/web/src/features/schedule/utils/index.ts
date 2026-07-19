/**
 * Schedule feature utilities
 */

export {
  generateEntityColor,
  getColorLightness,
  getContrastRatio,
  getContrastTextColor,
  hasGoodContrast,
} from './colorUtils';
export {
  checkClassConflict,
  checkDifficultAfternoon,
  checkRoomConflict,
  checkRoomTypeMismatch,
  checkTeacherAvailability,
  checkTeacherConflict,
  checkTeacherPreference,
  validateSwap,
} from './constraintChecker';
export { buildIndexes, createEntitySlotKey, createSlotKey } from './indexBuilder';
export { apiLogger, logger } from './logger';
export {
  createCellId,
  getFirstSlot,
  getNextSlot,
  getPeriodsForDay,
  isArrowKey,
  parseCellId,
  type ArrowKey,
  type NavigationConfig,
} from './navigationUtils';
export {
  ScheduleTransformError,
  normalizeSchedule,
  serializeSchedule,
} from './scheduleTransformer';
