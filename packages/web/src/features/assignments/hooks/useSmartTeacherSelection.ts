/**
 * useSmartTeacherSelection Hook
 *
 * Provides smart teacher selection with rich compatibility info
 * for use in class subject assignment dropdowns.
 *
 * Features:
 * - Shows ALL teachers (not just compatible ones)
 * - Groups by compatibility level
 * - Shows workload, free periods, current assignments
 * - Smart inference from related subjects
 * - Uses real-time data from TeacherClassSubjectAssignment table
 */

import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import { useTeacherAssignments } from '../../teacher-assignments/hooks';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';
import { teachersApi } from '../../teachers/api';
import {
  getCompatibilityReason,
  getSmartCompatibility,
  groupTeachersByCompatibility,
  type SmartCompatibilityLevel,
  type SmartTeacherCompatibility,
  type TeacherAssignmentSummary,
} from '../services/teacherCompatibility';

// ============================================================================
// Types
// ============================================================================

export interface UseSmartTeacherSelectionOptions {
  /** Subject ID to find teachers for */
  subjectId: number;
  /** Optional class ID for context */
  classId?: number;
  /** Whether to include teachers with no capacity */
  includeOverloaded?: boolean;
}

export interface UseSmartTeacherSelectionResult {
  /** All teachers with compatibility info, sorted by best match */
  teachers: SmartTeacherCompatibility[];
  /** Teachers grouped by compatibility level */
  grouped: Record<SmartCompatibilityLevel, SmartTeacherCompatibility[]>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Subject info */
  subject: Subject | null;
}

// ============================================================================
// Helper: Calculate workload from real assignment data
// ============================================================================

function calculateRealWorkload(
  teacherId: number,
  assignments: TeacherClassSubjectAssignment[],
  subjects: Subject[]
): { total: number; breakdown: TeacherAssignmentSummary[] } {
  // Filter assignments for this teacher
  const teacherAssignments = assignments.filter((a) => a.teacherId === teacherId && !a.isDeleted);

  // Group by subject
  const bySubject = new Map<number, { classIds: number[]; totalPeriods: number }>();

  for (const assignment of teacherAssignments) {
    const existing = bySubject.get(assignment.subjectId);
    if (existing) {
      existing.classIds.push(assignment.classId);
      existing.totalPeriods += assignment.periodsPerWeek;
    } else {
      bySubject.set(assignment.subjectId, {
        classIds: [assignment.classId],
        totalPeriods: assignment.periodsPerWeek,
      });
    }
  }

  // Build breakdown
  const breakdown: TeacherAssignmentSummary[] = [];
  let total = 0;

  for (const [subjectId, data] of bySubject) {
    const subject = subjects.find((s) => s.id === subjectId);
    breakdown.push({
      subjectId,
      subjectName: subject?.name || `Subject ${subjectId}`,
      classCount: data.classIds.length,
      totalPeriods: data.totalPeriods,
    });
    total += data.totalPeriods;
  }

  return { total, breakdown };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSmartTeacherSelection(
  options: UseSmartTeacherSelectionOptions
): UseSmartTeacherSelectionResult {
  const { subjectId, includeOverloaded = true } = options;

  // Fetch teachers with proper deserialization
  const {
    data: teachers = [],
    isLoading: isLoadingTeachers,
    error: teachersError,
  } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const result = await teachersApi.getAll();
      return result.filter((t) => !t.isDeleted);
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch subjects
  const {
    data: subjects = [],
    isLoading: isLoadingSubjects,
    error: subjectsError,
  } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const result = (await api.subjects.list()) as Subject[];
      return result.filter((s) => !s.isDeleted);
    },
  });

  // Fetch classes
  const {
    data: classes = [],
    isLoading: isLoadingClasses,
    error: classesError,
  } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const result = (await api.classes.list()) as ClassGroup[];
      return result.filter((c) => !c.isDeleted);
    },
  });

  // Fetch REAL assignment data from TeacherClassSubjectAssignment table
  const {
    data: realAssignments = [],
    isLoading: isLoadingAssignments,
    error: assignmentsError,
  } = useTeacherAssignments();

  // Get target subject
  const subject = useMemo(() => {
    return subjects.find((s) => s.id === subjectId) || null;
  }, [subjects, subjectId]);

  // Calculate smart compatibility for all teachers using REAL workload data
  const smartTeachers = useMemo(() => {
    if (!subjectId || teachers.length === 0 || subjects.length === 0) {
      return [];
    }

    const targetSubject = subjects.find((s) => s.id === subjectId);

    return teachers
      .filter((t) => !t.isDeleted)
      .map((teacher) => {
        const { level, score, relatedSubjects } = getSmartCompatibility(
          teacher,
          subjectId,
          subjects
        );

        // Calculate REAL workload from assignment table
        const workload = calculateRealWorkload(teacher.id, realAssignments, subjects);
        const availableCapacity = teacher.maxPeriodsPerWeek - workload.total;
        const canAccept = availableCapacity > 0;

        // Calculate unavailable slots
        const unavailableSlots = Array.isArray(teacher.unavailable) ? teacher.unavailable : [];
        const unavailableCount = unavailableSlots.length;

        // Check if limited availability might cause scheduling issues
        // Warning if: unavailable slots > 20% of max workload OR workload approaches available time
        const hasLimitedAvailability =
          unavailableCount > 0 &&
          (unavailableCount >= teacher.maxPeriodsPerWeek * 0.2 ||
            workload.total + unavailableCount > teacher.maxPeriodsPerWeek);

        // Generate explanation
        const { reasonFa, reasonEn } = getCompatibilityReason(
          level,
          relatedSubjects,
          targetSubject?.name || ''
        );

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          compatibility: level,
          compatibilityScore: canAccept ? score : score - 50,
          currentWorkload: workload.total,
          maxWorkload: teacher.maxPeriodsPerWeek,
          availableCapacity: Math.max(0, availableCapacity),
          canAcceptAssignment: canAccept,
          unavailableCount,
          hasLimitedAvailability,
          currentAssignments: workload.breakdown,
          relatedSubjectsTaught: relatedSubjects,
          reasonFa,
          reasonEn,
        };
      })
      .sort((a, b) => {
        if (a.canAcceptAssignment !== b.canAcceptAssignment) {
          return a.canAcceptAssignment ? -1 : 1;
        }
        if (a.compatibilityScore !== b.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        return b.availableCapacity - a.availableCapacity;
      });
  }, [teachers, subjects, classes, realAssignments, subjectId]);

  // Filter overloaded if needed
  const filteredTeachers = useMemo(() => {
    if (!includeOverloaded) {
      return smartTeachers.filter((t) => t.canAcceptAssignment);
    }
    return smartTeachers;
  }, [smartTeachers, includeOverloaded]);

  // Group teachers by compatibility
  const grouped = useMemo(() => {
    return groupTeachersByCompatibility(filteredTeachers);
  }, [filteredTeachers]);

  return {
    teachers: filteredTeachers,
    grouped,
    isLoading: isLoadingTeachers || isLoadingSubjects || isLoadingClasses || isLoadingAssignments,
    error: teachersError || subjectsError || classesError || assignmentsError || null,
    subject,
  };
}

export default useSmartTeacherSelection;
