// Teachers feature exports

// Types
export * from './types';

// API
export { teachersApi } from './api';

// Hooks
export * from './hooks/useBulkImportTeachers';
export * from './hooks/useTeacherFilters';
export * from './hooks/useTeachers';

// Utils
export * from './utils';

// UI Components
export * from './components/ui';

// Components
export {
  AssignmentBadgesCell,
  type AssignmentBadgesCellProps,
} from './components/AssignmentBadgesCell';
export {
  AvailabilityMatrix,
  getMaxPeriods,
  getPeriodsForDay,
  isSlotUnavailable,
  toggleSlot,
  type AvailabilityMatrixProps,
} from './components/AvailabilityMatrix';
export {
  QuickAssignmentForm,
  type QuickAssignmentFormProps,
} from './components/QuickAssignmentForm';
export {
  SubjectManager,
  getSubjectZone,
  moveSubjectToZone,
  type Subject,
  type SubjectManagerProps,
  type SubjectZone,
} from './components/SubjectManager';
export { DraggableSubject, DroppableZone, SubjectChip } from './components/SubjectManagerParts';
export {
  TeacherAssignedClassesGrid,
  type TeacherAssignedClassesGridProps,
} from './components/TeacherAssignedClassesGrid';
export {
  TeacherBulkImportDialog,
  type TeacherBulkImportDialogProps,
} from './components/TeacherBulkImportDialog';
export { TeacherDataGrid, type TeacherDataGridProps } from './components/TeacherDataGrid';
export {
  TeacherEditDrawer,
  type EditTab,
  type TeacherEditDrawerProps,
} from './components/TeacherEditDrawer';
export { TeacherExcelImport, type TeacherExcelImportProps } from './components/TeacherExcelImport';
export { TeacherFilters, type TeacherFiltersProps } from './components/TeacherFilters';
export {
  TeacherForm,
  createTeacherFormSchemaWithConfig,
  getDefaultConstraints,
  type TeacherFormProps,
} from './components/TeacherForm';
export {
  TOTAL_STEPS,
  TeacherFormDrawer,
  validateWizardStep,
  type TeacherFormDrawerProps,
  type WizardStep,
} from './components/TeacherFormDrawer';
export {
  TeacherInspector,
  type InspectorTab,
  type TeacherInspectorProps,
} from './components/TeacherInspector';
export { TeacherPasteImport, type TeacherPasteImportProps } from './components/TeacherPasteImport';
export { TeacherQuickAdd, type TeacherQuickAddProps } from './components/TeacherQuickAdd';
export { TeachersPage, type TeachersPageProps } from './components/TeachersPage';
export { TeacherStatsCard, type TeacherStatsCardProps } from './components/TeacherStatsCard';
