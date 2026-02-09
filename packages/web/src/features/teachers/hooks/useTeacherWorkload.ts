/**
 * useTeacherWorkload Hook
 *
 * Provides workload calculation for teachers with real-time updates.
 * Uses TanStack Query for data fetching and memoization for calculations.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { api } from '@/lib/api';
import { type SubjectRequirement } from '@/lib/apiParsers';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  calculateTeacherWorkload,
  calculateWorkloadBreakdown,
  calculateWorkloadWithAssignment,
  calculateWorkloadWithoutAssignment,
  canAcceptAdditionalPeriods,
} from '../../assignments/services/workloadCalculation';
import type { TeacherWorkload, WorkloadBreakdown, WorkloadStatus } from '../../assignments/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../types';

/**
 * Minimal subject interface for workload calculation
 */
interface MinimalSubject {
  id: number;
  name: string;
  periodsPerWeek?: number | null;
}

/**
 * Raw class from API
 */
interface ClassGroupRaw {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  subjectRequirements: string | SubjectRequirement[];
  isDeleted?: boolean;
}

/**
 * Parsed class for internal use
 */
interface ClassGroupParsed {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  subjectRequirements: SubjectRequirement[];
}

/**
 * Convert minimal subjects to full subjects for calculation
 */
function toFullSubjects(subjects: MinimalSubject[]): Subject[] {
  return subjects.map((s) => ({
    ...s,
    schoolId: null,
    code: '',
    grade: null,
    periodsPerWeek: s.periodsPerWeek ?? null,
    section: '' as const,
    requiredRoomType: '' as const,
    requiredFeatures: [],
    desiredFeatures: [],
    isDifficult: false,
    minRoomCapacity: 0,
    meta: {},
    isDeleted: false,
    deletedAt: null,
    createdAt: '',
    updatedAt: '',
  })) as Subject[];
}

/**
 * Hook to fetch subjects from the API
 */
function useSubjects() {
  return useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const response = (await api.subjects.list()) as MinimalSubject[];
      return response.filter((subject) => !(subject as { isDeleted?: boolean }).isDeleted);
    },
  });
}

/**
 * Hook to fetch classes from the API
 */
function useClasses() {
  return useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const response = (await api.classes.list()) as ClassGroupRaw[];
      return response
        .filter((c) => !c.isDeleted)
        .map(
          (c): ClassGroupParsed => ({
            id: c.id,
            name: c.name,
            displayName: c.displayName,
            grade: c.grade,
            subjectRequirements: parseSubjectRequirements(c.subjectRequirements),
          })
        );
    },
  });
}

export interface UseTeacherWorkloadOptions {
  /** Whether to include workload breakdown by subject */
  includeBreakdown?: boolean;
}

export interface UseTeacherWorkloadResult {
  /** Complete workload information */
  workload: TeacherWorkload | null;
  /** Workload breakdown by subject */
  breakdown: WorkloadBreakdown[];
  /** Current workload status */
  status: WorkloadStatus;
  /** Total periods assigned */
  totalPeriods: number;
  /** Maximum periods allowed */
  maxPeriods: number;
  /** Utilization percentage (0-100+) */
  utilizationPercentage: number;
  /** Remaining capacity (can be negative if overloaded) */
  remainingCapacity: number;
  /** Whether teacher can accept more assignments */
  canAcceptMore: boolean;
  /** Check if teacher can accept specific additional periods */
  canAcceptPeriods: (additionalPeriods: number) => boolean;
  /** Calculate workload if assignment is added */
  getWorkloadWithAssignment: (subjectId: number, classIds: number[]) => TeacherWorkload | null;
  /** Calculate workload if assignment is removed */
  getWorkloadWithoutAssignment: (subjectId: number, classIds: number[]) => TeacherWorkload | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

/**
 * Hook for calculating and managing teacher workload
 *
 * Provides real-time workload calculations with automatic updates
 * when teacher assignments change.
 *
 * @param teacher - The teacher to calculate workload for
 * @param options - Optional configuration
 * @returns Workload information and utility functions
 */
export function useTeacherWorkload(
  teacher: Teacher | null,
  options: UseTeacherWorkloadOptions = {}
): UseTeacherWorkloadResult {
  const { includeBreakdown = true } = options;

  const { data: subjects = [], isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();

  // Convert to full subjects for calculation
  const fullSubjects = useMemo(() => toFullSubjects(subjects), [subjects]);

  // Calculate workload
  const workload = useMemo(() => {
    if (!teacher) return null;
    return calculateTeacherWorkload(teacher, fullSubjects, classes);
  }, [teacher, fullSubjects, classes]);

  // Calculate breakdown
  const breakdown = useMemo(() => {
    if (!teacher || !includeBreakdown) return [];
    return calculateWorkloadBreakdown(teacher, fullSubjects, classes);
  }, [teacher, fullSubjects, classes, includeBreakdown]);

  // Determine status
  const status = useMemo(() => {
    if (!workload) return 'underloaded' as WorkloadStatus;
    return workload.status;
  }, [workload]);

  // Check if can accept more
  const canAcceptMore = useMemo(() => {
    if (!workload) return true;
    return workload.remainingCapacity > 0;
  }, [workload]);

  // Function to check if can accept specific periods
  const canAcceptPeriods = useMemo(() => {
    return (additionalPeriods: number): boolean => {
      if (!teacher) return true;
      return canAcceptAdditionalPeriods(teacher, additionalPeriods, fullSubjects, classes);
    };
  }, [teacher, fullSubjects, classes]);

  // Function to calculate workload with new assignment
  const getWorkloadWithAssignment = useMemo(() => {
    return (subjectId: number, classIds: number[]): TeacherWorkload | null => {
      if (!teacher) return null;
      return calculateWorkloadWithAssignment(teacher, subjectId, classIds, fullSubjects, classes);
    };
  }, [teacher, fullSubjects, classes]);

  // Function to calculate workload without assignment
  const getWorkloadWithoutAssignment = useMemo(() => {
    return (subjectId: number, classIds: number[]): TeacherWorkload | null => {
      if (!teacher) return null;
      return calculateWorkloadWithoutAssignment(
        teacher,
        subjectId,
        classIds,
        fullSubjects,
        classes
      );
    };
  }, [teacher, fullSubjects, classes]);

  return {
    workload,
    breakdown,
    status,
    totalPeriods: workload?.totalPeriods ?? 0,
    maxPeriods: workload?.maxPeriods ?? teacher?.maxPeriodsPerWeek ?? 0,
    utilizationPercentage: workload?.utilizationPercentage ?? 0,
    remainingCapacity: workload?.remainingCapacity ?? teacher?.maxPeriodsPerWeek ?? 0,
    canAcceptMore,
    canAcceptPeriods,
    getWorkloadWithAssignment,
    getWorkloadWithoutAssignment,
    isLoading: isLoadingSubjects || isLoadingClasses,
    error: subjectsError || classesError || null,
  };
}

export default useTeacherWorkload;

// Re-export types for convenience
export type { TeacherWorkload, WorkloadBreakdown, WorkloadStatus };
