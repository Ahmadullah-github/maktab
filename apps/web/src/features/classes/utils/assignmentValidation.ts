/**
 * Class Assignment Validation Utilities
 *
 * Provides validation functions for teacher-subject assignments within classes.
 * Handles teacher selection validation, conflict detection, and status calculation.
 *
 * Requirements: 3.3, 3.4, 3.6
 */

import {
  calculateTeacherWorkload,
  determineWorkloadStatus,
} from '@/features/assignments/services/workloadCalculation';
import type {
  AssignmentConflict,
  AssignmentStatus,
  AssignmentValidationResult,
} from '@/features/assignments/types';
import type { Subject } from '@/features/subjects/types';
import type { Teacher } from '@/features/teachers/types';
import type { ClassGroup, SubjectRequirement } from '../types';

// ============================================================================
// Teacher Selection Validation
// ============================================================================

/**
 * Validate teacher selection for a subject requirement
 * Requirements: 3.3
 *
 * @param teacherId - The teacher ID to validate
 * @param subjectId - The subject ID
 * @param teacher - The teacher object
 * @param subject - The subject object
 * @param allClasses - All classes for workload calculation
 * @returns Validation result with conflicts and warnings
 */
export function validateTeacherSelection(
  teacherId: number,
  _subjectId: number,
  teacher: Teacher | undefined,
  _subject: Subject | undefined,
  allClasses: ClassGroup[],
  allSubjects: Subject[]
): AssignmentValidationResult {
  const conflicts: AssignmentConflict[] = [];
  const warnings: AssignmentConflict[] = [];

  // Teacher not found
  if (!teacher) {
    conflicts.push({
      type: 'subject_incompatible',
      severity: 'error',
      message: `Teacher with ID ${teacherId} not found`,
      messageFa: `معلم با شناسه ${teacherId} یافت نشد`,
      affectedEntities: { teacherId },
    });
    return { isValid: false, conflicts, warnings };
  }

  // NOTE: No longer check teacher-subject compatibility as a conflict
  // Primary/allowed subjects are solver optimization preferences, not hard restrictions
  // The assignment table is the source of truth - if admin assigns teacher to subject, it's valid

  // Check workload
  const workload = calculateTeacherWorkload(teacher, allSubjects, allClasses);
  const workloadStatus = determineWorkloadStatus(workload.totalPeriods, workload.maxPeriods);

  if (workloadStatus === 'overloaded') {
    conflicts.push({
      type: 'workload_exceeded',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" is overloaded (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: { teacherId: teacher.id },
      suggestedResolution: `Reduce teacher's assignments or select a different teacher`,
      suggestedResolutionFa: `تخصیص‌های معلم را کاهش دهید یا معلم دیگری انتخاب کنید`,
    });
  } else if (workloadStatus === 'near_capacity') {
    warnings.push({
      type: 'workload_exceeded',
      severity: 'warning',
      message: `Teacher "${teacher.fullName}" is near capacity (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" نزدیک به حداکثر ظرفیت است (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: { teacherId: teacher.id },
    });
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
  };
}

// ============================================================================
// Conflict Detection for Class Assignments
// ============================================================================

/**
 * Detect all conflicts for a class's subject requirements
 * Requirements: 3.4
 *
 * @param classGroup - The class to check
 * @param teachers - All teachers
 * @param subjects - All subjects
 * @param allClasses - All classes for workload calculation
 * @returns Array of detected conflicts
 */
export function detectClassAssignmentConflicts(
  classGroup: ClassGroup,
  teachers: Teacher[],
  subjects: Subject[],
  allClasses: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  for (const requirement of classGroup.subjectRequirements) {
    if (!requirement.teacherId) continue;

    const teacher = teachers.find((t) => t.id === requirement.teacherId);
    const subject = subjects.find((s) => s.id === requirement.subjectId);

    // Teacher not found
    if (!teacher) {
      conflicts.push({
        type: 'subject_incompatible',
        severity: 'error',
        message: `Assigned teacher (ID: ${requirement.teacherId}) not found for "${subject?.name || 'subject'}"`,
        messageFa: `معلم تخصیص یافته (شناسه: ${requirement.teacherId}) برای "${subject?.name || 'مضمون'}" یافت نشد`,
        affectedEntities: {
          teacherId: requirement.teacherId,
          subjectId: requirement.subjectId,
          classId: classGroup.id,
        },
      });
      continue;
    }

    // NOTE: No longer check compatibility as a conflict
    // Primary/allowed subjects are solver preferences, not hard restrictions

    // Check workload
    const workload = calculateTeacherWorkload(teacher, subjects, allClasses);
    if (workload.totalPeriods > workload.maxPeriods) {
      conflicts.push({
        type: 'workload_exceeded',
        severity: 'error',
        message: `Teacher "${teacher.fullName}" is overloaded (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
        messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
        affectedEntities: {
          teacherId: teacher.id,
          classId: classGroup.id,
        },
      });
    }
  }

  return conflicts;
}

/**
 * Detect conflicts for a single subject requirement
 * Requirements: 3.4
 *
 * @param requirement - The subject requirement to check
 * @param classGroup - The class containing the requirement
 * @param teachers - All teachers
 * @param subjects - All subjects
 * @param allClasses - All classes for workload calculation
 * @returns Array of detected conflicts
 */
export function detectRequirementConflicts(
  requirement: SubjectRequirement,
  classGroup: ClassGroup,
  teachers: Teacher[],
  subjects: Subject[],
  allClasses: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  if (!requirement.teacherId) return conflicts;

  const teacher = teachers.find((t) => t.id === requirement.teacherId);

  if (!teacher) {
    conflicts.push({
      type: 'subject_incompatible',
      severity: 'error',
      message: `Assigned teacher not found`,
      messageFa: `معلم تخصیص یافته یافت نشد`,
      affectedEntities: {
        teacherId: requirement.teacherId,
        subjectId: requirement.subjectId,
        classId: classGroup.id,
      },
    });
    return conflicts;
  }

  // NOTE: No longer check teacher-subject compatibility as a conflict
  // Primary/allowed subjects are solver optimization preferences, not hard restrictions
  // The assignment table is the source of truth - if admin assigns teacher to subject, it's valid

  // Check workload
  const workload = calculateTeacherWorkload(teacher, subjects, allClasses);
  const workloadStatus = determineWorkloadStatus(workload.totalPeriods, workload.maxPeriods);

  if (workloadStatus === 'overloaded') {
    conflicts.push({
      type: 'workload_exceeded',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" is overloaded (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
        classId: classGroup.id,
      },
    });
  } else if (workloadStatus === 'near_capacity') {
    conflicts.push({
      type: 'workload_exceeded',
      severity: 'warning',
      message: `Teacher "${teacher.fullName}" is near capacity (${workload.totalPeriods}/${workload.maxPeriods} periods)`,
      messageFa: `معلم "${teacher.fullName}" نزدیک به حداکثر ظرفیت است (${workload.totalPeriods}/${workload.maxPeriods} ساعت)`,
      affectedEntities: {
        teacherId: teacher.id,
        classId: classGroup.id,
      },
    });
  }

  return conflicts;
}

// ============================================================================
// Assignment Status Calculation
// ============================================================================

/**
 * Calculate assignment status for a subject requirement
 * Requirements: 3.6
 *
 * NOTE: No longer checks teacher-subject compatibility as a conflict.
 * Primary/allowed subjects are solver optimization preferences, not hard restrictions.
 * The assignment table is the source of truth - if admin assigns teacher to subject, it's valid.
 *
 * @param requirement - The subject requirement
 * @param teacher - The assigned teacher (if any)
 * @returns Assignment status
 */
export function calculateRequirementStatus(
  requirement: SubjectRequirement,
  teacher: Teacher | undefined
): AssignmentStatus {
  // No teacher assigned
  if (!requirement.teacherId) {
    return 'unassigned';
  }

  // Teacher not found
  if (!teacher) {
    return 'conflict';
  }

  // Teacher is assigned and exists - valid assignment
  return 'assigned';
}

/**
 * Calculate overall assignment status for a class
 * Requirements: 3.6
 *
 * @param classGroup - The class to check
 * @param teachers - All teachers
 * @returns Overall assignment status
 */
export function calculateClassAssignmentStatus(
  classGroup: ClassGroup,
  teachers: Teacher[]
): AssignmentStatus {
  if (classGroup.subjectRequirements.length === 0) {
    return 'unassigned';
  }

  let hasAssigned = false;
  let hasUnassigned = false;
  let hasConflict = false;

  for (const requirement of classGroup.subjectRequirements) {
    const teacher = teachers.find((t) => t.id === requirement.teacherId);
    const status = calculateRequirementStatus(requirement, teacher);

    if (status === 'assigned') hasAssigned = true;
    if (status === 'unassigned') hasUnassigned = true;
    if (status === 'conflict') hasConflict = true;
  }

  // Any conflict means overall conflict
  if (hasConflict) return 'conflict';

  // Mix of assigned and unassigned means partial
  if (hasAssigned && hasUnassigned) return 'partial';

  // All assigned
  if (hasAssigned && !hasUnassigned) return 'assigned';

  // All unassigned
  return 'unassigned';
}

/**
 * Get assignment statistics for a class
 *
 * @param classGroup - The class to analyze
 * @param teachers - All teachers
 * @returns Statistics about assignments
 */
export function getClassAssignmentStats(
  classGroup: ClassGroup,
  teachers: Teacher[]
): {
  total: number;
  assigned: number;
  unassigned: number;
  conflicts: number;
  percentage: number;
} {
  const total = classGroup.subjectRequirements.length;
  let assigned = 0;
  let unassigned = 0;
  let conflicts = 0;

  for (const requirement of classGroup.subjectRequirements) {
    const teacher = teachers.find((t) => t.id === requirement.teacherId);
    const status = calculateRequirementStatus(requirement, teacher);

    if (status === 'assigned') assigned++;
    else if (status === 'unassigned') unassigned++;
    else if (status === 'conflict') conflicts++;
  }

  const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;

  return { total, assigned, unassigned, conflicts, percentage };
}
