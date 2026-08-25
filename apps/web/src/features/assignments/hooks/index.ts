/**
 * Assignment Hooks
 * Real-time synchronization hooks for the assignment system
 */

// Page-level hooks
export { useAssignmentsPage } from './useAssignmentsPage';
export type { UseAssignmentsPageOptions, UseAssignmentsPageResult } from './useAssignmentsPage';

// Unified assignment hook (Phase 1.2)
export { useUnifiedAssignment } from './useUnifiedAssignment';
export type {
  AssignmentInfo,
  ClassOption,
  SubjectOption,
  TeacherOption,
  UseUnifiedAssignmentOptions,
  UseUnifiedAssignmentResult,
} from './useUnifiedAssignment';

// Mutation hooks
export {
  assignmentsApi,
  useAssignTeacher,
  useAssignmentMutations,
  useUnassignTeacher,
  useValidateAssignment,
} from './useAssignmentMutations';
export type { UseAssignmentMutationsResult } from './useAssignmentMutations';

// Bulk selection hooks
export { useBulkSelection } from './useBulkSelection';
export type { UseBulkSelectionOptions, UseBulkSelectionResult } from './useBulkSelection';

// Real-time hooks
export { QUERY_KEYS, useRealtimeWorkload } from './useRealtimeWorkload';
export type { UseRealtimeWorkloadOptions, UseRealtimeWorkloadResult } from './useRealtimeWorkload';

export { useRealtimeConflicts } from './useRealtimeConflicts';
export type {
  ConflictResolution,
  UseRealtimeConflictsOptions,
  UseRealtimeConflictsResult,
} from './useRealtimeConflicts';

export { useAssignmentSync } from './useAssignmentSync';
export type {
  AssignmentSyncState,
  StatusChangeEvent,
  UseAssignmentSyncOptions,
  UseAssignmentSyncResult,
} from './useAssignmentSync';

export { useBulkOperation } from './useBulkOperation';
export type {
  BulkOperationOptions,
  BulkOperationState,
  UseBulkOperationReturn,
} from './useBulkOperation';

// Workload impact calculator (Phase 1.3)
export { useBulkWorkloadImpact, useWorkloadImpact } from './useWorkloadImpact';
export type {
  BulkWorkloadImpact,
  UseWorkloadImpactOptions,
  UseWorkloadImpactResult,
  WorkloadImpact,
} from './useWorkloadImpact';

// Conflict detection (Phase 4.3)
export { useConflictDetection } from './useConflictDetection';
export type {
  ConflictDetectionOptions,
  ConflictDetectionResult,
  UseConflictDetectionResult,
} from './useConflictDetection';

// Error handling (Phase 4.5)
export { useAssignmentErrorHandler } from './useAssignmentErrorHandler';
export type {
  ErrorState,
  RetryConfig,
  UseAssignmentErrorHandlerOptions,
  UseAssignmentErrorHandlerResult,
} from './useAssignmentErrorHandler';
