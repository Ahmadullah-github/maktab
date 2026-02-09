/**
 * Workload Calculation Service
 * Calculates and manages teacher workload based on assignments
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { ClassAssignment, Teacher } from '../../teachers/types';
import type { TeacherWorkload, WorkloadBreakdown, WorkloadStatus } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Ensures a value is an array, parsing JSON string if needed.
 */
function ensureArray<T>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normalizes class assignments to ensure classIds is always an array
 */
function normalizeAssignments(
  assignments: ClassAssignment[] | string | null | undefined
): ClassAssignment[] {
  const arr = ensureArray(assignments as ClassAssignment[] | string);
  return arr.map((a) => ({
    ...a,
    classIds: ensureArray(a.classIds as number[] | string),
  }));
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Threshold for "near capacity" warning (periods remaining)
 * Requirements: 2.3
 */
export const NEAR_CAPACITY_THRESHOLD = 5;

/**
 * Optimal utilization range (percentage)
 */
export const OPTIMAL_UTILIZATION_MIN = 50;
export const OPTIMAL_UTILIZATION_MAX = 85;

// ============================================================================
// Workload Calculation Functions
// ============================================================================

/**
 * Calculate complete workload information for a teacher
 *
 * Requirements: 2.1, 2.2, 2.5
 *
 * @param teacher - The teacher to calculate workload for
 * @param subjects - All subjects (for name lookup and default periods)
 * @param classes - All classes (for periods lookup)
 * @param schoolTotalPeriods - Optional: total periods per week in school (for available slots calculation)
 * @returns Complete workload information
 */
export function calculateTeacherWorkload(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[],
  schoolTotalPeriods?: number
): TeacherWorkload {
  const breakdown = calculateWorkloadBreakdown(teacher, subjects, classes);
  const totalPeriods = breakdown.reduce((sum, b) => sum + b.totalPeriods, 0);

  // Calculate available slots (total school periods minus unavailable slots)
  const unavailableCount = ensureArray(teacher.unavailable).length;
  const availableSlots = schoolTotalPeriods
    ? Math.max(0, schoolTotalPeriods - unavailableCount)
    : undefined;

  // Effective max is the minimum of contracted max and available slots
  const contractedMax = teacher.maxPeriodsPerWeek;
  const effectiveMax =
    availableSlots !== undefined ? Math.min(contractedMax, availableSlots) : contractedMax;

  const utilizationPercentage = effectiveMax > 0 ? (totalPeriods / effectiveMax) * 100 : 0;
  const remainingCapacity = effectiveMax - totalPeriods;
  const status = determineWorkloadStatus(totalPeriods, effectiveMax);

  return {
    teacherId: teacher.id,
    totalPeriods,
    maxPeriods: effectiveMax,
    contractedMaxPeriods: contractedMax,
    availableSlots,
    utilizationPercentage,
    breakdown,
    status,
    remainingCapacity,
  };
}

/**
 * Calculate workload breakdown by subject
 *
 * Requirements: 2.5
 *
 * @param teacher - The teacher
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Breakdown of workload by subject
 */
export function calculateWorkloadBreakdown(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): WorkloadBreakdown[] {
  const breakdown: WorkloadBreakdown[] = [];
  const assignments = normalizeAssignments(teacher.classAssignments);

  for (const assignment of assignments) {
    const subject = subjects.find((s) => s.id === assignment.subjectId);
    const subjectName = subject?.name || `Subject ${assignment.subjectId}`;

    let totalPeriods = 0;
    let periodsPerWeek = subject?.periodsPerWeek || 0;

    // Calculate total periods from class requirements
    for (const classId of assignment.classIds) {
      const classGroup = classes.find((c) => c.id === classId);
      const requirements = ensureArray(classGroup?.subjectRequirements as any) as Array<{
        subjectId: number;
        periodsPerWeek?: number;
      }>;
      const requirement = requirements.find((r) => r.subjectId === assignment.subjectId);

      // Use class-specific periods if available, otherwise use subject default
      const periods = requirement?.periodsPerWeek || periodsPerWeek || 1;
      totalPeriods += periods;

      // Update periodsPerWeek to the most common value
      if (requirement?.periodsPerWeek) {
        periodsPerWeek = requirement.periodsPerWeek;
      }
    }

    breakdown.push({
      subjectId: assignment.subjectId,
      subjectName,
      classIds: assignment.classIds,
      periodsPerWeek,
      totalPeriods,
    });
  }

  return breakdown;
}

/**
 * Determine workload status based on current and max periods
 *
 * Requirements: 2.3, 2.4
 *
 * @param totalPeriods - Current total periods
 * @param maxPeriods - Maximum allowed periods
 * @returns Workload status
 */
export function determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) {
    return 'underloaded';
  }

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  // Overloaded: exceeds maximum
  if (totalPeriods > maxPeriods) {
    return 'overloaded';
  }

  // Near capacity: within threshold of maximum
  if (remainingCapacity <= NEAR_CAPACITY_THRESHOLD) {
    return 'near_capacity';
  }

  // Optimal: within good utilization range
  if (utilizationPercentage >= OPTIMAL_UTILIZATION_MIN) {
    return 'optimal';
  }

  // Underloaded: below optimal utilization
  return 'underloaded';
}

/**
 * Check if a teacher can accept additional periods
 *
 * @param teacher - The teacher
 * @param additionalPeriods - Number of periods to add
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns true if teacher can accept the additional periods
 */
export function canAcceptAdditionalPeriods(
  teacher: Teacher,
  additionalPeriods: number,
  subjects: Subject[],
  classes: ClassGroup[]
): boolean {
  const workload = calculateTeacherWorkload(teacher, subjects, classes);
  return workload.remainingCapacity >= additionalPeriods;
}

/**
 * Calculate how many additional periods a teacher can accept
 *
 * @param teacher - The teacher
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns Number of additional periods available
 */
export function getAvailableCapacity(
  teacher: Teacher,
  subjects: Subject[],
  classes: ClassGroup[]
): number {
  const workload = calculateTeacherWorkload(teacher, subjects, classes);
  return Math.max(0, workload.remainingCapacity);
}

/**
 * Calculate workload impact of adding an assignment
 *
 * @param teacher - The teacher
 * @param subjectId - Subject to assign
 * @param classIds - Classes to assign
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns New workload after assignment
 */
export function calculateWorkloadWithAssignment(
  teacher: Teacher,
  subjectId: number,
  classIds: number[],
  subjects: Subject[],
  classes: ClassGroup[]
): TeacherWorkload {
  // Create a temporary teacher with the new assignment
  const existingAssignments = normalizeAssignments(teacher.classAssignments);
  const tempTeacher: Teacher = {
    ...teacher,
    classAssignments: [...existingAssignments, { subjectId, classIds }],
  };

  return calculateTeacherWorkload(tempTeacher, subjects, classes);
}

/**
 * Calculate workload impact of removing an assignment
 *
 * @param teacher - The teacher
 * @param subjectId - Subject to remove
 * @param classIds - Classes to remove (or all if empty)
 * @param subjects - All subjects
 * @param classes - All classes
 * @returns New workload after removal
 */
export function calculateWorkloadWithoutAssignment(
  teacher: Teacher,
  subjectId: number,
  classIds: number[],
  subjects: Subject[],
  classes: ClassGroup[]
): TeacherWorkload {
  // Create a temporary teacher without the assignment
  const existingAssignments = normalizeAssignments(teacher.classAssignments);
  const tempTeacher: Teacher = {
    ...teacher,
    classAssignments: existingAssignments
      .map((a) => {
        if (a.subjectId !== subjectId) {
          return a;
        }

        // Remove specified classes or all if classIds is empty
        const remainingClassIds =
          classIds.length === 0 ? [] : a.classIds.filter((id) => !classIds.includes(id));

        if (remainingClassIds.length === 0) {
          return null; // Remove entire assignment
        }

        return { ...a, classIds: remainingClassIds };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null),
  };

  return calculateTeacherWorkload(tempTeacher, subjects, classes);
}

// ============================================================================
// Workload Display Helpers
// ============================================================================

/**
 * Get color class for workload status (Tailwind CSS)
 *
 * Requirements: 2.6
 *
 * @param status - Workload status
 * @returns Tailwind color class
 */
export function getWorkloadStatusColor(status: WorkloadStatus): string {
  switch (status) {
    case 'overloaded':
      return 'text-red-600';
    case 'near_capacity':
      return 'text-amber-600';
    case 'optimal':
      return 'text-green-600';
    case 'underloaded':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get background color class for workload status (Tailwind CSS)
 *
 * @param status - Workload status
 * @returns Tailwind background color class
 */
export function getWorkloadStatusBgColor(status: WorkloadStatus): string {
  switch (status) {
    case 'overloaded':
      return 'bg-red-100';
    case 'near_capacity':
      return 'bg-amber-100';
    case 'optimal':
      return 'bg-green-100';
    case 'underloaded':
      return 'bg-blue-100';
    default:
      return 'bg-gray-100';
  }
}

/**
 * Get progress bar color class for workload utilization (Tailwind CSS)
 *
 * @param utilizationPercentage - Utilization percentage (0-100+)
 * @returns Tailwind background color class for progress bar
 */
export function getWorkloadProgressColor(utilizationPercentage: number): string {
  if (utilizationPercentage > 100) {
    return 'bg-red-500';
  }
  if (utilizationPercentage > 85) {
    return 'bg-amber-500';
  }
  if (utilizationPercentage >= 50) {
    return 'bg-green-500';
  }
  return 'bg-blue-500';
}

/**
 * Get Farsi label for workload status
 *
 * @param status - Workload status
 * @returns Farsi label
 */
export function getWorkloadStatusLabelFa(status: WorkloadStatus): string {
  switch (status) {
    case 'overloaded':
      return 'بیش از حد';
    case 'near_capacity':
      return 'نزدیک به حداکثر';
    case 'optimal':
      return 'بهینه';
    case 'underloaded':
      return 'کم‌بار';
    default:
      return 'نامشخص';
  }
}

/**
 * Get English label for workload status
 *
 * @param status - Workload status
 * @returns English label
 */
export function getWorkloadStatusLabelEn(status: WorkloadStatus): string {
  switch (status) {
    case 'overloaded':
      return 'Overloaded';
    case 'near_capacity':
      return 'Near Capacity';
    case 'optimal':
      return 'Optimal';
    case 'underloaded':
      return 'Underloaded';
    default:
      return 'Unknown';
  }
}

/**
 * Format workload as a display string
 *
 * @param workload - Teacher workload
 * @returns Formatted string (e.g., "25/30 periods")
 */
export function formatWorkloadDisplay(workload: TeacherWorkload): string {
  return `${workload.totalPeriods}/${workload.maxPeriods}`;
}

/**
 * Format utilization percentage
 *
 * @param utilizationPercentage - Utilization percentage
 * @returns Formatted string (e.g., "83%")
 */
export function formatUtilization(utilizationPercentage: number): string {
  return `${Math.round(utilizationPercentage)}%`;
}

// ============================================================================
// Multi-Teacher Assignment Support
// ============================================================================

/**
 * TeacherClassSubjectAssignment type for workload calculation
 * Matches the type from teacher-assignments feature
 */
interface TeacherAssignmentRecord {
  teacherId: number;
  classId: number;
  subjectId: number;
  periodsPerWeek: number;
}

/**
 * Calculate teacher workload from TeacherClassSubjectAssignment records
 *
 * This is an alternative to calculateTeacherWorkload that uses the new
 * multi-teacher assignment entity instead of teacher.classAssignments.
 *
 * @param teacherId - The teacher ID to calculate workload for
 * @param assignments - All TeacherClassSubjectAssignment records
 * @param maxPeriodsPerWeek - Teacher's maximum periods per week
 * @param subjects - All subjects (for name lookup)
 * @returns Complete workload information
 */
export function calculateWorkloadFromAssignments(
  teacherId: number,
  assignments: TeacherAssignmentRecord[],
  maxPeriodsPerWeek: number,
  subjects: Subject[]
): TeacherWorkload {
  // Filter assignments for this teacher
  const teacherAssignments = assignments.filter((a) => a.teacherId === teacherId);

  // Group by subject for breakdown
  const bySubject = new Map<number, { classIds: number[]; totalPeriods: number }>();

  for (const assignment of teacherAssignments) {
    const existing = bySubject.get(assignment.subjectId) || { classIds: [], totalPeriods: 0 };
    existing.classIds.push(assignment.classId);
    existing.totalPeriods += assignment.periodsPerWeek;
    bySubject.set(assignment.subjectId, existing);
  }

  // Build breakdown
  const breakdown: WorkloadBreakdown[] = [];
  for (const [subjectId, data] of bySubject) {
    const subject = subjects.find((s) => s.id === subjectId);
    breakdown.push({
      subjectId,
      subjectName: subject?.name || `Subject ${subjectId}`,
      classIds: data.classIds,
      periodsPerWeek: subject?.periodsPerWeek || 0,
      totalPeriods: data.totalPeriods,
    });
  }

  const totalPeriods = breakdown.reduce((sum, b) => sum + b.totalPeriods, 0);
  const utilizationPercentage =
    maxPeriodsPerWeek > 0 ? (totalPeriods / maxPeriodsPerWeek) * 100 : 0;
  const remainingCapacity = maxPeriodsPerWeek - totalPeriods;
  const status = determineWorkloadStatus(totalPeriods, maxPeriodsPerWeek);

  return {
    teacherId,
    totalPeriods,
    maxPeriods: maxPeriodsPerWeek,
    contractedMaxPeriods: maxPeriodsPerWeek,
    availableSlots: undefined,
    utilizationPercentage,
    breakdown,
    status,
    remainingCapacity,
  };
}
