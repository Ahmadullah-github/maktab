/**
 * Assignment Components
 * Reusable UI components for the assignment system
 */

// Page Components
export { AssignmentsPage } from './AssignmentsPage';
export type { AssignmentsPageProps } from './AssignmentsPage';

// Filter Components
export { AssignmentsFilters } from './AssignmentsFilters';
export type { AssignmentsFiltersProps } from './AssignmentsFilters';

// Stats Components
export { AssignmentsStatsCard } from './AssignmentsStatsCard';
export type { AssignmentsStatsCardProps } from './AssignmentsStatsCard';

export { AssignmentProgress } from './AssignmentProgress';
export type { AssignmentProgressProps } from './AssignmentProgress';

// Grade Group Components
export { GradeGroupSection } from './GradeGroupSection';
export type { GradeGroupSectionProps } from './GradeGroupSection';

// Row & Cell Components
export { ClassAssignmentRow } from './ClassAssignmentRow';
export type { ClassAssignmentRowProps } from './ClassAssignmentRow';

export { AssignmentCell } from './AssignmentCell';
export type { AssignmentCellProps } from './AssignmentCell';

export { SubjectColumnHeader } from './SubjectColumnHeader';
export type { SubjectColumnHeaderProps } from './SubjectColumnHeader';

// Drawer Components
export { AssignmentDrawer } from './AssignmentDrawer';
export type { AssignmentDrawerProps } from './AssignmentDrawer';

export { AssignmentDrawerV2 } from './AssignmentDrawerV2';
export type { AssignmentDrawerV2Props } from './AssignmentDrawerV2';

export { TeacherSelectionList } from './TeacherSelectionList';
export type { TeacherSelectionListProps } from './TeacherSelectionList';

export { BulkAssignmentPreview } from './BulkAssignmentPreview';
export type { BulkAssignmentPreviewProps } from './BulkAssignmentPreview';

// Dialog Components
export { AssignmentConfirmDialog } from './AssignmentConfirmDialog';
export type { AssignmentConfirmDialogProps } from './AssignmentConfirmDialog';

export { BulkOperationProgress } from './BulkOperationProgress';
export type {
  BulkOperationProgressProps,
  BulkOperationResult,
  BulkOperationStatus,
} from './BulkOperationProgress';

export { VirtualizedList } from './VirtualizedList';
export type { VirtualizedListProps } from './VirtualizedList';

export { VirtualizedAssignmentMatrix } from './VirtualizedAssignmentMatrix';
export type {
  AssignmentCell as VirtualizedAssignmentCell,
  VirtualizedAssignmentMatrixProps,
} from './VirtualizedAssignmentMatrix';

export { PaginatedList } from './PaginatedList';
export type { PaginatedListProps } from './PaginatedList';

// Shared Components (Phase 1.4)
export {
  AssignmentStatusBadge,
  ClassSelector,
  CompatibilityBadge,
  SubjectSelector,
  TeacherSelector,
  WorkloadImpactPreview,
} from './shared';
export type {
  AssignmentStatusBadgeProps,
  ClassSelectorProps,
  CompatibilityBadgeProps,
  SubjectSelectorProps,
  TeacherSelectorProps,
  WorkloadImpactPreviewProps,
} from './shared';
