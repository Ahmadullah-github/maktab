/**
 * useSubjectAssignments Hook
 *
 * Phase 6: reads subject assignment state from the canonical subject coverage
 * projection while keeping canonical assignment mutations unchanged.
 */

import { useMemo } from 'react';
import {
  useAssignTeacher,
  useUnassignTeacher,
  useValidateAssignment,
} from '../../assignments/hooks/useAssignmentMutations';
import { useAssignmentMatrixView, useSubjectCoverageView } from '../../assignments/projections';
import type { TeacherCompatibilityLevel } from '../../assignments/types';
import { useClasses } from '../../classes/hooks/useClasses';
import type { TeacherClassSubjectAssignment } from '../../teacher-assignments/types';

export interface ClassSubjectAssignment {
  assignmentId: number;
  teacherId: number;
  teacherName: string;
  periodsPerWeek: number;
  compatibility: TeacherCompatibilityLevel;
}

export interface ClassAssignmentSummary {
  classId: number;
  className: string;
  displayName: string;
  grade: number | null;
  requiredPeriods: number;
  periodMode?: 'inherited' | 'class_override';
  assignedPeriods: number;
  remainingPeriods: number;
  isFullyAssigned: boolean;
  assignments: ClassSubjectAssignment[];
}

export interface SubjectAssignmentSummaryTeacher {
  teacherId: number;
  teacherName: string;
  assignedClasses: number;
  assignedPeriods: number;
}

export interface SubjectAssignmentSummary {
  subjectId: number;
  subjectName: string;
  totalClasses: number;
  assignedClasses: number;
  partialClasses: number;
  unassignedClasses: number;
  coveragePercentage: number;
  totalRequiredPeriods: number;
  totalAssignedPeriods: number;
  assignedTeachers: SubjectAssignmentSummaryTeacher[];
}

export interface UseSubjectAssignmentsResult {
  classAssignments: ClassAssignmentSummary[];
  rawAssignments: TeacherClassSubjectAssignment[];
  totalClasses: number;
  fullyAssignedClasses: number;
  partiallyAssignedClasses: number;
  unassignedClasses: number;
  coveragePercentage: number;
  assignTeacher: ReturnType<typeof useAssignTeacher>;
  unassignTeacher: ReturnType<typeof useUnassignTeacher>;
  validateAssignment: ReturnType<typeof useValidateAssignment>;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

export interface UseAllSubjectAssignmentSummariesResult {
  allSummaries: SubjectAssignmentSummary[];
  summaryBySubjectId: Map<number, SubjectAssignmentSummary>;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
}

function toTeacherCompatibilityLevel(
  capabilityLevel: 'primary' | 'allowed' | 'incompatible'
): TeacherCompatibilityLevel {
  return capabilityLevel;
}

export function useSubjectAssignments(subjectId: number): UseSubjectAssignmentsResult {
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();
  const {
    data: coverageView,
    isLoading,
    isFetching,
    error,
  } = useSubjectCoverageView(subjectId || null);

  const assignTeacher = useAssignTeacher();
  const unassignTeacher = useUnassignTeacher();
  const validateAssignment = useValidateAssignment();
  const classById = useMemo(() => new Map(classes.map((classGroup) => [classGroup.id, classGroup])), [classes]);

  const classAssignments = useMemo((): ClassAssignmentSummary[] => {
    return (coverageView?.coverage ?? [])
      .map((requirement) => ({
        classId: requirement.classId,
        className: requirement.className,
        displayName:
          classById.get(requirement.classId)?.displayName ||
          classById.get(requirement.classId)?.name ||
          requirement.className,
        grade: classById.get(requirement.classId)?.grade ?? null,
        requiredPeriods: requirement.requiredPeriodsPerWeek,
        periodMode: requirement.periodMode,
        assignedPeriods: requirement.assignedPeriodsPerWeek,
        remainingPeriods: requirement.remainingPeriodsPerWeek,
        isFullyAssigned: requirement.remainingPeriodsPerWeek <= 0 && requirement.assignedPeriodsPerWeek > 0,
        assignments: requirement.assignments.map((assignment) => ({
          assignmentId: assignment.assignmentId,
          teacherId: assignment.teacherId,
          teacherName: assignment.teacherName,
          periodsPerWeek: assignment.assignedPeriodsPerWeek,
          compatibility: toTeacherCompatibilityLevel(assignment.capabilityLevel),
        })),
      }))
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }, [classById, coverageView]);

  const rawAssignments = useMemo(
    (): TeacherClassSubjectAssignment[] =>
      classAssignments.flatMap((classAssignment) =>
        classAssignment.assignments.map((assignment) => ({
          id: assignment.assignmentId,
          teacherId: assignment.teacherId,
          classId: classAssignment.classId,
          subjectId,
          periodsPerWeek: assignment.periodsPerWeek,
          isFixed: true,
          schoolId: null,
          isDeleted: false,
          deletedAt: null,
          createdAt: '',
          updatedAt: '',
        }))
      ),
    [classAssignments, subjectId]
  );

  const totalClasses = classAssignments.length;
  const fullyAssignedClasses = classAssignments.filter((item) => item.isFullyAssigned).length;
  const partiallyAssignedClasses = classAssignments.filter(
    (item) => item.assignedPeriods > 0 && item.remainingPeriods > 0
  ).length;
  const unassignedClasses = classAssignments.filter((item) => item.assignments.length === 0).length;
  const totalRequiredPeriods = classAssignments.reduce((sum, item) => sum + item.requiredPeriods, 0);
  const coveredPeriods = classAssignments.reduce(
    (sum, item) => sum + Math.min(item.assignedPeriods, item.requiredPeriods),
    0
  );
  const coveragePercentage =
    totalRequiredPeriods > 0 ? Math.round((coveredPeriods / totalRequiredPeriods) * 100) : 0;

  return {
    classAssignments,
    rawAssignments,
    totalClasses,
    fullyAssignedClasses,
    partiallyAssignedClasses,
    unassignedClasses,
    coveragePercentage,
    assignTeacher,
    unassignTeacher,
    validateAssignment,
    isLoading:
      isLoadingClasses ||
      isLoading ||
      assignTeacher.isPending ||
      unassignTeacher.isPending ||
      validateAssignment.isPending,
    isFetching,
    error: (classesError as Error | null) || ((error as Error | null) ?? null),
  };
}

export function useAllSubjectAssignmentSummaries(): UseAllSubjectAssignmentSummariesResult {
  const {
    data: assignmentMatrix,
    isLoading,
    isFetching,
    error,
  } = useAssignmentMatrixView();

  const allSummaries = useMemo((): SubjectAssignmentSummary[] => {
    const grouped = new Map<
      number,
      {
        subjectName: string;
        totalClasses: number;
        assignedClasses: number;
        partialClasses: number;
        totalRequiredPeriods: number;
        totalAssignedPeriods: number;
        teacherMap: Map<number, SubjectAssignmentSummaryTeacher>;
      }
    >();

    for (const classView of assignmentMatrix?.classes ?? []) {
      for (const requirement of classView.requirements) {
        const existing = grouped.get(requirement.subjectId) ?? {
          subjectName: requirement.subjectName,
          totalClasses: 0,
          assignedClasses: 0,
          partialClasses: 0,
          totalRequiredPeriods: 0,
          totalAssignedPeriods: 0,
          teacherMap: new Map<number, SubjectAssignmentSummaryTeacher>(),
        };

        existing.totalClasses += 1;
        existing.totalRequiredPeriods += requirement.requiredPeriodsPerWeek;
        existing.totalAssignedPeriods += requirement.assignedPeriodsPerWeek;

        if (requirement.remainingPeriodsPerWeek <= 0 && requirement.assignedPeriodsPerWeek > 0) {
          existing.assignedClasses += 1;
        } else if (requirement.assignedPeriodsPerWeek > 0) {
          existing.partialClasses += 1;
        }

        for (const assignment of requirement.assignments) {
          const teacherSummary = existing.teacherMap.get(assignment.teacherId) ?? {
            teacherId: assignment.teacherId,
            teacherName: assignment.teacherName,
            assignedClasses: 0,
            assignedPeriods: 0,
          };

          teacherSummary.assignedClasses += 1;
          teacherSummary.assignedPeriods += assignment.assignedPeriodsPerWeek;
          existing.teacherMap.set(assignment.teacherId, teacherSummary);
        }

        grouped.set(requirement.subjectId, existing);
      }
    }

    return [...grouped.entries()]
      .map(([subjectId, summary]) => ({
        subjectId,
        subjectName: summary.subjectName,
        totalClasses: summary.totalClasses,
        assignedClasses: summary.assignedClasses,
        partialClasses: summary.partialClasses,
        unassignedClasses:
          summary.totalClasses - summary.assignedClasses - summary.partialClasses,
        coveragePercentage:
          summary.totalRequiredPeriods > 0
            ? Math.round(
                (Math.min(summary.totalAssignedPeriods, summary.totalRequiredPeriods) /
                  summary.totalRequiredPeriods) *
                  100
              )
            : 0,
        totalRequiredPeriods: summary.totalRequiredPeriods,
        totalAssignedPeriods: summary.totalAssignedPeriods,
        assignedTeachers: [...summary.teacherMap.values()].sort(
          (left, right) =>
            right.assignedPeriods - left.assignedPeriods ||
            left.teacherName.localeCompare(right.teacherName)
        ),
      }))
      .sort((left, right) => left.subjectName.localeCompare(right.subjectName));
  }, [assignmentMatrix]);

  const summaryBySubjectId = useMemo(
    () => new Map(allSummaries.map((summary) => [summary.subjectId, summary])),
    [allSummaries]
  );

  return {
    allSummaries,
    summaryBySubjectId,
    isLoading,
    isFetching,
    error: (error as Error | null) ?? null,
  };
}

export default useSubjectAssignments;
