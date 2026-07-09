/**
 * Assignment Validation Service
 * Validates teacher-subject-class assignments against business rules
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  AssignmentValidationRequest,
  AssignmentValidationResult,
  TeacherCompatibility,
  TeacherCompatibilityLevel,
} from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse JSON array safely
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

// ============================================================================
// Teacher-Subject Compatibility Validation
// ============================================================================

/**
 * Check if a teacher can teach a specific subject
 * Based on primarySubjectIds, allowedSubjectIds
 *
 * NOTE: This returns compatibility LEVEL for UI hints, not hard validation.
 * Primary/allowed subjects are for solver optimization preferences.
 * If an admin assigns a teacher to a subject, that assignment is valid.
 *
 * Requirements: 5.1, 5.2, 5.3
 *
 * @param teacher - The teacher to check
 * @param subjectId - The subject ID to validate
 * @returns The compatibility level (primary > allowed)
 */
export function getTeacherSubjectCompatibility(
  teacher: Teacher,
  subjectId: number
): TeacherCompatibilityLevel {
  // Check if subject is in primary subjects
  if (teacher.primarySubjectIds.includes(subjectId)) {
    return 'primary';
  }

  // Check if subject is in allowed subjects
  if (teacher.allowedSubjectIds.includes(subjectId)) {
    return 'allowed';
  }

  // Check if teacher is a generalist (empty primary AND empty allowed = can teach all)
  const isGeneralist =
    teacher.primarySubjectIds.length === 0 && teacher.allowedSubjectIds.length === 0;
  if (isGeneralist) {
    return 'allowed'; // Generalist can teach anything
  }

  // Not in primary or allowed lists, but still valid if assigned by admin
  // Primary/allowed are solver preferences, not hard restrictions
  return 'allowed';
}

/**
 * Check if a teacher can teach a specific subject (boolean version)
 *
 * @param teacher - The teacher to check
 * @param subjectId - The subject ID to validate
 * @returns true if teacher can teach the subject
 */
export function canTeacherTeachSubject(teacher: Teacher, subjectId: number): boolean {
  const compatibility = getTeacherSubjectCompatibility(teacher, subjectId);
  return compatibility !== 'incompatible';
}

/**
 * Get all compatible teachers for a subject
 *
 * Requirements: 5.5, 4.3
 *
 * @param teachers - List of all teachers
 * @param subjectId - The subject ID to find teachers for
 * @returns List of compatible teachers with their compatibility info
 */
export function getCompatibleTeachersForSubject(
  teachers: Teacher[],
  subjectId: number
): TeacherCompatibility[] {
  return teachers
    .map((teacher) => {
      const compatibility = getTeacherSubjectCompatibility(teacher, subjectId);
      const currentWorkload = calculateTeacherCurrentWorkload(teacher);
      const availableCapacity = teacher.maxPeriodsPerWeek - currentWorkload;

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        subjectId,
        compatibility,
        currentWorkload,
        maxWorkload: teacher.maxPeriodsPerWeek,
        availableCapacity,
        canAcceptAssignment: compatibility !== 'incompatible' && availableCapacity > 0,
      };
    })
    .filter((tc) => tc.compatibility !== 'incompatible');
}

/**
 * Calculate a teacher's current workload from their assignments
 *
 * @param teacher - The teacher to calculate workload for
 * @returns Total periods currently assigned
 */
function calculateTeacherCurrentWorkload(teacher: Teacher): number {
  // Handle undefined, null, or non-array classAssignments
  let assignments = teacher.classAssignments;

  // If it's a JSON string (API didn't deserialize), parse it
  if (typeof assignments === 'string') {
    try {
      assignments = JSON.parse(assignments);
    } catch {
      return 0;
    }
  }

  // Ensure it's an array
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return 0;
  }

  // Note: This is a simplified calculation
  // In practice, we need subject data to get periodsPerWeek
  // For now, we count class assignments
  return assignments.reduce((total, assignment) => {
    // Defensive: ensure assignment has classIds array
    const classIds = Array.isArray(assignment?.classIds) ? assignment.classIds : [];
    return total + classIds.length;
  }, 0);
}

// ============================================================================
// Assignment Validation
// ============================================================================

/**
 * Validate an assignment request
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4
 *
 * @param request - The assignment request to validate
 * @param teacher - The teacher being assigned
 * @param subject - The subject being assigned
 * @param classes - The classes being assigned to
 * @param existingTeachers - All teachers (for conflict detection)
 * @returns Validation result with conflicts and warnings
 */
export function validateAssignment(
  request: AssignmentValidationRequest,
  teacher: Teacher,
  subject: Subject,
  classes: ClassGroup[],
  existingTeachers: Teacher[] = []
): AssignmentValidationResult {
  const conflicts: AssignmentConflict[] = [];
  const warnings: AssignmentConflict[] = [];

  // NOTE: No longer validate teacher-subject compatibility as a conflict
  // Primary/allowed subjects are solver preferences, not hard restrictions
  // The assignment table is the source of truth

  // 1. Validate workload
  const currentWorkload = calculateTeacherCurrentWorkload(teacher);
  const requestedClasses = classes.filter((classGroup) => request.classIds.includes(classGroup.id));
  const additionalPeriods = requestedClasses.reduce((sum, classGroup) => {
    const classReqs = parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements);
    const requirement = classReqs.find((r) => r.subjectId === request.subjectId);
    return sum + (requirement?.periodsPerWeek ?? subject.periodsPerWeek ?? 0);
  }, 0);
  const newTotalWorkload = currentWorkload + additionalPeriods;

  if (newTotalWorkload > teacher.maxPeriodsPerWeek) {
    conflicts.push(createWorkloadExceededConflict(teacher, newTotalWorkload));
  } else if (newTotalWorkload > teacher.maxPeriodsPerWeek - 5) {
    // Near capacity warning (within 5 periods)
    warnings.push(createNearCapacityWarning(teacher, newTotalWorkload));
  }

  // 3. Check for duplicate assignments
  // Ensure classAssignments is an array before calling .find()
  const teacherAssignments = Array.isArray(teacher.classAssignments)
    ? teacher.classAssignments
    : [];
  const existingAssignment = teacherAssignments.find((a) => a.subjectId === request.subjectId);
  if (existingAssignment) {
    // Ensure classIds is an array
    const existingClassIds = Array.isArray(existingAssignment.classIds)
      ? existingAssignment.classIds
      : [];
    const duplicateClasses = request.classIds.filter((classId) =>
      existingClassIds.includes(classId)
    );
    if (duplicateClasses.length > 0) {
      warnings.push(createDuplicateAssignmentWarning(teacher, subject, duplicateClasses));
    }
  }

  // 4. Check if classes already have this subject assigned to another teacher
  for (const classId of request.classIds) {
    const classGroup = classes.find((c) => c.id === classId);
    if (classGroup) {
      const classReqs = parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements);
      const existingReq = classReqs.find(
        (r) => r.subjectId === request.subjectId && r.teacherId && r.teacherId !== teacher.id
      );
      if (existingReq) {
        const existingTeacher = existingTeachers.find((t) => t.id === existingReq.teacherId);
        warnings.push(
          createClassAlreadyAssignedWarning(
            classGroup,
            subject,
            existingTeacher?.fullName || `Teacher ${existingReq.teacherId}`
          )
        );
      }
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    warnings,
  };
}

// ============================================================================
// Conflict Factory Functions
// ============================================================================

/**
 * Create a workload exceeded conflict
 */
function createWorkloadExceededConflict(
  teacher: Teacher,
  newTotalWorkload: number
): AssignmentConflict {
  return {
    type: 'workload_exceeded',
    severity: 'error',
    message: `Assignment would exceed teacher's maximum workload (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} periods)`,
    messageFa: `این تخصیص باعث تجاوز از حداکثر ساعات معلم می‌شود (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} ساعت)`,
    affectedEntities: {
      teacherId: teacher.id,
    },
    suggestedResolution: `Reduce assignments or increase teacher's maximum periods per week`,
    suggestedResolutionFa: `تعداد تخصیص‌ها را کاهش دهید یا حداکثر ساعات هفتگی معلم را افزایش دهید`,
  };
}

/**
 * Create a near capacity warning
 */
function createNearCapacityWarning(teacher: Teacher, newTotalWorkload: number): AssignmentConflict {
  return {
    type: 'workload_exceeded',
    severity: 'warning',
    message: `Teacher is approaching maximum workload (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} periods)`,
    messageFa: `معلم به حداکثر ساعات نزدیک می‌شود (${newTotalWorkload}/${teacher.maxPeriodsPerWeek} ساعت)`,
    affectedEntities: {
      teacherId: teacher.id,
    },
  };
}

/**
 * Create a duplicate assignment warning
 */
function createDuplicateAssignmentWarning(
  teacher: Teacher,
  subject: Subject,
  duplicateClassIds: number[]
): AssignmentConflict {
  return {
    type: 'duplicate_assignment',
    severity: 'warning',
    message: `Teacher "${teacher.fullName}" is already assigned to teach "${subject.name}" in ${duplicateClassIds.length} of these classes`,
    messageFa: `معلم "${teacher.fullName}" قبلاً برای تدریس "${subject.name}" در ${duplicateClassIds.length} صنف از این صنف‌ها تخصیص یافته است`,
    affectedEntities: {
      teacherId: teacher.id,
      subjectId: subject.id,
    },
  };
}

/**
 * Create a class already assigned warning
 * Note: Single-teacher enforcement means the previous teacher will be auto-replaced
 */
function createClassAlreadyAssignedWarning(
  classGroup: ClassGroup,
  subject: Subject,
  existingTeacherName: string
): AssignmentConflict {
  return {
    type: 'duplicate_assignment',
    severity: 'warning',
    message: `"${existingTeacherName}" will be replaced as the teacher for "${subject.name}" in class "${classGroup.displayName || classGroup.name}"`,
    messageFa: `"${existingTeacherName}" به عنوان معلم "${subject.name}" در صنف "${classGroup.displayName || classGroup.name}" جایگزین خواهد شد`,
    affectedEntities: {
      classId: classGroup.id,
      subjectId: subject.id,
    },
    suggestedResolution: `The previous teacher will be automatically unassigned`,
    suggestedResolutionFa: `معلم قبلی به صورت خودکار حذف خواهد شد`,
  };
}
