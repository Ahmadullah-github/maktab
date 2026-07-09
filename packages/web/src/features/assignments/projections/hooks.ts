import { api } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  AssignmentMatrixView,
  ClassAssignmentView,
  SubjectCoverageView,
  TeacherAssignmentSummaryView,
  TeacherWorkloadView,
} from './types';

export function useAssignmentMatrixView() {
  return useQuery({
    queryKey: QUERY_KEYS.assignmentMatrix,
    queryFn: () => api.assignmentProjections.getAssignmentMatrix() as Promise<AssignmentMatrixView>,
  });
}

export function useClassAssignmentView(classId: number | null) {
  return useQuery({
    queryKey: classId === null ? [...QUERY_KEYS.classAssignmentViews, 'disabled'] : QUERY_KEYS.classAssignmentView(classId),
    queryFn: () =>
      api.assignmentProjections.getClassAssignmentView(classId!) as Promise<ClassAssignmentView>,
    enabled: classId !== null,
  });
}

export function useSubjectCoverageView(subjectId: number | null) {
  return useQuery({
    queryKey:
      subjectId === null ? [...QUERY_KEYS.subjectCoverageViews, 'disabled'] : QUERY_KEYS.subjectCoverageView(subjectId),
    queryFn: () =>
      api.assignmentProjections.getSubjectCoverageView(subjectId!) as Promise<SubjectCoverageView>,
    enabled: subjectId !== null,
  });
}

export function useTeacherWorkloadView(teacherId: number | null) {
  return useQuery({
    queryKey:
      teacherId === null ? [...QUERY_KEYS.teacherWorkloadViews, 'disabled'] : QUERY_KEYS.teacherWorkloadView(teacherId),
    queryFn: () =>
      api.assignmentProjections.getTeacherWorkloadView(teacherId!) as Promise<TeacherWorkloadView>,
    enabled: teacherId !== null,
  });
}

export function useTeacherAssignmentSummaryView(teacherId: number | null) {
  return useQuery({
    queryKey:
      teacherId === null
        ? [...QUERY_KEYS.teacherAssignmentSummaries, 'disabled']
        : QUERY_KEYS.teacherAssignmentSummary(teacherId),
    queryFn: () =>
      api.assignmentProjections.getTeacherAssignmentSummary(
        teacherId!
      ) as Promise<TeacherAssignmentSummaryView>,
    enabled: teacherId !== null,
  });
}

export function useTeacherWorkloadViews(teacherIds: number[]) {
  const uniqueTeacherIds = useMemo(() => [...new Set(teacherIds)].sort((a, b) => a - b), [teacherIds]);

  const results = useQueries({
    queries: uniqueTeacherIds.map((teacherId) => ({
      queryKey: QUERY_KEYS.teacherWorkloadView(teacherId),
      queryFn: () =>
        api.assignmentProjections.getTeacherWorkloadView(teacherId) as Promise<TeacherWorkloadView>,
    })),
  });

  const workloadByTeacherId = useMemo(() => {
    const map = new Map<number, TeacherWorkloadView>();
    uniqueTeacherIds.forEach((teacherId, index) => {
      const data = results[index]?.data;
      if (data) {
        map.set(teacherId, data);
      }
    });
    return map;
  }, [uniqueTeacherIds, results]);

  const isLoading = results.some((result) => result.isLoading);
  const isFetching = results.some((result) => result.isFetching);
  const error = (results.find((result) => result.error)?.error as Error | null | undefined) ?? null;

  return {
    workloads: uniqueTeacherIds
      .map((teacherId) => workloadByTeacherId.get(teacherId))
      .filter((workload): workload is TeacherWorkloadView => workload !== undefined),
    workloadByTeacherId,
    isLoading,
    isFetching,
    error,
  };
}
