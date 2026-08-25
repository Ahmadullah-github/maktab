/**
 * Schedule feature module exports
 * Phase 1: Core infrastructure and data layer
 * Phase 2: Grid rendering and view system
 * Phase 3: Dashboard & Schedule Management
 * Phase 4: Display Customization
 * Phase 5: Export System
 * Phase 8: Undo/Redo & Persistence
 */

// Types
export * from './types';

// Strategy constants and types (Phase 3)
export { STRATEGY_OPTIONS } from './types';
export type { GenerationError, GenerationErrorType, SolverStrategy, StrategyOption } from './types';

// Phase 4: Display Customization types
export type {
  CellSize,
  ColorCodingMode,
  DisplayPreset,
  DisplaySettingsDialogProps,
  FontSize,
} from './types';

// Phase 8: Undo/Redo & Persistence types
export { UNDO_STACK_LIMIT } from './types';
export type { EditState, SwapAction } from './types';

// Constants
export {
  CELL_SIZE_MAP,
  CONSTRAINT_TYPES,
  DAYS_OF_WEEK,
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_PRESETS,
  DISPLAY_SETTINGS_STORAGE_KEY,
  FONT_SIZE_MAP,
  GRADE_CATEGORIES,
  SCHEDULE_QUERY_KEYS,
} from './constants';

// Utils
export * from './utils';

// Stores
export {
  createEmptyIndexes,
  getCanRedo,
  getCanUndo,
  getHasUnsavedChanges,
  getInitialScheduleState,
  getUnsavedChangesCount,
  initialScheduleState,
  useScheduleStore,
} from './stores';

// API
export { scheduleApi, type SaveScheduleInput, type ScheduleApiResult } from './api';

// Hooks
export {
  useDeleteSchedule,
  useDisplaySettings,
  useGenerateSchedule,
  useSaveSchedule,
  useSchedule,
  useScheduleStats,
  useScheduleView,
  useSchedules,
} from './hooks';
export type {
  ScheduleStatsResult,
  UseDisplaySettingsReturn,
  UseGenerateScheduleReturn,
} from './hooks';

// Components (Phase 1 & 2)
export {
  CategoryAccordion,
  ClassScheduleView,
  EmptyScheduleState,
  ScheduleCell,
  ScheduleGrid,
  TeacherScheduleView,
  TeacherTabs,
} from './components';

// Dashboard Components (Phase 3)
export {
  DeleteConfirmationDialog,
  ScheduleDashboard,
  ScheduleList,
  ScheduleListItem,
  StatsCards,
} from './components';
export type {
  DeleteConfirmationDialogProps,
  ScheduleListItemProps,
  ScheduleListProps,
  StatsCardsProps,
} from './components';

// Settings Components (Phase 4)
export {
  CellContentToggles,
  ColorCodingSelector,
  DisplaySettingsDialog,
  PresetButtons,
  SizeSelector,
} from './components';

// Export Components (Phase 5) - will be implemented in subsequent tasks
export {
  ExportDialog,
  ExportProgress,
  FormatSelector,
  LanguageSelector,
  ScopeSelector,
  SettingsToggles,
} from './components';

// Export Hooks (Phase 5) - will be implemented in subsequent tasks
export { useExportSchedule } from './hooks';
export type { UseExportScheduleReturn } from './hooks';
