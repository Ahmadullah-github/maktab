// Teachers feature exports

// Types
export * from './types';

// API
export { teachersApi } from './api';

// Hooks
export * from './hooks/useSchoolConfig';
export * from './hooks/useTeacherFilters';
export * from './hooks/useTeachers';

// Utils
export * from './utils';

// UI Components
export * from './components/ui';

// Components
export {
  AvailabilityMatrix,
  getMaxPeriods,
  getPeriodsForDay,
  isSlotUnavailable,
  toggleSlot,
  type AvailabilityMatrixProps,
} from './components/AvailabilityMatrix';
export {
  SubjectManager,
  getSubjectZone,
  moveSubjectToZone,
  type Subject,
  type SubjectManagerProps,
  type SubjectZone,
} from './components/SubjectManager';
export { DraggableSubject, DroppableZone, SubjectChip } from './components/SubjectManagerParts';
export { TeacherDataGrid, type TeacherDataGridProps } from './components/TeacherDataGrid';
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
export { TeachersPage, type TeachersPageProps } from './components/TeachersPage';
