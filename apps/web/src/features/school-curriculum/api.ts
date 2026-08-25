import { fetchAPI } from '@/lib/api';
import type {
  CurriculumApplyResult,
  CurriculumPlan,
  CurriculumPreview,
  CurriculumPreviewRequest,
} from './types';

export const schoolCurriculumApi = {
  getPlan: (schoolId: number | null = null) =>
    fetchAPI<CurriculumPlan>(`/curriculum/plan${schoolId === null ? '' : `?schoolId=${schoolId}`}`),
  getAfghanistanTemplate: (schoolId: number | null = null) =>
    fetchAPI<{
      activeGrades: number[];
      grades: Array<{ grade: number; items: CurriculumPlan['grades'][number]['items'] }>;
    }>(`/curriculum/templates/afghanistan${schoolId === null ? '' : `?schoolId=${schoolId}`}`),
  preview: (request: CurriculumPreviewRequest) =>
    fetchAPI<CurriculumPreview>('/curriculum/plan/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  apply: (previewToken: string, confirmAssignmentRemoval: boolean) =>
    fetchAPI<CurriculumApplyResult>('/curriculum/plan/apply', {
      method: 'POST',
      body: JSON.stringify({ previewToken, confirmAssignmentRemoval }),
    }),
};
