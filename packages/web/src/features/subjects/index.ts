/**
 * Subjects feature exports
 *
 * Requirements: 11.1
 */

// Types
export * from './types';

// API
export { subjectsApi } from './api';

// Serialization utilities
export {
  deserializeSubject,
  parseJsonArray,
  parseJsonObject,
  serializeSubjectForApi,
} from './utils/serialization';

// Section translation utilities
export {
  SECTION_LABELS,
  VALID_SECTIONS,
  getSectionLabel,
  hasValidTranslation,
} from './utils/sectionTranslation';

// Logger utilities
export { apiLogger, componentLogger, logger } from './utils/logger';

// Components
export { CurriculumDialog } from './components/CurriculumDialog';
export type { CurriculumDialogMode, CurriculumDialogProps } from './components/CurriculumDialog';
export { SubjectAssignmentSheet } from './components/SubjectAssignmentSheet';
export type { SubjectAssignmentSheetProps } from './components/SubjectAssignmentSheet';
export { SubjectCoverageCell } from './components/SubjectCoverageCell';
export type { SubjectCoverageCellProps } from './components/SubjectCoverageCell';
export { SubjectCoverageView } from './components/SubjectCoverageView';
export type { SubjectCoverageViewProps } from './components/SubjectCoverageView';
export { SubjectDataGrid, translateSection } from './components/SubjectDataGrid';
export type { SubjectDataGridProps } from './components/SubjectDataGrid';
export { SubjectEditDrawer } from './components/SubjectEditDrawer';
export type { SubjectEditDrawerProps } from './components/SubjectEditDrawer';
export { SubjectFilters } from './components/SubjectFilters';
export type { SubjectFiltersProps } from './components/SubjectFilters';
export { SubjectForm } from './components/SubjectForm';
export type { SubjectFormProps } from './components/SubjectForm';
export { SubjectFormDrawer } from './components/SubjectFormDrawer';
export type { SubjectFormDrawerProps } from './components/SubjectFormDrawer';
export { SubjectInspector } from './components/SubjectInspector';
export type { SubjectInspectorProps } from './components/SubjectInspector';
export { SubjectsPage } from './components/SubjectsPage';
export type { SubjectsPageProps } from './components/SubjectsPage';
export { SubjectStatsCard } from './components/SubjectStatsCard';
export type { SubjectStatsCardProps } from './components/SubjectStatsCard';

// Hooks
export {
  SUBJECTS_QUERY_KEY,
  useClearGradeSubjects,
  useCreateSubject,
  useDeleteSubject,
  useInsertCurriculum,
  useSubject,
  useSubjects,
  useUpdateSubject,
} from './hooks/useSubjects';

export {
  applySubjectFilters,
  filterSubjectsBySearch,
  filterSubjectsBySection,
  useSubjectFilters,
} from './hooks/useSubjectFilters';

export { useSubjectCoverage } from './hooks/useSubjectCoverage';
export type {
  UseSubjectCoverageOptions,
  UseSubjectCoverageResult,
} from './hooks/useSubjectCoverage';

export {
  useAllSubjectAssignmentSummaries,
  useSubjectAssignments,
} from './hooks/useSubjectAssignments';
export type {
  ClassAssignmentSummary,
  ClassSubjectAssignment,
  SubjectAssignmentSummary,
  SubjectAssignmentSummaryTeacher,
  UseAllSubjectAssignmentSummariesResult,
  UseSubjectAssignmentsResult,
} from './hooks/useSubjectAssignments';
