import { fetchAPI } from '@/lib/api';
import type {
  CurriculumPlanInput,
  CurriculumPlanPreview,
  CurriculumTemplate,
  SchoolCurriculum,
} from './types';

export const curriculumApi = {
  school: () => fetchAPI<SchoolCurriculum>('/curriculum/school'),
  template: () => fetchAPI<CurriculumTemplate>('/curriculum/template'),
  preview: (input: CurriculumPlanInput) =>
    fetchAPI<CurriculumPlanPreview>('/curriculum/plan/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  apply: (
    input: CurriculumPlanInput & { previewToken: string; confirmAssignmentRemoval: boolean }
  ) =>
    fetchAPI<CurriculumPlanPreview>('/curriculum/plan/apply', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
