/**
 * Assignment Services Index
 * Re-exports all assignment service functions
 */

// Assignment validation
export {
  canTeacherTeachSubject,
  getCompatibleTeachersForSubject,
  getTeacherSubjectCompatibility,
  validateAssignment,
} from './assignmentValidation';

// Conflict detection
export {
  calculateTotalAssignedPeriods,
  detectAllConflicts,
  detectCompatibilityConflicts,
  detectCoverageConflict,
  detectTeacherConflicts,
  detectWorkloadConflict,
  enhanceClassAssignments,
  enhanceSubjectRequirements,
} from './conflictDetection';

// Workload calculation
export {
  NEAR_CAPACITY_THRESHOLD,
  OPTIMAL_UTILIZATION_MAX,
  OPTIMAL_UTILIZATION_MIN,
  calculateTeacherWorkload,
  calculateWorkloadBreakdown,
  calculateWorkloadWithAssignment,
  calculateWorkloadWithoutAssignment,
  canAcceptAdditionalPeriods,
  determineWorkloadStatus,
  formatUtilization,
  formatWorkloadDisplay,
  getAvailableCapacity,
  getWorkloadProgressColor,
  getWorkloadStatusBgColor,
  getWorkloadStatusColor,
  getWorkloadStatusLabelEn,
  getWorkloadStatusLabelFa,
} from './workloadCalculation';

// Error handling
export {
  AssignmentErrorCode,
  AssignmentErrorHandler,
  assignmentErrorHandler,
  formatConflictMessage,
  getAssignmentErrorMessage,
  getResolutionSuggestions,
} from './errorHandler';

// Conflict resolution
export {
  ConflictResolutionService,
  getBestResolution,
  getResolutionsForConflict,
  hasAutoApplicableResolution,
  type ResolutionActionType,
  type ResolutionResult,
  type ResolutionSuggestion,
} from './conflictResolution';

// Cache management
export {
  ASSIGNMENT_QUERY_KEYS,
  AssignmentCacheManager,
  CACHE_GC_TIMES,
  CACHE_STALE_TIMES,
  createAssignmentCacheManager,
} from './cacheManager';

// Optimized calculations
export {
  calculateCompatibilityOptimized,
  calculateCoveragesBatch,
  calculateWorkloadOptimized,
  calculateWorkloadsBatch,
  canAcceptMoreAssignments,
  clearCalculationCaches,
  getTeachersByCapacity,
  invalidateSubjectCache,
  invalidateTeacherCache,
} from './optimizedCalculations';
