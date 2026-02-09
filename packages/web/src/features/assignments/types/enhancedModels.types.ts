/**
 * Enhanced Data Models
 * Extended versions of Teacher and ClassGroup with calculated assignment fields
 *
 * These types maintain backward compatibility with the solver format while
 * providing enhanced UI capabilities for assignment management.
 *
 * Requirements: 7.1, 7.2
 */

import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  EnhancedClassAssignment,
  EnhancedSubjectRequirement,
  TeacherWorkload,
  WorkloadStatus,
} from './assignment.types';

// ============================================================================
// JSON Parsing Helpers
// ============================================================================

/**
 * Safely parse JSON array from string or return as-is if already an array
 */
function parseJsonArray<T>(value: string | T[] | null | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Ensure subjectRequirements is always an array
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  return parseJsonArray<SubjectRequirement>(requirements);
}

// ============================================================================
// Enhanced Teacher Model
// ============================================================================

/**
 * Enhanced Teacher with calculated assignment fields
 * Extends the base Teacher type with workload and conflict information
 *
 * Requirements: 7.1
 */
export interface EnhancedTeacher extends Teacher {
  /**
   * Enhanced class assignments with calculated fields
   * Includes periodsPerWeek, totalPeriods, conflicts, and status
   */
  enhancedClassAssignments: EnhancedClassAssignment[];

  /**
   * Calculated workload information
   */
  workload: TeacherWorkloadSummary;

  /**
   * All conflicts detected for this teacher's assignments
   */
  assignmentConflicts: AssignmentConflict[];

  /**
   * Whether the teacher has any assignment conflicts
   */
  hasConflicts: boolean;
}

/**
 * Summary of teacher workload for quick display
 */
export interface TeacherWorkloadSummary {
  /** Total periods currently assigned */
  totalPeriods: number;
  /** Maximum periods allowed per week */
  maxPeriods: number;
  /** Percentage of capacity used (0-100+) */
  utilizationPercentage: number;
  /** Current workload status */
  status: WorkloadStatus;
  /** Remaining capacity (can be negative if overloaded) */
  remainingCapacity: number;
  /** Number of subjects assigned */
  subjectCount: number;
  /** Number of classes assigned */
  classCount: number;
}

/**
 * Create an enhanced teacher from base teacher data
 *
 * @param teacher - Base teacher data
 * @param enhancedAssignments - Enhanced class assignments
 * @param workload - Full workload calculation
 * @returns Enhanced teacher with calculated fields
 */
export function createEnhancedTeacher(
  teacher: Teacher,
  enhancedAssignments: EnhancedClassAssignment[],
  workload: TeacherWorkload
): EnhancedTeacher {
  // Collect all conflicts from assignments
  const assignmentConflicts = enhancedAssignments.flatMap((a) => a.conflicts);

  // Calculate class count (unique classes across all assignments)
  const uniqueClassIds = new Set<number>();
  for (const assignment of enhancedAssignments) {
    for (const classId of assignment.classIds) {
      uniqueClassIds.add(classId);
    }
  }

  return {
    ...teacher,
    enhancedClassAssignments: enhancedAssignments,
    workload: {
      totalPeriods: workload.totalPeriods,
      maxPeriods: workload.maxPeriods,
      utilizationPercentage: workload.utilizationPercentage,
      status: workload.status,
      remainingCapacity: workload.remainingCapacity,
      subjectCount: enhancedAssignments.length,
      classCount: uniqueClassIds.size,
    },
    assignmentConflicts,
    hasConflicts: assignmentConflicts.some((c) => c.severity === 'error'),
  };
}

/**
 * Convert enhanced teacher back to base teacher format
 * Strips calculated fields for API submission
 *
 * @param enhanced - Enhanced teacher
 * @returns Base teacher data
 */
export function toBaseTeacher(enhanced: EnhancedTeacher): Teacher {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { enhancedClassAssignments, workload, assignmentConflicts, hasConflicts, ...base } =
    enhanced;
  return base;
}

// ============================================================================
// Enhanced ClassGroup Model
// ============================================================================

/**
 * Enhanced ClassGroup with calculated assignment fields
 * Extends the base ClassGroup type with assignment status information
 *
 * Requirements: 7.2
 */
export interface EnhancedClassGroup extends ClassGroup {
  /**
   * Enhanced subject requirements with teacher assignments and status
   */
  enhancedSubjectRequirements: EnhancedSubjectRequirement[];

  /**
   * Summary of assignment coverage for this class
   */
  assignmentSummary: ClassAssignmentSummary;

  /**
   * All conflicts detected for this class's assignments
   */
  assignmentConflicts: AssignmentConflict[];

  /**
   * Whether the class has any assignment conflicts
   */
  hasConflicts: boolean;
}

/**
 * Summary of class assignment coverage
 */
export interface ClassAssignmentSummary {
  /** Total subjects required for this class */
  totalSubjects: number;
  /** Number of subjects with assigned teachers */
  assignedSubjects: number;
  /** Number of subjects without assigned teachers */
  unassignedSubjects: number;
  /** Number of subjects with conflicts */
  conflictSubjects: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Total periods per week for all subjects */
  totalPeriodsPerWeek: number;
  /** Periods per week with assigned teachers */
  assignedPeriodsPerWeek: number;
}

/**
 * Create an enhanced class group from base class data
 *
 * @param classGroup - Base class group data
 * @param enhancedRequirements - Enhanced subject requirements
 * @returns Enhanced class group with calculated fields
 */
export function createEnhancedClassGroup(
  classGroup: ClassGroup,
  enhancedRequirements: EnhancedSubjectRequirement[]
): EnhancedClassGroup {
  // Collect all conflicts from requirements
  const assignmentConflicts = enhancedRequirements.flatMap((r) => r.conflicts);

  // Calculate summary statistics
  const totalSubjects = enhancedRequirements.length;
  const assignedSubjects = enhancedRequirements.filter(
    (r) => r.assignmentStatus === 'assigned'
  ).length;
  const unassignedSubjects = enhancedRequirements.filter(
    (r) => r.assignmentStatus === 'unassigned'
  ).length;
  const conflictSubjects = enhancedRequirements.filter(
    (r) => r.assignmentStatus === 'conflict'
  ).length;

  const totalPeriodsPerWeek = enhancedRequirements.reduce((sum, r) => sum + r.periodsPerWeek, 0);
  const assignedPeriodsPerWeek = enhancedRequirements
    .filter((r) => r.assignmentStatus === 'assigned')
    .reduce((sum, r) => sum + r.periodsPerWeek, 0);

  const coveragePercentage =
    totalSubjects > 0 ? Math.round((assignedSubjects / totalSubjects) * 100) : 100;

  return {
    ...classGroup,
    enhancedSubjectRequirements: enhancedRequirements,
    assignmentSummary: {
      totalSubjects,
      assignedSubjects,
      unassignedSubjects,
      conflictSubjects,
      coveragePercentage,
      totalPeriodsPerWeek,
      assignedPeriodsPerWeek,
    },
    assignmentConflicts,
    hasConflicts: assignmentConflicts.some((c) => c.severity === 'error'),
  };
}

/**
 * Convert enhanced class group back to base class group format
 * Strips calculated fields for API submission
 *
 * @param enhanced - Enhanced class group
 * @returns Base class group data
 */
export function toBaseClassGroup(enhanced: EnhancedClassGroup): ClassGroup {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    enhancedSubjectRequirements,
    assignmentSummary,
    assignmentConflicts,
    hasConflicts,
    ...base
  } = enhanced;
  return base;
}

// ============================================================================
// Enhanced Subject Model
// ============================================================================

/**
 * Enhanced Subject with coverage information
 * Extends the base Subject type with teaching coverage analysis
 */
export interface EnhancedSubject extends Subject {
  /**
   * Coverage analysis for this subject across all classes
   */
  coverageSummary: SubjectCoverageSummary;

  /**
   * Teachers who can teach this subject
   */
  compatibleTeacherIds: number[];

  /**
   * Teachers currently assigned to teach this subject
   */
  assignedTeacherIds: number[];
}

/**
 * Summary of subject coverage across classes
 */
export interface SubjectCoverageSummary {
  /** Total classes that require this subject */
  totalClassesRequiring: number;
  /** Number of classes with assigned teachers */
  assignedClasses: number;
  /** Number of classes without assigned teachers */
  unassignedClasses: number;
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Total periods per week across all classes */
  totalPeriodsPerWeek: number;
  /** Number of teachers teaching this subject */
  teacherCount: number;
}

/**
 * Create an enhanced subject from base subject data
 *
 * @param subject - Base subject data
 * @param classes - All classes (to calculate coverage)
 * @param teachers - All teachers (to find compatible teachers)
 * @returns Enhanced subject with calculated fields
 */
export function createEnhancedSubject(
  subject: Subject,
  classes: ClassGroup[],
  teachers: Teacher[]
): EnhancedSubject {
  // Find classes that require this subject (ensure subjectRequirements is parsed)
  const classesRequiring = classes.filter((c) => {
    const requirements = ensureSubjectRequirements(c.subjectRequirements);
    return requirements.some((r) => r.subjectId === subject.id);
  });

  // Count assigned vs unassigned
  let assignedClasses = 0;
  let totalPeriodsPerWeek = 0;
  const assignedTeacherIds = new Set<number>();

  for (const classGroup of classesRequiring) {
    const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
    const requirement = requirements.find((r) => r.subjectId === subject.id);
    if (requirement) {
      totalPeriodsPerWeek += requirement.periodsPerWeek;
      if (requirement.teacherId != null) {
        assignedClasses++;
        assignedTeacherIds.add(requirement.teacherId);
      }
    }
  }

  // Find compatible teachers
  const compatibleTeacherIds = teachers
    .filter((t) => {
      if (t.primarySubjectIds.includes(subject.id)) return true;
      if (!t.restrictToPrimarySubjects && t.allowedSubjectIds.includes(subject.id)) return true;
      return false;
    })
    .map((t) => t.id);

  const totalClassesRequiring = classesRequiring.length;
  const unassignedClasses = totalClassesRequiring - assignedClasses;
  const coveragePercentage =
    totalClassesRequiring > 0 ? Math.round((assignedClasses / totalClassesRequiring) * 100) : 100;

  return {
    ...subject,
    coverageSummary: {
      totalClassesRequiring,
      assignedClasses,
      unassignedClasses,
      coveragePercentage,
      totalPeriodsPerWeek,
      teacherCount: assignedTeacherIds.size,
    },
    compatibleTeacherIds,
    assignedTeacherIds: Array.from(assignedTeacherIds),
  };
}

/**
 * Convert enhanced subject back to base subject format
 *
 * @param enhanced - Enhanced subject
 * @returns Base subject data
 */
export function toBaseSubject(enhanced: EnhancedSubject): Subject {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { coverageSummary, compatibleTeacherIds, assignedTeacherIds, ...base } = enhanced;
  return base;
}

// ============================================================================
// Utility Types for Bidirectional Sync
// ============================================================================

/**
 * Result of a bidirectional assignment update
 * Contains both the updated teacher and class data
 *
 * Requirements: 7.1, 7.2
 */
export interface BidirectionalUpdateResult {
  /** Updated teacher with new assignments */
  updatedTeacher: Teacher;
  /** Updated classes with new subject requirements */
  updatedClasses: ClassGroup[];
  /** Any conflicts detected during the update */
  conflicts: AssignmentConflict[];
  /** Whether the update was successful */
  success: boolean;
}

/**
 * Apply a teacher assignment and update both teacher and class data
 *
 * @param teacher - Teacher to update
 * @param classes - Classes to update
 * @param subjectId - Subject being assigned
 * @param classIds - Classes to assign
 * @returns Updated teacher and classes
 */
export function applyBidirectionalAssignment(
  teacher: Teacher,
  classes: ClassGroup[],
  subjectId: number,
  classIds: number[]
): BidirectionalUpdateResult {
  const conflicts: AssignmentConflict[] = [];

  // Update teacher's classAssignments
  const updatedTeacherAssignments = [...teacher.classAssignments];
  const existingAssignmentIndex = updatedTeacherAssignments.findIndex(
    (a) => a.subjectId === subjectId
  );

  if (existingAssignmentIndex >= 0) {
    // Merge class IDs
    const existingClassIds = new Set(updatedTeacherAssignments[existingAssignmentIndex].classIds);
    for (const classId of classIds) {
      existingClassIds.add(classId);
    }
    updatedTeacherAssignments[existingAssignmentIndex] = {
      ...updatedTeacherAssignments[existingAssignmentIndex],
      classIds: Array.from(existingClassIds),
    };
  } else {
    // Add new assignment
    updatedTeacherAssignments.push({
      subjectId,
      classIds: [...classIds],
    });
  }

  const updatedTeacher: Teacher = {
    ...teacher,
    classAssignments: updatedTeacherAssignments,
  };

  // Update classes' subjectRequirements
  const updatedClasses = classes.map((classGroup) => {
    if (!classIds.includes(classGroup.id)) {
      return classGroup;
    }

    // Ensure subjectRequirements is an array
    const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
    const updatedRequirements = requirements.map((req) => {
      if (req.subjectId !== subjectId) {
        return req;
      }
      return {
        ...req,
        teacherId: teacher.id,
      };
    });

    return {
      ...classGroup,
      subjectRequirements: updatedRequirements,
    };
  });

  return {
    updatedTeacher,
    updatedClasses,
    conflicts,
    success: conflicts.length === 0,
  };
}

/**
 * Remove a teacher assignment and update both teacher and class data
 *
 * @param teacher - Teacher to update
 * @param classes - Classes to update
 * @param subjectId - Subject being unassigned
 * @param classIds - Classes to unassign from
 * @returns Updated teacher and classes
 */
export function removeBidirectionalAssignment(
  teacher: Teacher,
  classes: ClassGroup[],
  subjectId: number,
  classIds: number[]
): BidirectionalUpdateResult {
  const classIdSet = new Set(classIds);

  // Update teacher's classAssignments
  const updatedTeacherAssignments = teacher.classAssignments
    .map((assignment) => {
      if (assignment.subjectId !== subjectId) {
        return assignment;
      }
      return {
        ...assignment,
        classIds: assignment.classIds.filter((id) => !classIdSet.has(id)),
      };
    })
    .filter((assignment) => assignment.classIds.length > 0);

  const updatedTeacher: Teacher = {
    ...teacher,
    classAssignments: updatedTeacherAssignments,
  };

  // Update classes' subjectRequirements
  const updatedClasses = classes.map((classGroup) => {
    if (!classIds.includes(classGroup.id)) {
      return classGroup;
    }

    // Ensure subjectRequirements is an array
    const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);
    const updatedRequirements = requirements.map((req) => {
      if (req.subjectId !== subjectId || req.teacherId !== teacher.id) {
        return req;
      }
      return {
        ...req,
        teacherId: null,
      };
    });

    return {
      ...classGroup,
      subjectRequirements: updatedRequirements,
    };
  });

  return {
    updatedTeacher,
    updatedClasses,
    conflicts: [],
    success: true,
  };
}
