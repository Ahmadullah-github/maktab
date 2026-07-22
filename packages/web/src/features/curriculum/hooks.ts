import { invalidateAssignmentCaches } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { curriculumApi } from './api';
import type { CurriculumPlanInput } from './types';

export const CURRICULUM_QUERY_KEY = ['school-curriculum'] as const;

export function useSchoolCurriculum() {
  return useQuery({ queryKey: CURRICULUM_QUERY_KEY, queryFn: curriculumApi.school });
}

export function useCurriculumTemplate() {
  return useQuery({ queryKey: [...CURRICULUM_QUERY_KEY, 'template'], queryFn: curriculumApi.template, staleTime: Infinity });
}

export function usePreviewCurriculum() {
  return useMutation({ mutationFn: curriculumApi.preview });
}

export function useApplyCurriculum() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CurriculumPlanInput & { previewToken: string; confirmAssignmentRemoval: boolean }) => curriculumApi.apply(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CURRICULUM_QUERY_KEY });
      invalidateAssignmentCaches(queryClient);
    },
  });
}
