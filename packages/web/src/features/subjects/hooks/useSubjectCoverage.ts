/**
 * useSubjectCoverage Hook
 *
 * Phase 6: derives subject coverage from the canonical subject coverage
 * projection and teacher workload projections.
 */

import { useMemo } from 'react';
import {
  getProjectionCoverageStatus,
  projectionWarningToConflict,
  useSubjectCoverageView,
} from '../../assignments/projections';
import type {
  ClassCoverageDetail,
  CoverageStatus,
  SubjectCoverage,
  TeacherCompatibility,
  TeacherCoverageDetail,
} from '../../assignments/types';
import { useSmartTeacherSelection } from '../../assignments/hooks/useSmartTeacherSelection';
import type { Subject } from '../types';

export interface UseSubjectCoverageOptions {
  includeTeacherCompatibility?: boolean;
}

export interface UseSubjectCoverageResult {
  coverage: SubjectCoverage | null;
  compatibleTeachers: TeacherCompatibility[];
  classesRequiring: ClassCoverageDetail[];
  coveragePercentage: number;
  status: CoverageStatus;
  assignedCount: number;
  unassignedCount: number;
  totalClasses: number;
  isLoading: boolean;
  error: Error | null;
}

export function useSubjectCoverage(
  subject: Subject | null,
  options: UseSubjectCoverageOptions = {}
): UseSubjectCoverageResult {
  const { includeTeacherCompatibility = true } = options;

  const {
    data: coverageView,
    isLoading: isLoadingCoverageView,
    error: coverageViewError,
  } = useSubjectCoverageView(subject?.id ?? null);
  const {
    teachers: smartTeachers,
    isLoading: isLoadingTeachers,
    error: teacherError,
  } = useSmartTeacherSelection({
    subjectId: subject?.id ?? 0,
    includeOverloaded: true,
  });

  const classesRequiring = useMemo((): ClassCoverageDetail[] => {
    if (!coverageView) {
      return [];
    }

    return coverageView.coverage.map((requirement) => {
      const firstAssignment = requirement.assignments[0];
      return {
        classId: requirement.classId,
        className: requirement.className,
        periodsPerWeek: requirement.requiredPeriodsPerWeek,
        assignmentStatus:
          requirement.assignedPeriodsPerWeek <= 0
            ? 'unassigned'
            : requirement.remainingPeriodsPerWeek > 0
              ? 'partial'
              : 'assigned',
        assignedTeacherId: firstAssignment?.teacherId ?? null,
        assignedTeacherName: firstAssignment?.teacherName ?? null,
        conflicts: requirement.warnings.map((warning) =>
          projectionWarningToConflict(warning, {
            classId: requirement.classId,
            subjectId: requirement.subjectId,
            teacherId: firstAssignment?.teacherId,
          })
        ),
      };
    });
  }, [coverageView]);

  const compatibleTeachers = useMemo((): TeacherCompatibility[] => {
    if (!includeTeacherCompatibility || !subject) {
      return [];
    }

    return smartTeachers.map((teacher) => ({
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      subjectId: subject.id,
      compatibility:
        teacher.compatibility === 'generalist' || teacher.compatibility === 'inferred'
          ? 'allowed'
          : teacher.compatibility === 'available'
            ? 'incompatible'
            : teacher.compatibility,
      currentWorkload: teacher.currentWorkload,
      maxWorkload: teacher.maxWorkload,
      availableCapacity: teacher.availableCapacity,
      canAcceptAssignment: teacher.canAcceptAssignment,
    }));
  }, [includeTeacherCompatibility, smartTeachers, subject]);

  const teacherDistribution = useMemo((): TeacherCoverageDetail[] => {
    if (!coverageView) {
      return [];
    }

    const grouped = new Map<
      number,
      { teacherName: string; assignedClassIds: number[]; totalPeriods: number; compatibility: 'primary' | 'allowed' | 'incompatible' }
    >();

    coverageView.coverage.forEach((requirement) => {
      requirement.assignments.forEach((assignment) => {
        const existing = grouped.get(assignment.teacherId);
        if (existing) {
          existing.assignedClassIds.push(requirement.classId);
          existing.totalPeriods += assignment.assignedPeriodsPerWeek;
          return;
        }

        grouped.set(assignment.teacherId, {
          teacherName: assignment.teacherName,
          assignedClassIds: [requirement.classId],
          totalPeriods: assignment.assignedPeriodsPerWeek,
          compatibility:
            assignment.capabilityLevel === 'incompatible' ? 'incompatible' : assignment.capabilityLevel,
        });
      });
    });

    return [...grouped.entries()].map(([teacherId, value]) => ({
      teacherId,
      teacherName: value.teacherName,
      assignedClassIds: value.assignedClassIds,
      totalPeriods: value.totalPeriods,
      compatibility: value.compatibility,
    }));
  }, [coverageView]);

  const assignedCount = useMemo(
    () =>
      classesRequiring.filter(
        (classCoverage) =>
          classCoverage.assignmentStatus === 'assigned' || classCoverage.assignmentStatus === 'conflict'
      ).length,
    [classesRequiring]
  );
  const totalClasses = classesRequiring.length;
  const unassignedCount = totalClasses - assignedCount;
  const coveragePercentage = totalClasses > 0 ? Math.round((assignedCount / totalClasses) * 100) : 0;
  const status = useMemo(
    () => getProjectionCoverageStatus(coverageView?.coverage ?? []),
    [coverageView]
  );

  const coverage = useMemo((): SubjectCoverage | null => {
    if (!subject) {
      return null;
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      totalClassesRequiring: totalClasses,
      assignedClasses: assignedCount,
      unassignedClasses: classesRequiring.filter((classCoverage) => classCoverage.assignmentStatus === 'unassigned'),
      teacherDistribution,
      coveragePercentage,
      status,
    };
  }, [assignedCount, classesRequiring, coveragePercentage, status, subject, teacherDistribution, totalClasses]);

  return {
    coverage,
    compatibleTeachers,
    classesRequiring,
    coveragePercentage,
    status,
    assignedCount,
    unassignedCount,
    totalClasses,
    isLoading: isLoadingCoverageView || isLoadingTeachers,
    error: (coverageViewError as Error | null) || teacherError,
  };
}

export default useSubjectCoverage;

export type {
  ClassCoverageDetail,
  CoverageStatus,
  SubjectCoverage,
  TeacherCompatibility,
  TeacherCoverageDetail,
};
