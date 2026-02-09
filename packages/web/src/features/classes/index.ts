// Classes feature exports

// Types
export * from './types';

// API
export { classesApi } from './api';

// Components
export {
  BulkApplyCurriculumDialog,
  type BulkApplyCurriculumDialogProps,
} from './components/BulkApplyCurriculumDialog';
export { ClassDataGrid, type ClassDataGridProps } from './components/ClassDataGrid';
export { ClassEditDrawer, type ClassEditDrawerProps } from './components/ClassEditDrawer';
export { ClassesPage, type ClassesPageProps } from './components/ClassesPage';
export { ClassFilters, type ClassFiltersProps } from './components/ClassFilters';
export { ClassForm, type ClassFormProps } from './components/ClassForm';
export { ClassFormDrawer, type ClassFormDrawerProps } from './components/ClassFormDrawer';
export { ClassStatsCard, type ClassStatsCardProps } from './components/ClassStatsCard';
export {
  SubjectRequirementsEditor,
  type SubjectRequirementsEditorProps,
} from './components/SubjectRequirementsEditor';
export * from './components/ui';

// Hooks
export {
  useBulkApplyCurriculum,
  type BulkApplyCurriculumOptions,
  type BulkApplyCurriculumResult,
} from './hooks/useBulkApplyCurriculum';
export { useClassAssignments } from './hooks/useClassAssignments';
export {
  CLASSES_QUERY_KEY,
  useClass,
  useClasses,
  useCreateClass,
  useDeleteClass,
  useUpdateClass,
} from './hooks/useClasses';
export {
  applyClassFilters,
  filterClassesByGradeCategory,
  filterClassesBySearch,
  useClassFilters,
} from './hooks/useClassFilters';
export {
  useCurriculumPopulation,
  type ApplyCurriculumResult,
  type CurriculumPreview,
  type UseCurriculumPopulationOptions,
} from './hooks/useCurriculumPopulation';

// Utils
export * from './utils/assignmentValidation';
export * from './utils/gradeCategory';
export { apiLogger, componentLogger, logger } from './utils/logger';
export * from './utils/serialization';
