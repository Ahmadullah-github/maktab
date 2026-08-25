/**
 * Assignment Utilities Index
 * Re-exports all assignment utility functions
 */

// Serialization utilities
export {
  // Class assignment serialization
  deserializeClassAssignments,
  deserializeEnhancedClassAssignments,
  // Subject requirement serialization
  deserializeEnhancedSubjectRequirements,
  deserializeSubjectRequirements,
  enhanceClassAssignment,
  enhanceSubjectRequirement,
  mergeClassAssignment,
  removeFromClassAssignment,
  serializeClassAssignments,
  serializeEnhancedClassAssignments,
  serializeEnhancedSubjectRequirements,
  serializeSubjectRequirements,
  toBaseClassAssignments,
  toBaseSubjectRequirements,
  validateClassAssignmentRoundTrip,
  validateSubjectRequirementRoundTrip,
  // Types
  type SolverClassAssignment,
  type SolverSubjectRequirement,
} from './assignmentSerialization';

// Notification utilities
export {
  getBulkRemovalConfirmationMessages,
  getRemovalConfirmationMessages,
  notifyAssignmentError,
  notifyAssignmentInfo,
  notifyAssignmentLoading,
  notifyAssignmentRemoved,
  notifyAssignmentSuccess,
  notifyBulkAssignmentSuccess,
  notifyBulkOperationLoading,
  notifyConflict,
  notifyConflicts,
  notifyCoverageWarning,
  notifyRemovalError,
  notifyWorkloadWarning,
  type ConflictNotificationOptions,
  type NotificationOptions,
} from './notifications';
