/**
 * Schedule hooks exports
 */

export {
  useCellSelection,
  type UseCellSelectionOptions,
  type UseCellSelectionReturn,
} from './useCellSelection';
export { useDisplaySettings, type UseDisplaySettingsReturn } from './useDisplaySettings';
export { useGenerateSchedule, type UseGenerateScheduleReturn } from './useGenerateSchedule';
export {
  useKeyboardNavigation,
  type UseKeyboardNavigationOptions,
  type UseKeyboardNavigationReturn,
} from './useKeyboardNavigation';
export { useDeleteSchedule, useSaveSchedule, useSchedule, useSchedules } from './useSchedule';
export { useScheduleStats, type ScheduleStatsResult } from './useScheduleStats';
export { useScheduleView } from './useScheduleView';

// Export hooks (Phase 5)
export { useExportSchedule, type UseExportScheduleReturn } from './useExportSchedule';

// Export hooks (Phase 7)
export {
  getValidationStatusFromResult,
  useValidSwapTargets,
  type UseValidSwapTargetsOptions,
  type UseValidSwapTargetsReturn,
} from './useValidSwapTargets';

// Export hooks (Phase 8)
export { useKeyboardShortcuts, type UseKeyboardShortcutsOptions } from './useKeyboardShortcuts';
export {
  useSaveScheduleChanges,
  type UseSaveScheduleChangesReturn,
} from './useSaveScheduleChanges';
export { useSwapExecution, type UseSwapExecutionReturn } from './useSwapExecution';
export { useUndoRedo, type UseUndoRedoReturn } from './useUndoRedo';
export {
  useUnsavedChanges,
  type UseUnsavedChangesOptions,
  type UseUnsavedChangesReturn,
} from './useUnsavedChanges';

// Schedule Dashboard Redesign hooks
export {
  determineEmptyStateType,
  useEmptyStateLogic,
  type EmptyStateType,
  type UseEmptyStateLogicReturn,
} from './useEmptyStateLogic';
export {
  useEnhancedGenerateSchedule,
  type EnhancedGenerationError,
  type UseEnhancedGenerateScheduleReturn,
} from './useEnhancedGenerateSchedule';
export { useReadinessData, type UseReadinessDataReturn } from './useReadinessData';
export {
  useReadinessValidation,
  type UseReadinessValidationReturn,
} from './useReadinessValidation';

// Phase 2: Validation hooks
export { usePeriodsConfiguration, type PeriodsConfiguration } from './usePeriodsConfiguration';
export { useViewScopeValidation, type ViewScopeValidationResult } from './useViewScopeValidation';

// Phase 4: Performance monitoring (development only)
export { measureTime, measureTimeAsync, useSchedulePerformance } from './useSchedulePerformance';
