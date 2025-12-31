// Classes feature exports

// Types
export * from './types';

// API
export { classesApi } from './api';

// Components
export { ClassDataGrid, type ClassDataGridProps } from './components/ClassDataGrid';
export { ClassesPage, type ClassesPageProps } from './components/ClassesPage';

export { ClassFilters, type ClassFiltersProps } from './components/ClassFilters';
export { ClassForm, type ClassFormProps } from './components/ClassForm';
export { ClassFormDrawer, type ClassFormDrawerProps } from './components/ClassFormDrawer';
export { ClassInspector, type ClassInspectorProps } from './components/ClassInspector';
export * from './components/ClassList';
export {
  SubjectRequirementsEditor,
  type SubjectRequirementsEditorProps,
} from './components/SubjectRequirementsEditor';
export * from './components/ui';

// Hooks
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

// Utils
export * from './utils/gradeCategory';
export { apiLogger, componentLogger, logger } from './utils/logger';
export * from './utils/serialization';
