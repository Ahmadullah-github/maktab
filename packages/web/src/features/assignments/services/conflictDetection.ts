/**
 * Conflict Detection Service
 * Detects and reports assignment conflicts across teachers, subjects, and classes
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import type { ClassGroup, SubjectRequirement } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import type {
  AssignmentConflict,
  EnhancedClassAssignment,
  EnhancedSubjectRequirement,
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
// Conflict Detection Functions
// ============================================================================

/**
 * Detect all conflicts for a teacher's assignments
 *
 * Requirements: 6.1, 6.2
 *
 * @param teacher - The teacher to check
 * @param subjects - All subjects (for periods lookup)
 * @param classes - All classes (for requirement lookup)
 * @returns Array of detected conflicts
 */
export function detectTeacherConflicts(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  // 1. Check workload conflicts
  const workloadConflict = detectWorkloadConflict(teacher, subjects, classes);
  if (workloadConflict) {
    conflicts.push(workloadConflict);
  }

  // 2. Check subject compatibility conflicts
  const compatibilityConflicts = detectCompatibilityConflicts(teacher, subjects);
  conflicts.push(...compatibilityConflicts);

  // 3. Check availability conflicts (if we have period data)
  // This would require schedule data which we don't have at assignment time

  return conflicts;
}

/**
 * Detect workload conflict for a teacher
 *
 * Requirements: 6.2
 *
 * @param teacher - The teacher to check
 * @param subjects - All subjects (for periods lookup)
 * @param classes - All classes (for requirement lookup)
 * @returns Workload conflict if detected, null otherwise
 */
export function detectWorkloadConflict(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): AssignmentConflict | null {
  const totalPeriods = calculateTotalAssignedPeriods(teacher, subjects, classes);

  if (totalPeriods > teacher.maxPeriodsPerWeek) {
    return {
      type: 'workload_exceeded',
      severity: 'error',
      message: `Teacher "${teacher.fullName}" is overloaded: ${totalPeriods}/${teacher.maxPeriodsPerWeek} periods`,
      messageFa: `معلم "${teacher.fullName}" بیش از حد بارگذاری شده: ${totalPeriods}/${teacher.maxPeriodsPerWeek} ساعت`,
      affectedEntities: {
        teacherId: teacher.id,
      },
      suggestedResolution: `Remove ${totalPeriods - teacher.maxPeriodsPerWeek} periods of assignments`,
      suggestedResolutionFa: `${totalPeriods - teacher.maxPeriodsPerWeek} ساعت از تخصیص‌ها را حذف کنید`,
    };
  }

  return null;
}

/**
 * Detect subject compatibility conflicts for a teacher
 *
 * Requirements: 5.6
 *
 * NOTE: Since primary/allowed subjects are solver preferences (not hard restrictions),
 * this function no longer creates conflicts for teacher-subject assignments.
 * If an admin assigns a teacher to a subject, that's valid.
 *
 * @param _teacher - The teacher to check (unused - kept for API compatibility)
 * @param _subjects - All subjects (unused - kept for API compatibility)
 * @returns Array of compatibility conflicts (empty - no longer validates subject compatibility)
 */
export function detectCompatibilityConflicts(
  _teacher: Teacher,
  _subjects: Subject[]
): AssignmentConflict[] {
  // No longer create conflicts for teacher-subject compatibility
  // Primary/allowed subjects are solver preferences, not hard restrictions
  // The assignment table is the source of truth
  return [];
}

/**
 * Detect coverage conflicts for a subject across all classes
 *
 * Requirements: 6.4
 *
 * @param subject - The subject to check
 * @param classes - All classes
 * @param teachers - All teachers
 * @returns Coverage conflict if detected, null otherwise
 */
export function detectCoverageConflict(
  subject: Subject,
  classes: ClassGroup[],
  _teachers: Teacher[]
): AssignmentConflict | null {
  // Find classes that require this subject
  const classesRequiringSubject = classes.filter((c) => {
    const reqs = parseJsonArray<SubjectRequirement>(c.subjectRequirements);
    return reqs.some((r) => r.subjectId === subject.id);
  });

  if (classesRequiringSubject.length === 0) {
    return null;
  }

  // Count unassigned classes
  const unassignedClasses = classesRequiringSubject.filter((c) => {
    const reqs = parseJsonArray<SubjectRequirement>(c.subjectRequirements);
    const req = reqs.find((r) => r.subjectId === subject.id);
    return !req?.teacherId;
  });

  if (unassignedClasses.length > 0) {
    return {
      type: 'coverage_insufficient',
      severity: 'warning',
      message: `Subject "${subject.name}" has ${unassignedClasses.length} classes without assigned teachers`,
      messageFa: `مضمون "${subject.name}" دارای ${unassignedClasses.length} صنف بدون معلم تخصیص یافته است`,
      affectedEntities: {
        subjectId: subject.id,
      },
      suggestedResolution: `Assign teachers to the remaining classes`,
      suggestedResolutionFa: `معلم‌ها را به صنف‌های باقیمانده تخصیص دهید`,
    };
  }

  return null;
}

/**
 * Detect all conflicts across the entire system
 *
 * Requirements: 6.1
 *
 * @param teachers - All teachers
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Array of all detected conflicts
 */
export function detectAllConflicts(
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  // 1. Check all teacher conflicts
  for (const teacher of teachers) {
    const teacherConflicts = detectTeacherConflicts(teacher, subjects, classes);
    conflicts.push(...teacherConflicts);
  }

  // 2. Check all subject coverage conflicts
  for (const subject of subjects) {
    const coverageConflict = detectCoverageConflict(subject, classes, teachers);
    if (coverageConflict) {
      conflicts.push(coverageConflict);
    }
  }

  // 3. Check for duplicate assignments (same subject-class assigned to multiple teachers)
  const duplicateConflicts = detectDuplicateAssignments(teachers, subjects, classes);
  conflicts.push(...duplicateConflicts);

  return conflicts;
}

/**
 * Detect duplicate assignments (same subject-class assigned to multiple teachers)
 *
 * @param teachers - All teachers
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Array of duplicate assignment conflicts
 */
function detectDuplicateAssignments(
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];

  // Build a map of subject-class to teachers
  const assignmentMap = new Map<string, number[]>();

  for (const teacher of teachers) {
    // Ensure classAssignments is an array before iterating
    const teacherAssignments = Array.isArray(teacher.classAssignments)
      ? teacher.classAssignments
      : [];
    for (const assignment of teacherAssignments) {
      // Ensure classIds is an array before iterating
      const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
      for (const classId of assignmentClassIds) {
        const key = `${assignment.subjectId}-${classId}`;
        const existing = assignmentMap.get(key) || [];
        existing.push(teacher.id);
        assignmentMap.set(key, existing);
      }
    }
  }

  // Find duplicates
  for (const [key, teacherIds] of assignmentMap.entries()) {
    if (teacherIds.length > 1) {
      const [subjectId, classId] = key.split('-').map(Number);
      const subject = subjects.find((s) => s.id === subjectId);
      const classGroup = classes.find((c) => c.id === classId);
      const teacherNames = teacherIds
        .map((id) => teachers.find((t) => t.id === id)?.fullName || `Teacher ${id}`)
        .join(', ');

      conflicts.push({
        type: 'duplicate_assignment',
        severity: 'error',
        message: `Subject "${subject?.name}" in class "${classGroup?.displayName || classGroup?.name}" is assigned to multiple teachers: ${teacherNames}`,
        messageFa: `مضمون "${subject?.name}" در صنف "${classGroup?.displayName || classGroup?.name}" به چند معلم تخصیص یافته: ${teacherNames}`,
        affectedEntities: {
          subjectId,
          classId,
        },
        suggestedResolution: `Remove duplicate assignments, keeping only one teacher`,
        suggestedResolutionFa: `تخصیص‌های تکراری را حذف کنید و فقط یک معلم نگه دارید`,
      });
    }
  }

  return conflicts;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate total assigned periods for a teacher
 *
 * @param teacher - The teacher
 * @param subjects - All subjects (for periods lookup)
 * @param classes - All classes (for requirement lookup)
 * @returns Total periods assigned
 */
export function calculateTotalAssignedPeriods(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): number {
  let totalPeriods = 0;

  // Ensure classAssignments is an array before iterating
  const teacherAssignments = Array.isArray(teacher.classAssignments)
    ? teacher.classAssignments
    : [];
  for (const assignment of teacherAssignments) {
    // Try to get periods from subject definition
    const subject = subjects.find((s) => s.id === assignment.subjectId);

    // Ensure classIds is an array before iterating
    const assignmentClassIds = Array.isArray(assignment.classIds) ? assignment.classIds : [];
    for (const classId of assignmentClassIds) {
      // Try to get periods from class requirement first
      const classGroup = classes.find((c) => c.id === classId);
      const classReqs = classGroup
        ? parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements)
        : [];
      const requirement = classReqs.find((r) => r.subjectId === assignment.subjectId);

      if (requirement?.periodsPerWeek) {
        totalPeriods += requirement.periodsPerWeek;
      } else if (subject?.periodsPerWeek) {
        totalPeriods += subject.periodsPerWeek;
      } else {
        // Default to 1 period if no data available
        totalPeriods += 1;
      }
    }
  }

  return totalPeriods;
}

/**
 * Enhance class assignments with conflict information
 *
 * @param assignments - Base class assignments
 * @param _teacher - The teacher (unused - kept for API compatibility)
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Enhanced assignments with conflicts
 */
export function enhanceClassAssignments(
  assignments: Teacher['classAssignments'],
  _teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): EnhancedClassAssignment[] {
  return assignments.map((assignment) => {
    const subject = subjects.find((s) => s.id === assignment.subjectId);
    const conflicts: AssignmentConflict[] = [];

    // NOTE: No longer check compatibility - primary/allowed are solver preferences
    // The assignment table is the source of truth

    // Calculate periods
    const periodsPerWeek = subject?.periodsPerWeek || 0;
    let totalPeriods = 0;

    for (const classId of assignment.classIds) {
      const classGroup = classes.find((c) => c.id === classId);
      const classReqs = classGroup
        ? parseJsonArray<SubjectRequirement>(classGroup.subjectRequirements)
        : [];
      const requirement = classReqs.find((r) => r.subjectId === assignment.subjectId);
      const periods = requirement?.periodsPerWeek || periodsPerWeek || 1;
      totalPeriods += periods;
    }

    // Determine status
    let status: EnhancedClassAssignment['status'] = 'assigned';
    if (conflicts.some((c) => c.severity === 'error')) {
      status = 'conflict';
    } else if (assignment.classIds.length === 0) {
      status = 'unassigned';
    }

    return {
      subjectId: assignment.subjectId,
      classIds: assignment.classIds,
      periodsPerWeek,
      totalPeriods,
      conflicts,
      status,
    };
  });
}

/**
 * Enhance subject requirements with assignment status
 *
 * @param requirements - Base subject requirements
 * @param classGroup - The class
 * @param teachers - All teachers
 * @param _subjects - All subjects (unused - kept for API compatibility)
 * @returns Enhanced requirements with status
 */
export function enhanceSubjectRequirements(
  requirements: ClassGroup['subjectRequirements'],
  classGroup: ClassGroup,
  teachers: Teacher[],
  _subjects: Subject[]
): EnhancedSubjectRequirement[] {
  return requirements.map((requirement) => {
    const conflicts: AssignmentConflict[] = [];
    let assignmentStatus: EnhancedSubjectRequirement['assignmentStatus'] = 'unassigned';

    if (requirement.teacherId) {
      const teacher = teachers.find((t) => t.id === requirement.teacherId);

      if (teacher) {
        // Teacher exists and is assigned - that's valid
        // Primary/allowed subjects are solver preferences, not hard restrictions
        assignmentStatus = 'assigned';
      } else {
        // Teacher not found - this is a real error
        conflicts.push({
          type: 'subject_incompatible',
          severity: 'error',
          message: `Assigned teacher (ID: ${requirement.teacherId}) not found`,
          messageFa: `معلم تخصیص یافته (شناسه: ${requirement.teacherId}) یافت نشد`,
          affectedEntities: {
            teacherId: requirement.teacherId,
            subjectId: requirement.subjectId,
            classId: classGroup.id,
          },
        });
        assignmentStatus = 'conflict';
      }
    }

    return {
      subjectId: requirement.subjectId,
      periodsPerWeek: requirement.periodsPerWeek,
      teacherId: requirement.teacherId || null,
      assignmentStatus,
      conflicts,
    };
  });
}
