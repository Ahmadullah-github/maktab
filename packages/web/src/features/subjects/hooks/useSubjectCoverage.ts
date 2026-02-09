/**
 * useSubjectCoverage Hook
 *
 * Provides coverage analysis for subjects with real-time updates.
 * Calculates which classes require a subject and their assignment status.
 *
 * REAL-TIME FIX: Now reads from useTeacherAssignments() (new table) instead of
 * class.subjectRequirements.teacherId (old system) for assignment status.
 * This ensures real-time updates when assignments change from any feature.
 *
 * Requirements: 4.2, 4.5, 4.6
 */

import { useMemo } from 'react';
import type {
  ClassCoverageDetail,
  CoverageStatus,
  SubjectCoverage,
  TeacherCompatibility,
  TeacherCompatibilityLevel,
  TeacherCoverageDetail,
} from '../../assignments/types';
import { useClasses } from '../../classes/hooks/useClasses';
import type { SubjectRequirement } from '../../classes/types';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Subject } from '../types';

/**
 * Class assignment structure
 */
interface ClassAssignment {
  subjectId: number;
  classIds: number[];
}

/**
 * Parse JSON string or return as-is if already an array
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
 * Ensure subjectRequirements is an array (handles both parsed and unparsed data)
 */
function ensureSubjectRequirements(
  requirements: SubjectRequirement[] | string | null | undefined
): SubjectRequirement[] {
  if (Array.isArray(requirements)) return requirements;
  return parseJsonArray<SubjectRequirement>(requirements);
}

/**
 * Teacher interface for coverage calculations (parsed)
 */
interface TeacherForCoverage {
  id: number;
  fullName: string;
  primarySubjectIds: number[];
  allowedSubjectIds: number[];
  restrictToPrimarySubjects: boolean;
  maxPeriodsPerWeek: number;
  classAssignments: ClassAssignment[];
}

/**
 * Calculate teacher compatibility level for a subject
 */
function getTeacherCompatibility(
  teacher: TeacherForCoverage,
  subjectId: number
): TeacherCompatibilityLevel {
  if (teacher.primarySubjectIds.includes(subjectId)) {
    return 'primary';
  }
  if (teacher.allowedSubjectIds.includes(subjectId)) {
    return 'allowed';
  }
  // Check if teacher is a generalist (empty primary AND empty allowed = can teach all)
  const isGeneralist =
    teacher.primarySubjectIds.length === 0 && teacher.allowedSubjectIds.length === 0;
  if (isGeneralist) {
    return 'allowed'; // Generalist can teach anything
  }
  // Not in primary or allowed, but still valid if assigned by admin
  return 'allowed';
}

export interface UseSubjectCoverageOptions {
  /** Whether to include teacher compatibility analysis */
  includeTeacherCompatibility?: boolean;
}

export interface UseSubjectCoverageResult {
  /** Complete coverage information */
  coverage: SubjectCoverage | null;
  /** List of compatible teachers for this subject */
  compatibleTeachers: TeacherCompatibility[];
  /** Classes requiring this subject */
  classesRequiring: ClassCoverageDetail[];
  /** Coverage percentage (0-100) */
  coveragePercentage: number;
  /** Coverage status */
  status: CoverageStatus;
  /** Number of assigned classes */
  assignedCount: number;
  /** Number of unassigned classes */
  unassignedCount: number;
  /** Total classes requiring this subject */
  totalClasses: number;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Hook for calculating subject coverage analysis
 *
 * Provides real-time coverage calculations showing which classes
 * require a subject and their assignment status.
 *
 * @param subject - The subject to analyze coverage for
 * @param options - Optional configuration
 * @returns Coverage information and utility data
 */
export function useSubjectCoverage(
  subject: Subject | null,
  options: UseSubjectCoverageOptions = {}
): UseSubjectCoverageResult {
  const { includeTeacherCompatibility = true } = options;

  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();
  // REAL-TIME FIX: Use useTeacherAssignments for real-time assignment data
  const {
    data: allAssignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError,
  } = useTeacherAssignments();

  // Calculate classes requiring this subject - REAL-TIME FIX: Use assignments table
  const classesRequiring = useMemo((): ClassCoverageDetail[] => {
    if (!subject) return [];

    const result: ClassCoverageDetail[] = [];

    for (const classGroup of classes) {
      // Ensure subjectRequirements is an array (handle both parsed and unparsed)
      const requirements = ensureSubjectRequirements(classGroup.subjectRequirements);

      // Check if class has this subject in requirements
      const requirement = requirements.find((r) => r.subjectId === subject.id);

      if (requirement) {
        // REAL-TIME FIX: Find assigned teacher from assignments table instead of requirement.teacherId
        const classSubjectAssignments = allAssignments.filter(
          (a) => a.classId === classGroup.id && a.subjectId === subject.id && !a.isDeleted
        );

        // Get the first assignment (for single-teacher mode) or aggregate for multi-teacher
        const firstAssignment = classSubjectAssignments[0];
        const assignedTeacherId = firstAssignment?.teacherId ?? null;
        const assignedTeacher = assignedTeacherId
          ? teachers.find((t) => t.id === assignedTeacherId)
          : null;

        result.push({
          classId: classGroup.id,
          className: classGroup.displayName || classGroup.name,
          periodsPerWeek: requirement.periodsPerWeek,
          assignmentStatus: assignedTeacherId ? 'assigned' : 'unassigned',
          assignedTeacherId,
          assignedTeacherName: assignedTeacher?.fullName ?? null,
          conflicts: [],
        });
      }
    }

    return result;
  }, [subject, classes, teachers, allAssignments]);

  // Calculate compatible teachers - REAL-TIME FIX: Use assignments table for workload
  const compatibleTeachers = useMemo((): TeacherCompatibility[] => {
    if (!subject || !includeTeacherCompatibility) return [];

    const result: TeacherCompatibility[] = [];

    for (const teacher of teachers) {
      // Parse teacher data to ensure arrays
      const parsedTeacher: TeacherForCoverage = {
        id: teacher.id,
        fullName: teacher.fullName,
        primarySubjectIds: parseJsonArray<number>(teacher.primarySubjectIds),
        allowedSubjectIds: parseJsonArray<number>(teacher.allowedSubjectIds),
        restrictToPrimarySubjects: teacher.restrictToPrimarySubjects,
        maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
        classAssignments: parseJsonArray<ClassAssignment>(teacher.classAssignments),
      };

      const compatibility = getTeacherCompatibility(parsedTeacher, subject.id);
      // NOTE: No longer skip 'incompatible' - include ALL teachers
      // Primary/allowed are solver preferences, not hard restrictions

      // REAL-TIME FIX: Calculate workload from assignments table
      const teacherAssignments = allAssignments.filter(
        (a) => a.teacherId === teacher.id && !a.isDeleted
      );
      const currentWorkload = teacherAssignments.reduce((sum, a) => sum + a.periodsPerWeek, 0);
      const availableCapacity = parsedTeacher.maxPeriodsPerWeek - currentWorkload;

      result.push({
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        subjectId: subject.id,
        compatibility,
        currentWorkload,
        maxWorkload: parsedTeacher.maxPeriodsPerWeek,
        availableCapacity,
        canAcceptAssignment: availableCapacity > 0,
      });
    }

    // Sort by compatibility (primary first) then by available capacity
    return result.sort((a, b) => {
      if (a.compatibility === 'primary' && b.compatibility !== 'primary') return -1;
      if (a.compatibility !== 'primary' && b.compatibility === 'primary') return 1;
      return b.availableCapacity - a.availableCapacity;
    });
  }, [subject, teachers, allAssignments, includeTeacherCompatibility]);

  // Calculate teacher distribution - REAL-TIME FIX: Use assignments table
  const teacherDistribution = useMemo((): TeacherCoverageDetail[] => {
    if (!subject) return [];

    const distribution: TeacherCoverageDetail[] = [];

    // Group assignments by teacher for this subject
    const teacherAssignmentsMap = new Map<number, { classIds: number[]; totalPeriods: number }>();

    for (const assignment of allAssignments) {
      if (assignment.subjectId !== subject.id || assignment.isDeleted) continue;

      const existing = teacherAssignmentsMap.get(assignment.teacherId) || {
        classIds: [],
        totalPeriods: 0,
      };
      existing.classIds.push(assignment.classId);
      existing.totalPeriods += assignment.periodsPerWeek;
      teacherAssignmentsMap.set(assignment.teacherId, existing);
    }

    for (const [teacherId, data] of teacherAssignmentsMap) {
      const teacher = teachers.find((t) => t.id === teacherId);
      if (!teacher) continue;

      distribution.push({
        teacherId,
        teacherName: teacher.fullName,
        assignedClassIds: data.classIds,
        totalPeriods: data.totalPeriods,
        compatibility: getTeacherCompatibility(
          {
            id: teacher.id,
            fullName: teacher.fullName,
            primarySubjectIds: parseJsonArray<number>(teacher.primarySubjectIds),
            allowedSubjectIds: parseJsonArray<number>(teacher.allowedSubjectIds),
            restrictToPrimarySubjects: teacher.restrictToPrimarySubjects,
            maxPeriodsPerWeek: teacher.maxPeriodsPerWeek,
            classAssignments: [],
          },
          subject.id
        ),
      });
    }

    return distribution;
  }, [subject, teachers, allAssignments]);

  // Calculate coverage statistics
  const { assignedCount, unassignedCount, totalClasses, coveragePercentage, status } =
    useMemo(() => {
      const total = classesRequiring.length;
      const assigned = classesRequiring.filter((c) => c.assignmentStatus === 'assigned').length;
      const unassigned = total - assigned;
      const percentage = total > 0 ? Math.round((assigned / total) * 100) : 0;

      let coverageStatus: CoverageStatus = 'uncovered';
      if (percentage === 100) {
        coverageStatus = 'complete';
      } else if (percentage > 0) {
        coverageStatus = 'partial';
      }

      return {
        assignedCount: assigned,
        unassignedCount: unassigned,
        totalClasses: total,
        coveragePercentage: percentage,
        status: coverageStatus,
      };
    }, [classesRequiring]);

  // Build complete coverage object
  const coverage = useMemo((): SubjectCoverage | null => {
    if (!subject) return null;

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      totalClassesRequiring: totalClasses,
      assignedClasses: assignedCount,
      unassignedClasses: classesRequiring.filter((c) => c.assignmentStatus === 'unassigned'),
      teacherDistribution,
      coveragePercentage,
      status,
    };
  }, [
    subject,
    totalClasses,
    assignedCount,
    classesRequiring,
    teacherDistribution,
    coveragePercentage,
    status,
  ]);

  return {
    coverage,
    compatibleTeachers,
    classesRequiring,
    coveragePercentage,
    status,
    assignedCount,
    unassignedCount,
    totalClasses,
    isLoading: isLoadingTeachers || isLoadingClasses || isLoadingAssignments,
    error: teachersError || classesError || assignmentsError || null,
  };
}

export default useSubjectCoverage;

// Re-export types for convenience
export type {
  ClassCoverageDetail,
  CoverageStatus,
  SubjectCoverage,
  TeacherCompatibility,
  TeacherCompatibilityLevel,
  TeacherCoverageDetail,
};
