import { schoolCurriculumApi } from '@/features/school-curriculum/api';
import { invalidateClassCaches } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import type { SubjectRequirement } from '../types';

export interface ApplyCurriculumResult {
  subjectCount: number;
  totalPeriods: number;
  requirements: SubjectRequirement[];
}

export interface UseCurriculumPopulationOptions {
  classId?: number;
  classGrade: number | null;
  currentRequirements?: SubjectRequirement[];
  onSuccess?: (result: ApplyCurriculumResult) => void;
}

function categoryForGrade(grade: number): string {
  if (grade <= 3) return 'Alpha-Primary';
  if (grade <= 6) return 'Beta-Primary';
  if (grade <= 9) return 'Middle';
  return 'High';
}

function categoryFa(category: string): string {
  return {
    'Alpha-Primary': 'ابتدایی الف (صنف ۱-۳)',
    'Beta-Primary': 'ابتدایی ب (صنف ۴-۶)',
    Middle: 'متوسطه (صنف ۷-۹)',
    High: 'لیسه (صنف ۱۰-۱۲)',
  }[category] ?? '';
}

function toRequirements(subjects: Subject[]): SubjectRequirement[] {
  return subjects.flatMap((subject) =>
    subject.periodsPerWeek
      ? [{ subjectId: subject.id, periodsPerWeek: subject.periodsPerWeek, teacherId: null }]
      : []
  );
}

export function useCurriculumPopulation({
  classId,
  classGrade,
  currentRequirements = [],
  onSuccess,
}: UseCurriculumPopulationOptions) {
  const queryClient = useQueryClient();
  const { data: subjects = [], isLoading: isLoadingSubjects } = useSubjects();
  const { data: plan, isLoading: isLoadingPlan } = useQuery({
    queryKey: ['school-curriculum', 'plan'],
    queryFn: () => schoolCurriculumApi.getPlan(),
  });
  const gradePlan = plan?.grades.find((entry) => entry.grade === classGrade);
  const itemIds = useMemo(
    () => new Set(gradePlan?.items.map((item) => item.id) ?? []),
    [gradePlan?.items]
  );
  const gradeSubjects = useMemo(
    () => subjects.filter((subject) => subject.curriculumItemId && itemIds.has(subject.curriculumItemId)),
    [itemIds, subjects]
  );
  const generatedRequirements = useMemo(() => toRequirements(gradeSubjects), [gradeSubjects]);
  const totalPeriods = generatedRequirements.reduce(
    (sum, requirement) => sum + requirement.periodsPerWeek,
    0
  );
  const category = classGrade ? categoryForGrade(classGrade) : '';
  const curriculumPreview = classGrade && gradePlan
    ? {
        grade: classGrade,
        category,
        categoryFa: categoryFa(category),
        subjectCount: gradePlan.items.length,
        totalPeriods: gradePlan.capacity.totalPeriods,
        expectedPeriods: gradePlan.capacity.weeklyCapacity,
        subjects: gradePlan.items.map((item) => ({
          name: item.name,
          nameEn: item.nameEn ?? '',
          code: item.code,
          periodsPerWeek: item.weeklyPeriods,
          isDifficult: item.isDifficult,
          requiredRoomType: item.requiredRoomType ?? undefined,
        })),
        hasDbSubjects: gradeSubjects.length > 0,
        dbSubjectCount: gradeSubjects.length,
      }
    : null;

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!classId || classGrade === null || !plan) throw new Error('Class and grade are required');
      const preview = await schoolCurriculumApi.preview({
        revision: plan.revision,
        changedGrades: [],
        synchronizeClassIds: [classId],
        proposedClasses: [],
      });
      if (preview.blockers.length > 0) throw new Error(preview.blockers[0].message);
      await schoolCurriculumApi.apply(preview.previewToken, false);
      return { subjectCount: gradeSubjects.length, totalPeriods, requirements: generatedRequirements };
    },
    onSuccess: (result) => {
      invalidateClassCaches(queryClient);
      toast.success('برنامه درسی مکتب همگام شد');
      onSuccess?.(result);
    },
    onError: (error: Error) => toast.error('همگام‌سازی ممکن نشد', { description: error.message }),
  });

  const ensureSubjectsExist = useCallback(async () => gradeSubjects, [gradeSubjects]);
  const generateRequirements = useCallback(() => generatedRequirements, [generatedRequirements]);

  return {
    curriculumPreview,
    gradeSubjects,
    generatedRequirements,
    canApplyCurriculum: classGrade !== null && Boolean(gradePlan),
    hasExistingRequirements: currentRequirements.length > 0,
    isLoading: isLoadingSubjects || isLoadingPlan,
    isApplying: applyMutation.isPending,
    isInsertingSubjects: false,
    applyCurriculum: applyMutation.mutateAsync,
    ensureSubjectsExist,
    generateRequirements,
    applyCurriculumMutation: applyMutation,
  };
}

export default useCurriculumPopulation;
