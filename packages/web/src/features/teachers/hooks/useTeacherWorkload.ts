/**
 * useTeacherWorkload Hook
 *
 * Phase 6: derives workload from the canonical teacher workload projection.
 */

import { useMemo } from 'react';
import { useTeacherWorkloadView } from '../../assignments/projections';
import type { TeacherWorkload, WorkloadBreakdown, WorkloadStatus } from '../../assignments/types';
import type { Teacher } from '../types';

export interface UseTeacherWorkloadOptions {
  includeBreakdown?: boolean;
}

export interface UseTeacherWorkloadResult {
  workload: TeacherWorkload | null;
  breakdown: WorkloadBreakdown[];
  status: WorkloadStatus;
  totalPeriods: number;
  maxPeriods: number;
  utilizationPercentage: number;
  remainingCapacity: number;
  canAcceptMore: boolean;
  canAcceptPeriods: (additionalPeriods: number) => boolean;
  getWorkloadWithAssignment: (subjectId: number, classIds: number[]) => TeacherWorkload | null;
  getWorkloadWithoutAssignment: (subjectId: number, classIds: number[]) => TeacherWorkload | null;
  isLoading: boolean;
  error: Error | null;
}

function toBreakdown(
  assignments: Array<{
    subjectId: number;
    subjectName: string;
    classId: number;
    assignedPeriodsPerWeek: number;
  }>
): WorkloadBreakdown[] {
  const grouped = new Map<number, WorkloadBreakdown>();

  assignments.forEach((assignment) => {
    const existing = grouped.get(assignment.subjectId);
    if (existing) {
      existing.classIds.push(assignment.classId);
      existing.totalPeriods += assignment.assignedPeriodsPerWeek;
      existing.periodsPerWeek += assignment.assignedPeriodsPerWeek;
      return;
    }

    grouped.set(assignment.subjectId, {
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName,
      classIds: [assignment.classId],
      periodsPerWeek: assignment.assignedPeriodsPerWeek,
      totalPeriods: assignment.assignedPeriodsPerWeek,
    });
  });

  return [...grouped.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName));
}

export function useTeacherWorkload(
  teacher: Teacher | null,
  options: UseTeacherWorkloadOptions = {}
): UseTeacherWorkloadResult {
  const { includeBreakdown = true } = options;
  const {
    data: workloadView,
    isLoading,
    error,
  } = useTeacherWorkloadView(teacher?.id ?? null);

  const breakdown = useMemo(
    () => (includeBreakdown ? toBreakdown(workloadView?.assignments ?? []) : []),
    [includeBreakdown, workloadView]
  );

  const workload = useMemo((): TeacherWorkload | null => {
    if (!teacher || !workloadView) {
      return null;
    }

    return {
      teacherId: teacher.id,
      totalPeriods: workloadView.assignedPeriodsPerWeek,
      maxPeriods: workloadView.maxPeriodsPerWeek,
      utilizationPercentage:
        workloadView.maxPeriodsPerWeek > 0
          ? (workloadView.assignedPeriodsPerWeek / workloadView.maxPeriodsPerWeek) * 100
          : 0,
      breakdown,
      status:
        workloadView.assignedPeriodsPerWeek > workloadView.maxPeriodsPerWeek
          ? 'overloaded'
          : workloadView.remainingCapacityPerWeek <= 5
            ? 'near_capacity'
            : workloadView.assignedPeriodsPerWeek >= workloadView.maxPeriodsPerWeek * 0.5
              ? 'optimal'
              : 'underloaded',
      remainingCapacity: workloadView.remainingCapacityPerWeek,
    };
  }, [breakdown, teacher, workloadView]);

  const canAcceptPeriods = useMemo(
    () => (additionalPeriods: number) => (workload?.remainingCapacity ?? 0) >= additionalPeriods,
    [workload]
  );

  const getWorkloadWithAssignment = useMemo(
    () => (_subjectId: number, _classIds: number[]) => {
      if (!workload) {
        return null;
      }
      return workload;
    },
    [workload]
  );

  const getWorkloadWithoutAssignment = useMemo(
    () => (_subjectId: number, _classIds: number[]) => {
      if (!workload) {
        return null;
      }
      return workload;
    },
    [workload]
  );

  return {
    workload,
    breakdown,
    status: workload?.status ?? 'underloaded',
    totalPeriods: workload?.totalPeriods ?? 0,
    maxPeriods: workload?.maxPeriods ?? teacher?.maxPeriodsPerWeek ?? 0,
    utilizationPercentage: workload?.utilizationPercentage ?? 0,
    remainingCapacity: workload?.remainingCapacity ?? teacher?.maxPeriodsPerWeek ?? 0,
    canAcceptMore: (workload?.remainingCapacity ?? teacher?.maxPeriodsPerWeek ?? 0) > 0,
    canAcceptPeriods,
    getWorkloadWithAssignment,
    getWorkloadWithoutAssignment,
    isLoading,
    error: (error as Error | null) ?? null,
  };
}

export default useTeacherWorkload;

export type { TeacherWorkload, WorkloadBreakdown, WorkloadStatus };
