import { api } from '@/lib/api';
import { QUERY_KEYS } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  AssignmentMatrixView,
  ClassAssignmentView,
  SubjectCoverageView,
  TeacherAssignmentSummaryView,
  TeacherWorkloadView,
} from './types';
import {
  assignmentMatrixSchema,
  classAssignmentViewSchema,
  teacherWorkloadViewSchema,
  teacherWorkloadViewsSchema,
} from './schemas';

export function useAssignmentMatrixView() {
  return useQuery({
    queryKey: QUERY_KEYS.assignmentMatrix,
    queryFn: async () => assignmentMatrixSchema.parse(
      await api.assignmentProjections.getAssignmentMatrix()
    ) as AssignmentMatrixView,
  });
}

export function useClassAssignmentView(classId: number | null) {
  return useQuery({
    queryKey: classId === null ? [...QUERY_KEYS.classAssignmentViews, 'disabled'] : QUERY_KEYS.classAssignmentView(classId),
    queryFn: async () => classAssignmentViewSchema.parse(
      await api.assignmentProjections.getClassAssignmentView(classId!)
    ) as ClassAssignmentView,
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
    queryFn: async () => teacherWorkloadViewSchema.parse(
      await api.assignmentProjections.getTeacherWorkloadView(teacherId!)
    ) as TeacherWorkloadView,
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

  const query = useQuery({
    queryKey: QUERY_KEYS.teacherWorkloadViews,
    queryFn: async () => teacherWorkloadViewsSchema.parse(
      await api.assignmentProjections.getTeacherWorkloadViews()
    ) as TeacherWorkloadView[],
  });

  const workloadByTeacherId = useMemo(() => {
    const map = new Map<number, TeacherWorkloadView>();
    const requestedIds = new Set(uniqueTeacherIds);
    for (const workload of query.data ?? []) {
      if (requestedIds.has(workload.teacherId)) map.set(workload.teacherId, workload);
    }
    return map;
  }, [uniqueTeacherIds, query.data]);

  return {
    workloads: uniqueTeacherIds
      .map((teacherId) => workloadByTeacherId.get(teacherId))
      .filter((workload): workload is TeacherWorkloadView => workload !== undefined),
    workloadByTeacherId,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
