/**
 * Assignment Types
 * Shared type definitions for the Subject-Teacher-Class Assignment System
 *
 * Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 2.2, 2.5
 */

// ============================================================================
// Assignment Status Types
// ============================================================================

/**
 * Status of an assignment relationship
 * - assigned: Teacher is assigned and valid
 * - unassigned: No teacher assigned
 * - partial: Some classes assigned, others not
 * - conflict: Assignment exists but has conflicts
 */
export type AssignmentStatus = 'assigned' | 'unassigned' | 'partial' | 'conflict';

/**
 * Type of conflict detected in an assignment
 */
export type ConflictType =
  | 'workload_exceeded'
  | 'subject_incompatible'
  | 'availability_conflict'
  | 'coverage_insufficient'
  | 'duplicate_assignment';

/**
 * Severity level of a conflict
 */
export type ConflictSeverity = 'warning' | 'error';

// ============================================================================
// Conflict Types
// ============================================================================

/**
 * Entities affected by a conflict
 */
export interface AffectedEntities {
  teacherId?: number;
  subjectId?: number;
  classId?: number;
}

/**
 * Assignment conflict information
 */
export interface AssignmentConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  messageFa: string;
  affectedEntities: AffectedEntities;
  suggestedResolution?: string;
  suggestedResolutionFa?: string;
}

// ============================================================================
// Enhanced Assignment Types
// ============================================================================

/**
 * Enhanced ClassAssignment with calculated fields
 * Extends the base ClassAssignment from teachers/types.ts
 */
export interface EnhancedClassAssignment {
  subjectId: number;
  classIds: number[];
  /** Calculated: periods per week for this subject */
  periodsPerWeek: number;
  /** Calculated: total periods (classIds.length * periodsPerWeek) */
  totalPeriods: number;
  /** Detected conflicts for this assignment */
  conflicts: AssignmentConflict[];
  /** Current status of the assignment */
  status: AssignmentStatus;
}

/**
 * Enhanced SubjectRequirement with teacher assignment
 * Extends the base SubjectRequirement from classes/types.ts
 */
export interface EnhancedSubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  /** Assigned teacher ID (null if unassigned) */
  teacherId: number | null;
  /** Current assignment status */
  assignmentStatus: AssignmentStatus;
  /** Detected conflicts for this requirement */
  conflicts: AssignmentConflict[];
}

// ============================================================================
// Workload Types
// ============================================================================

/**
 * Workload status based on capacity utilization
 */
export type WorkloadStatus = 'underloaded' | 'optimal' | 'near_capacity' | 'overloaded';

/**
 * Breakdown of workload by subject
 */
export interface WorkloadBreakdown {
  subjectId: number;
  subjectName: string;
  classIds: number[];
  periodsPerWeek: number;
  totalPeriods: number;
}

/**
 * Complete workload calculation for a teacher
 */
export interface TeacherWorkload {
  teacherId: number;
  /** Total periods assigned across all subjects/classes */
  totalPeriods: number;
  /** Effective maximum periods (min of contracted and available slots) */
  maxPeriods: number;
  /** Contracted maximum periods per week (from teacher settings) */
  contractedMaxPeriods?: number;
  /** Available slots (total school periods minus unavailable slots) */
  availableSlots?: number;
  /** Percentage of capacity used (0-100+) */
  utilizationPercentage: number;
  /** Breakdown by subject */
  breakdown: WorkloadBreakdown[];
  /** Current workload status */
  status: WorkloadStatus;
  /** Remaining capacity (can be negative if overloaded) */
  remainingCapacity: number;
}

// ============================================================================
// Coverage Types
// ============================================================================

/**
 * Coverage status for a subject
 */
export type CoverageStatus = 'complete' | 'partial' | 'uncovered';

/**
 * Detail about a class's coverage for a subject
 */
export interface ClassCoverageDetail {
  classId: number;
  className: string;
  periodsPerWeek: number;
  assignmentStatus: AssignmentStatus;
  assignedTeacherId: number | null;
  assignedTeacherName: string | null;
  conflicts: AssignmentConflict[];
}

/**
 * Detail about a teacher's coverage for a subject
 */
export interface TeacherCoverageDetail {
  teacherId: number;
  teacherName: string;
  assignedClassIds: number[];
  totalPeriods: number;
  compatibility: TeacherCompatibilityLevel;
}

/**
 * Complete coverage analysis for a subject
 */
export interface SubjectCoverage {
  subjectId: number;
  subjectName: string;
  /** Total classes that require this subject */
  totalClassesRequiring: number;
  /** Number of classes with assigned teachers */
  assignedClasses: number;
  /** Details for unassigned classes */
  unassignedClasses: ClassCoverageDetail[];
  /** Distribution of teachers teaching this subject */
  teacherDistribution: TeacherCoverageDetail[];
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Overall coverage status */
  status: CoverageStatus;
}

// ============================================================================
// Teacher Compatibility Types
// ============================================================================

/**
 * Level of teacher compatibility with a subject
 * - primary: Subject is in teacher's primarySubjectIds
 * - allowed: Subject is in teacher's allowedSubjectIds
 * - incompatible: Teacher cannot teach this subject
 */
export type TeacherCompatibilityLevel = 'primary' | 'allowed' | 'incompatible';

/**
 * Teacher compatibility information for a subject
 */
export interface TeacherCompatibility {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  compatibility: TeacherCompatibilityLevel;
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
  /** Whether teacher can accept more assignments */
  canAcceptAssignment: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Request to validate an assignment
 */
export interface AssignmentValidationRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number;
}

/**
 * Result of assignment validation
 */
export interface AssignmentValidationResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentConflict[];
}

// ============================================================================
// Operation Types
// ============================================================================

/**
 * Request to assign a teacher
 */
export interface AssignTeacherRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number;
}

/**
 * Request to unassign a teacher
 */
export interface UnassignTeacherRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
}

/**
 * Result of an assignment operation
 */
export interface AssignmentOperationResult {
  success: boolean;
  conflicts: AssignmentConflict[];
  /** Updated teacher data after operation */
  updatedTeacherId?: number;
  /** Updated class IDs after operation */
  updatedClassIds?: number[];
}

// ============================================================================
// Assignments Page Types
// ============================================================================

/**
 * Grade category for grouping classes
 * Matches the Afghan education system tiers
 */
export type AssignmentGradeCategory = 'Alpha-Primary' | 'Beta-Primary' | 'Middle' | 'High';

/**
 * Filter options for the assignments page
 */
export type AssignmentStatusFilter = 'all' | 'unassigned' | 'assigned' | 'partial' | 'conflict';

/**
 * Statistics for a single class's assignments
 */
export interface ClassAssignmentStats {
  /** Total subject requirements for this class */
  total: number;
  /** Number of subjects with assigned teachers */
  assigned: number;
  /** Number of subjects without assigned teachers */
  unassigned: number;
  /** Number of subjects with conflicts */
  conflict: number;
}

/**
 * A class with its computed assignment status and requirements
 */
export interface ClassWithAssignmentStatus {
  /** The class entity */
  classId: number;
  className: string;
  displayName: string;
  grade: number | null;
  sectionIndex: string;
  /** Whether this class uses single-teacher mode (grades 1-3) */
  singleTeacherMode: boolean;
  /** Enhanced subject requirements with assignment info */
  requirements: EnhancedSubjectRequirement[];
  /** Assignment statistics */
  stats: ClassAssignmentStats;
  /** Overall assignment status for this class */
  overallStatus: AssignmentStatus;
}

/**
 * Statistics for a grade group
 */
export interface GradeGroupStats {
  /** Total classes in this grade group */
  totalClasses: number;
  /** Total subject requirements across all classes */
  totalRequirements: number;
  /** Number of assigned requirements */
  assignedCount: number;
  /** Number of unassigned requirements */
  unassignedCount: number;
  /** Number of requirements with conflicts */
  conflictCount: number;
  /** Assignment completion percentage (0-100) */
  completionPercentage: number;
}

/**
 * A grade group containing classes of the same tier
 */
export interface GradeGroup {
  /** Grade category identifier */
  category: AssignmentGradeCategory;
  /** Display label in English */
  label: string;
  /** Display label in Farsi */
  labelFa: string;
  /** Grades included in this group (e.g., [1, 2, 3]) */
  grades: number[];
  /** Classes in this grade group with assignment status */
  classes: ClassWithAssignmentStatus[];
  /** Aggregated statistics for this group */
  stats: GradeGroupStats;
  /** Whether this group is expanded in the UI */
  isExpanded?: boolean;
}

/**
 * Overall statistics for the assignments page
 */
export interface AssignmentsPageStats {
  /** Total classes across all grades */
  totalClasses: number;
  /** Total subject requirements across all classes */
  totalRequirements: number;
  /** Number of assigned requirements */
  assignedCount: number;
  /** Number of unassigned requirements */
  unassignedCount: number;
  /** Number of requirements with conflicts */
  conflictCount: number;
  /** Overall completion percentage (0-100) */
  completionPercentage: number;
}

/**
 * Filter state for the assignments page
 */
export interface AssignmentsFilterState {
  /** Search query for class name */
  search: string;
  /** Filter by grade category (null = all) */
  gradeCategory: AssignmentGradeCategory | null;
  /** Filter by assignment status */
  statusFilter: AssignmentStatusFilter;
}

/**
 * A single cell selection (class + subject combination)
 */
export interface AssignmentCellSelection {
  classId: number;
  subjectId: number;
  /** Cached subject name for display */
  subjectName?: string;
  /** Cached class name for display */
  className?: string;
  /** Periods per week for this requirement */
  periodsPerWeek?: number;
}

/**
 * Selection state for bulk operations
 */
export interface AssignmentSelectionState {
  /** Current selection mode */
  mode: 'single' | 'bulk';
  /** Selected cells for assignment */
  selectedCells: AssignmentCellSelection[];
}

/**
 * Drawer mode for assignment operations
 */
export type AssignmentDrawerMode = 'closed' | 'assign' | 'bulk-assign' | 'view-details';

/**
 * State for the assignment drawer/side panel
 */
export interface AssignmentDrawerState {
  /** Current drawer mode */
  mode: AssignmentDrawerMode;
  /** Target class ID (for single assignment) */
  classId: number | null;
  /** Target subject ID (for single assignment) */
  subjectId: number | null;
  /** Selected cells (for bulk assignment) */
  selectedCells: AssignmentCellSelection[];
  /** Currently selected teacher ID in the drawer */
  selectedTeacherId: number | null;
}

/**
 * Result of a bulk assignment preview
 */
export interface BulkAssignmentPreviewItem {
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  periodsPerWeek: number;
  /** Whether this assignment can proceed */
  canAssign: boolean;
  /** Reason if cannot assign */
  reason?: string;
  reasonFa?: string;
  /** Conflicts detected */
  conflicts: AssignmentConflict[];
}

/**
 * Complete bulk assignment preview
 */
export interface BulkAssignmentPreview {
  /** Teacher being assigned */
  teacherId: number;
  teacherName: string;
  /** Current workload before assignment */
  currentWorkload: number;
  /** Workload after assignment (if all succeed) */
  projectedWorkload: number;
  /** Maximum workload allowed */
  maxWorkload: number;
  /** Individual assignment previews */
  items: BulkAssignmentPreviewItem[];
  /** Number of assignments that can proceed */
  canAssignCount: number;
  /** Number of assignments that will fail */
  cannotAssignCount: number;
  /** Total periods being added */
  totalPeriodsToAdd: number;
}
