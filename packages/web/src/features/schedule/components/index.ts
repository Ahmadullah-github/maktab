/**
 * Schedule components exports
 */

// Grid components
export { DraggableCell, ScheduleCell, ScheduleGrid } from './grid';
export type { DraggableCellProps } from './grid';

// Navigation components
export { CategoryAccordion, TeacherTabs } from './navigation';

// View components
export { ClassScheduleView, EmptyScheduleState, TeacherScheduleView } from './views';

// Dashboard components (Phase 3)
export {
  DeleteConfirmationDialog,
  GenerateButton,
  GenerationProgress,
  ScheduleDashboard,
  ScheduleList,
  ScheduleListItem,
  StatsCards,
} from './dashboard';
export type {
  DeleteConfirmationDialogProps,
  GenerateButtonProps,
  GenerationProgressProps,
  ScheduleListItemProps,
  ScheduleListProps,
  StatsCardsProps,
} from './dashboard';

// Settings components (Phase 4)
export {
  CellContentToggles,
  ColorCodingSelector,
  DisplaySettingsDialog,
  PresetButtons,
  SizeSelector,
} from './settings';

// Export components (Phase 5)
export {
  ExportDialog,
  ExportProgress,
  FormatSelector,
  LanguageSelector,
  ScopeSelector,
  SettingsToggles,
} from './export';

// Edit components (Phase 8)
export {
  SaveButton,
  UndoRedoButtons,
  UnsavedBadge,
  UnsavedChangesDialog,
  type SaveButtonProps,
  type UndoRedoButtonsProps,
  type UnsavedBadgeProps,
  type UnsavedChangesDialogProps,
} from './edit';
