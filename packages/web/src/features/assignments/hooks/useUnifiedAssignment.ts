/**
 * useUnifiedAssignment Hook
 *
 * Shared assignment utilities backed by canonical projection endpoints for
 * read-heavy UI plus canonical assignment mutations for write paths.
 */

import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useClasses } from '../../classes/hooks/useClasses';
import type { ClassGroup } from '../../classes/types';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import type { Teacher } from '../../teachers/types';
import {
  useAssignmentMatrixView,
  useTeacherWorkloadViews,
  type ProjectionRequirementView,
  type TeacherWorkloadView,
} from '../projections';
import type {
  AssignmentConflict,
  AssignmentStatus,
  TeacherCompatibilityLevel,
  TeacherWorkload,
  WorkloadBreakdown,
  WorkloadStatus,
} from '../types';
import {
  useAssignTeacher,
  useUnassignTeacher,
  useValidateAssignment,
} from './useAssignmentMutations';

export interface AssignmentInfo {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
  periodsPerWeek: number;
  status: AssignmentStatus;
  compatibility: TeacherCompatibilityLevel;
}

export interface TeacherOption {
  id: number;
  name: string;
  compatibility: TeacherCompatibilityLevel;
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
  canAcceptAssignment: boolean;
  isCurrentlyAssigned: boolean;
}

export interface ClassOption {
  id: number;
  name: string;
  displayName: string;
  grade: number | null;
  periodsPerWeek: number;
  currentTeacherId: number | null;
  currentTeacherName: string | null;
  isAssigned: boolean;
}

export interface SubjectOption {
  id: number;
  name: string;
  periodsPerWeek: number;
  classesRequiring: number;
  classesAssigned: number;
  coveragePercentage: number;
}

export interface UseUnifiedAssignmentOptions {
  teacherId?: number;
  subjectId?: number;
  classId?: number;
}

export interface UseUnifiedAssignmentResult {
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassGroup[];
  teacherOptions: TeacherOption[];
  classOptions: ClassOption[];
  subjectOptions: SubjectOption[];
  selectedTeacher: Teacher | null;
  selectedSubject: Subject | null;
  selectedClass: ClassGroup | null;
  calculateTeacherWorkload: (teacherId: number) => TeacherWorkload;
  getTeacherCompatibility: (teacherId: number, subjectId: number) => TeacherCompatibilityLevel;
  assign: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
    periodsPerWeek?: number;
    classPeriodOverrides?: { classId: number; periodsPerWeek: number }[];
    persistRequirementOverrides?: boolean;
  }) => Promise<{ success: boolean; conflicts: AssignmentConflict[]; warnings: AssignmentConflict[] }>;
  unassign: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
  }) => Promise<{ success: boolean }>;
  validate: (params: {
    teacherId: number;
    subjectId: number;
    classIds: number[];
    periodsPerWeek?: number;
    classPeriodOverrides?: { classId: number; periodsPerWeek: number }[];
    persistRequirementOverrides?: boolean;
  }) => Promise<{
    isValid: boolean;
    conflicts: AssignmentConflict[];
    warnings: AssignmentConflict[];
  }>;
  isAssigning: boolean;
  isUnassigning: boolean;
  isValidating: boolean;
  isLoading: boolean;
  getAssignmentInfo: (
    teacherId: number,
    subjectId: number,
    classId: number
  ) => AssignmentInfo | null;
  getClassesForTeacherSubject: (teacherId: number, subjectId: number) => ClassOption[];
  getTeachersForSubjectClass: (subjectId: number, classId: number) => TeacherOption[];
  invalidateAllCaches: () => void;
  error: Error | null;
}

function determineWorkloadStatus(totalPeriods: number, maxPeriods: number): WorkloadStatus {
  if (maxPeriods <= 0) return 'underloaded';

  const utilizationPercentage = (totalPeriods / maxPeriods) * 100;
  const remainingCapacity = maxPeriods - totalPeriods;

  if (totalPeriods > maxPeriods) return 'overloaded';
  if (remainingCapacity <= 5) return 'near_capacity';
  if (utilizationPercentage >= 50) return 'optimal';
  return 'underloaded';
}

function groupWorkloadBreakdown(assignments: TeacherWorkloadView['assignments']): WorkloadBreakdown[] {
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

function getTeacherCompatibilityFromProjection(
  workload: TeacherWorkloadView | undefined,
  subjectId: number
): TeacherCompatibilityLevel {
  const capability = workload?.capabilities.find((item) => item.subjectId === subjectId)?.capabilityLevel;
  if (capability) {
    return capability;
  }

  // Preserve the current "generalist" behavior for teachers with no explicit
  // capability rows yet.
  if ((workload?.capabilities.length ?? 0) === 0) {
    return 'allowed';
  }

  return 'incompatible';
}

function getRequirementStatus(requirement: ProjectionRequirementView): AssignmentStatus {
  if (requirement.warnings.some((warning) => warning.severity === 'error')) {
    return 'conflict';
  }
  if (requirement.assignedPeriodsPerWeek <= 0) {
    return 'unassigned';
  }
  if (requirement.remainingPeriodsPerWeek > 0) {
    return 'partial';
  }
  return 'assigned';
}

export function useUnifiedAssignment(
  options: UseUnifiedAssignmentOptions = {}
): UseUnifiedAssignmentResult {
  const { teacherId, subjectId, classId } = options;
  const queryClient = useQueryClient();

  const { data: teachers = [], isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const { data: subjects = [], isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();
  const { data: classes = [], isLoading: isLoadingClasses, error: classesError } = useClasses();
  const {
    data: assignmentMatrix,
    isLoading: isLoadingAssignmentMatrix,
    error: assignmentMatrixError,
  } = useAssignmentMatrixView();
  const {
    workloadByTeacherId,
    isLoading: isLoadingWorkloads,
    error: workloadsError,
  } = useTeacherWorkloadViews(teachers.filter((teacher) => !teacher.isDeleted).map((teacher) => teacher.id));

  const assignMutation = useAssignTeacher();
  const unassignMutation = useUnassignTeacher();
  const validateMutation = useValidateAssignment();

  const selectedTeacher = useMemo(
    () => (teacherId ? teachers.find((teacher) => teacher.id === teacherId) ?? null : null),
    [teacherId, teachers]
  );
  const selectedSubject = useMemo(
    () => (subjectId ? subjects.find((subject) => subject.id === subjectId) ?? null : null),
    [subjectId, subjects]
  );
  const selectedClass = useMemo(
    () => (classId ? classes.find((classGroup) => classGroup.id === classId) ?? null : null),
    [classId, classes]
  );

  const classById = useMemo(() => new Map(classes.map((classGroup) => [classGroup.id, classGroup])), [classes]);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const matrixRequirementsByClass = useMemo(
    () =>
      new Map(
        (assignmentMatrix?.classes ?? []).map((classView) => [classView.classId, classView.requirements])
      ),
    [assignmentMatrix]
  );

  const getRequirement = useCallback(
    (targetClassId: number, targetSubjectId: number): ProjectionRequirementView | null =>
      matrixRequirementsByClass
        .get(targetClassId)
        ?.find((requirement) => requirement.subjectId === targetSubjectId) ?? null,
    [matrixRequirementsByClass]
  );

  const calculateTeacherWorkload = useCallback(
    (targetTeacherId: number): TeacherWorkload => {
      const teacher = teachers.find((item) => item.id === targetTeacherId);
      const workload = workloadByTeacherId.get(targetTeacherId);

      const maxPeriods = workload?.maxPeriodsPerWeek ?? teacher?.maxPeriodsPerWeek ?? 0;
      const totalPeriods = workload?.assignedPeriodsPerWeek ?? 0;

      return {
        teacherId: targetTeacherId,
        totalPeriods,
        maxPeriods,
        utilizationPercentage: maxPeriods > 0 ? (totalPeriods / maxPeriods) * 100 : 0,
        breakdown: groupWorkloadBreakdown(workload?.assignments ?? []),
        status: determineWorkloadStatus(totalPeriods, maxPeriods),
        remainingCapacity: workload?.remainingCapacityPerWeek ?? maxPeriods - totalPeriods,
      };
    },
    [teachers, workloadByTeacherId]
  );

  const getTeacherCompatibility = useCallback(
    (targetTeacherId: number, targetSubjectId: number): TeacherCompatibilityLevel =>
      getTeacherCompatibilityFromProjection(workloadByTeacherId.get(targetTeacherId), targetSubjectId),
    [workloadByTeacherId]
  );

  const teacherOptions = useMemo((): TeacherOption[] => {
    const requirement = classId && subjectId ? getRequirement(classId, subjectId) : null;

    return teachers
      .filter((teacher) => !teacher.isDeleted)
      .map((teacher) => {
        const workload = calculateTeacherWorkload(teacher.id);
        return {
          id: teacher.id,
          name: teacher.fullName,
          compatibility: subjectId ? getTeacherCompatibility(teacher.id, subjectId) : 'primary',
          currentWorkload: workload.totalPeriods,
          maxWorkload: workload.maxPeriods,
          availableCapacity: workload.remainingCapacity,
          canAcceptAssignment: workload.remainingCapacity > 0,
          isCurrentlyAssigned:
            requirement?.assignments.some((assignment) => assignment.teacherId === teacher.id) ?? false,
        };
      })
      .sort((left, right) => {
        if (left.isCurrentlyAssigned !== right.isCurrentlyAssigned) {
          return left.isCurrentlyAssigned ? -1 : 1;
        }
        if (left.canAcceptAssignment !== right.canAcceptAssignment) {
          return left.canAcceptAssignment ? -1 : 1;
        }
        const compatibilityOrder = { primary: 0, allowed: 1, incompatible: 2 };
        const leftOrder = compatibilityOrder[left.compatibility];
        const rightOrder = compatibilityOrder[right.compatibility];
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return right.availableCapacity - left.availableCapacity;
      });
  }, [teachers, classId, subjectId, calculateTeacherWorkload, getRequirement, getTeacherCompatibility]);

  const classOptions = useMemo((): ClassOption[] => {
    if (!subjectId) {
      return classes
        .filter((classGroup) => !classGroup.isDeleted)
        .map((classGroup) => ({
          id: classGroup.id,
          name: classGroup.name,
          displayName: classGroup.displayName || classGroup.name,
          grade: classGroup.grade,
          periodsPerWeek: 0,
          currentTeacherId: null,
          currentTeacherName: null,
          isAssigned: false,
        }));
    }

    return classes
      .filter((classGroup) => !classGroup.isDeleted)
      .flatMap((classGroup) => {
        const requirement = getRequirement(classGroup.id, subjectId);
        if (!requirement) {
          return [];
        }

        const primaryAssignment = requirement.assignments[0];
        return [
          {
            id: classGroup.id,
            name: classGroup.name,
            displayName: classGroup.displayName || classGroup.name,
            grade: classGroup.grade,
            periodsPerWeek: requirement.requiredPeriodsPerWeek,
            currentTeacherId: primaryAssignment?.teacherId ?? null,
            currentTeacherName: primaryAssignment?.teacherName ?? null,
            isAssigned: requirement.assignedPeriodsPerWeek > 0,
          },
        ];
      })
      .sort((left, right) => {
        if (left.grade !== right.grade) {
          return (left.grade || 0) - (right.grade || 0);
        }
        return left.displayName.localeCompare(right.displayName);
      });
  }, [classes, getRequirement, subjectId]);

  const subjectOptions = useMemo((): SubjectOption[] => {
    return subjects
      .filter((subject) => !subject.isDeleted)
      .map((subject) => {
        let classesRequiring = 0;
        let classesAssigned = 0;

        (assignmentMatrix?.classes ?? []).forEach((classView) => {
          const requirement = classView.requirements.find((item) => item.subjectId === subject.id);
          if (!requirement) {
            return;
          }

          classesRequiring += 1;
          if (requirement.assignedPeriodsPerWeek > 0 && requirement.remainingPeriodsPerWeek <= 0) {
            classesAssigned += 1;
          }
        });

        return {
          id: subject.id,
          name: subject.name,
          periodsPerWeek: subject.periodsPerWeek ?? 0,
          classesRequiring,
          classesAssigned,
          coveragePercentage:
            classesRequiring > 0 ? Math.round((classesAssigned / classesRequiring) * 100) : 0,
        };
      })
      .filter((subject) => {
        if (!teacherId) {
          return true;
        }
        return getTeacherCompatibility(teacherId, subject.id) !== 'incompatible';
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [assignmentMatrix, getTeacherCompatibility, subjects, teacherId]);

  const getAssignmentInfo = useCallback(
    (targetTeacherId: number, targetSubjectId: number, targetClassId: number): AssignmentInfo | null => {
      const teacher = teachers.find((item) => item.id === targetTeacherId);
      const subject = subjectById.get(targetSubjectId);
      const classGroup = classById.get(targetClassId);
      const requirement = getRequirement(targetClassId, targetSubjectId);

      if (!teacher || !subject || !classGroup || !requirement) {
        return null;
      }

      const assignment = requirement.assignments.find((item) => item.teacherId === targetTeacherId);
      return {
        teacherId: targetTeacherId,
        teacherName: teacher.fullName,
        subjectId: targetSubjectId,
        subjectName: subject.name,
        classId: targetClassId,
        className: classGroup.displayName || classGroup.name,
        periodsPerWeek: assignment?.assignedPeriodsPerWeek ?? requirement.requiredPeriodsPerWeek,
        status: assignment ? getRequirementStatus(requirement) : 'unassigned',
        compatibility: getTeacherCompatibility(targetTeacherId, targetSubjectId),
      };
    },
    [classById, getRequirement, getTeacherCompatibility, subjectById, teachers]
  );

  const getClassesForTeacherSubject = useCallback(
    (targetTeacherId: number, targetSubjectId: number): ClassOption[] =>
      classes
        .filter((classGroup) => !classGroup.isDeleted)
        .flatMap((classGroup) => {
          const requirement = getRequirement(classGroup.id, targetSubjectId);
          if (!requirement) {
            return [];
          }

          const activeAssignment = requirement.assignments.find(
            (assignment) => assignment.teacherId === targetTeacherId
          );
          const primaryAssignment = requirement.assignments[0];

          return [
            {
              id: classGroup.id,
              name: classGroup.name,
              displayName: classGroup.displayName || classGroup.name,
              grade: classGroup.grade,
              periodsPerWeek: requirement.requiredPeriodsPerWeek,
              currentTeacherId: primaryAssignment?.teacherId ?? null,
              currentTeacherName: primaryAssignment?.teacherName ?? null,
              isAssigned: Boolean(activeAssignment),
            },
          ];
        }),
    [classes, getRequirement]
  );

  const getTeachersForSubjectClass = useCallback(
    (targetSubjectId: number, targetClassId: number): TeacherOption[] => {
      const requirement = getRequirement(targetClassId, targetSubjectId);

      return teachers
        .filter((teacher) => !teacher.isDeleted)
        .map((teacher) => {
          const workload = calculateTeacherWorkload(teacher.id);
          return {
            id: teacher.id,
            name: teacher.fullName,
            compatibility: getTeacherCompatibility(teacher.id, targetSubjectId),
            currentWorkload: workload.totalPeriods,
            maxWorkload: workload.maxPeriods,
            availableCapacity: workload.remainingCapacity,
            canAcceptAssignment: workload.remainingCapacity > 0,
            isCurrentlyAssigned:
              requirement?.assignments.some((assignment) => assignment.teacherId === teacher.id) ?? false,
          };
        })
        .sort((left, right) => {
          if (left.isCurrentlyAssigned !== right.isCurrentlyAssigned) {
            return left.isCurrentlyAssigned ? -1 : 1;
          }
          if (left.compatibility !== right.compatibility) {
            const order = { primary: 0, allowed: 1, incompatible: 2 };
            return order[left.compatibility] - order[right.compatibility];
          }
          return right.availableCapacity - left.availableCapacity;
        });
    },
    [calculateTeacherWorkload, getRequirement, getTeacherCompatibility, teachers]
  );

  const invalidateAllCaches = useCallback(() => {
    invalidateAssignmentCaches(queryClient);
  }, [queryClient]);

  const assign = useCallback(
    async (params: {
      teacherId: number;
      subjectId: number;
      classIds: number[];
      periodsPerWeek?: number;
      classPeriodOverrides?: { classId: number; periodsPerWeek: number }[];
      persistRequirementOverrides?: boolean;
    }) => {
      const result = await assignMutation.mutateAsync(params);
      return {
        success: result.success,
        conflicts: result.conflicts || [],
        warnings: result.warnings || [],
      };
    },
    [assignMutation]
  );

  const unassign = useCallback(
    async (params: { teacherId: number; subjectId: number; classIds: number[] }) => {
      await unassignMutation.mutateAsync(params);
      return { success: true };
    },
    [unassignMutation]
  );

  const validate = useCallback(
    async (params: {
      teacherId: number;
      subjectId: number;
      classIds: number[];
      periodsPerWeek?: number;
      classPeriodOverrides?: { classId: number; periodsPerWeek: number }[];
      persistRequirementOverrides?: boolean;
    }) => {
      const result = await validateMutation.mutateAsync(params);
      return {
        isValid: result.isValid,
        conflicts: result.conflicts || [],
        warnings: result.warnings || [],
      };
    },
    [validateMutation]
  );

  return {
    teachers,
    subjects,
    classes,
    teacherOptions,
    classOptions,
    subjectOptions,
    selectedTeacher,
    selectedSubject,
    selectedClass,
    calculateTeacherWorkload,
    getTeacherCompatibility,
    assign,
    unassign,
    validate,
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
    isValidating: validateMutation.isPending,
    isLoading:
      isLoadingTeachers ||
      isLoadingSubjects ||
      isLoadingClasses ||
      isLoadingAssignmentMatrix ||
      isLoadingWorkloads,
    getAssignmentInfo,
    getClassesForTeacherSubject,
    getTeachersForSubjectClass,
    invalidateAllCaches,
    error:
      (teachersError as Error | null) ||
      (subjectsError as Error | null) ||
      (classesError as Error | null) ||
      (assignmentMatrixError as Error | null) ||
      workloadsError,
  };
}

export default useUnifiedAssignment;
