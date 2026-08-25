/**
 * useSmartTeacherSelection Hook
 *
 * Provides teacher candidate ranking for assignment flows using canonical
 * workload projections plus teacher capability data mirrored on the teacher
 * entity during the cutover.
 */

import { useMemo } from 'react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { useTeachers } from '../../teachers/hooks/useTeachers';
import { useTeacherWorkloadViews } from '../projections';
import {
  detectSubjectDomain,
  getCompatibilityReason,
  groupTeachersByCompatibility,
  type SmartCompatibilityLevel,
  type SmartTeacherCompatibility,
  type TeacherAssignmentSummary,
} from '../services/teacherCompatibility';

export interface UseSmartTeacherSelectionOptions {
  subjectId: number;
  authorizationSubjectIds?: number[];
  classId?: number;
  includeOverloaded?: boolean;
}

export interface UseSmartTeacherSelectionResult {
  teachers: SmartTeacherCompatibility[];
  grouped: Record<SmartCompatibilityLevel, SmartTeacherCompatibility[]>;
  isLoading: boolean;
  error: Error | null;
  subject: { id: number; name: string } | null;
}

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

function summarizeAssignments(
  assignments: Array<{
    subjectId: number;
    subjectName: string;
    assignedPeriodsPerWeek: number;
  }>
): TeacherAssignmentSummary[] {
  const bySubject = new Map<number, TeacherAssignmentSummary>();

  assignments.forEach((assignment) => {
    const existing = bySubject.get(assignment.subjectId);
    if (existing) {
      existing.classCount += 1;
      existing.totalPeriods += assignment.assignedPeriodsPerWeek;
      return;
    }

    bySubject.set(assignment.subjectId, {
      subjectId: assignment.subjectId,
      subjectName: assignment.subjectName,
      classCount: 1,
      totalPeriods: assignment.assignedPeriodsPerWeek,
    });
  });

  return [...bySubject.values()].sort((left, right) => left.subjectName.localeCompare(right.subjectName));
}

function getCompatibilityLevel(
  capabilityLevel: 'primary' | 'allowed' | 'incompatible' | null,
  hasAnyCapability: boolean,
  relatedSubjects: string[]
): { level: SmartCompatibilityLevel; score: number } {
  if (capabilityLevel === 'primary') {
    return { level: 'primary', score: 100 };
  }
  if (capabilityLevel === 'allowed') {
    return { level: 'allowed', score: 90 };
  }
  if (!hasAnyCapability) {
    return { level: 'generalist', score: 80 };
  }
  if (relatedSubjects.length > 0) {
    return { level: 'inferred', score: 70 };
  }
  return { level: 'available', score: 60 };
}

export function useSmartTeacherSelection(
  options: UseSmartTeacherSelectionOptions
): UseSmartTeacherSelectionResult {
  const { subjectId, authorizationSubjectIds, includeOverloaded = true } = options;
  const effectiveAuthorizationSubjectIds = useMemo(
    () => authorizationSubjectIds ?? [subjectId],
    [authorizationSubjectIds, subjectId]
  );

  const {
    data: teachers = [],
    isLoading: isLoadingTeachers,
    error: teachersError,
  } = useTeachers();
  const {
    data: subjects = [],
    isLoading: isLoadingSubjects,
    error: subjectsError,
  } = useSubjects();

  const teacherIds = useMemo(
    () => teachers.filter((teacher) => !teacher.isDeleted).map((teacher) => teacher.id),
    [teachers]
  );
  const {
    workloadByTeacherId,
    isLoading: isLoadingWorkloads,
    error: workloadsError,
  } = useTeacherWorkloadViews(teacherIds);

  const subject = useMemo(() => subjects.find((item) => item.id === subjectId) ?? null, [subjectId, subjects]);

  const smartTeachers = useMemo((): SmartTeacherCompatibility[] => {
    if (!subject || teachers.length === 0) {
      return [];
    }

    const targetDomain = detectSubjectDomain(subject.name);

    return teachers
      .filter((teacher) => !teacher.isDeleted)
      .map((teacher) => {
        const workloadView = workloadByTeacherId.get(teacher.id);
        const capabilities = workloadView?.capabilities ?? [];
        const currentAssignments = summarizeAssignments(workloadView?.assignments ?? []);

        const explicitCapability =
          capabilities.find((capability) => capability.subjectId === subjectId)?.capabilityLevel ??
          null;

        const relatedSubjects = currentAssignments
          .filter(
            (assignment) =>
              assignment.subjectId !== subjectId &&
              detectSubjectDomain(assignment.subjectName) === targetDomain
          )
          .map((assignment) => assignment.subjectName);

        const { level, score } = getCompatibilityLevel(
          explicitCapability,
          capabilities.length > 0,
          relatedSubjects
        );
        const { reasonFa, reasonEn } = getCompatibilityReason(level, relatedSubjects, subject.name);
        const requiresPrimaryAuthorization = effectiveAuthorizationSubjectIds.some(
          (authorizationSubjectId) =>
            capabilities.find(
              (capability) => capability.subjectId === authorizationSubjectId
            )?.capabilityLevel !== 'primary'
        );

        const unavailableCount = parseJsonArray(teacher.unavailable).length;
        const currentWorkload = workloadView?.assignedPeriodsPerWeek ?? 0;
        const maxWorkload = workloadView?.maxPeriodsPerWeek ?? teacher.maxPeriodsPerWeek;
        const availableCapacity =
          workloadView?.remainingCapacityPerWeek ?? teacher.maxPeriodsPerWeek - currentWorkload;
        const canAcceptAssignment = availableCapacity > 0;

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          compatibility: level,
          compatibilityScore: canAcceptAssignment ? score : score - 50,
          currentWorkload,
          maxWorkload,
          availableCapacity: Math.max(0, availableCapacity),
          canAcceptAssignment,
          requiresPrimaryAuthorization,
          unavailableCount,
          hasLimitedAvailability:
            unavailableCount > 0 &&
            (unavailableCount >= maxWorkload * 0.2 || currentWorkload + unavailableCount > maxWorkload),
          currentAssignments,
          relatedSubjectsTaught: relatedSubjects,
          reasonFa,
          reasonEn,
        };
      })
      .sort((left, right) => {
        if (left.canAcceptAssignment !== right.canAcceptAssignment) {
          return left.canAcceptAssignment ? -1 : 1;
        }
        if (left.compatibilityScore !== right.compatibilityScore) {
          return right.compatibilityScore - left.compatibilityScore;
        }
        return right.availableCapacity - left.availableCapacity;
      });
  }, [effectiveAuthorizationSubjectIds, subject, subjectId, teachers, workloadByTeacherId]);

  const filteredTeachers = useMemo(() => {
    if (includeOverloaded) {
      return smartTeachers;
    }
    return smartTeachers.filter((teacher) => teacher.canAcceptAssignment);
  }, [includeOverloaded, smartTeachers]);

  return {
    teachers: filteredTeachers,
    grouped: groupTeachersByCompatibility(filteredTeachers),
    isLoading: isLoadingTeachers || isLoadingSubjects || isLoadingWorkloads,
    error: (teachersError as Error | null) || (subjectsError as Error | null) || workloadsError,
    subject: subject ? { id: subject.id, name: subject.name } : null,
  };
}

export default useSmartTeacherSelection;
