/**
 * useCurriculumPopulation Hook
 *
 * Phase 1.1: Curriculum Population Service Hook
 *
 * Provides functionality to populate class subject requirements from
 * the Ministry of Education curriculum based on class grade.
 *
 * Features:
 * - Fetches subjects matching the class grade from API
 * - Maps curriculum to SubjectRequirement[] format
 * - Provides curriculum preview data (subject count, total periods)
 * - Handles loading and error states
 *
 * Requirements: Auto-populate class requirements from curriculum
 */

import { invalidateClassCaches, QUERY_KEYS } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  getCurriculumForGrade,
  getExpectedTotalPeriods,
  getGradeCategory,
  type SubjectDefinition,
} from '../../subjects/data/curriculum';
import { useInsertCurriculum, useSubjects } from '../../subjects/hooks/useSubjects';
import type { Subject } from '../../subjects/types';
import { classesApi } from '../api';
import type { SubjectRequirement } from '../types';
import { logger } from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Curriculum preview information for a grade
 */
export interface CurriculumPreview {
  /** Grade number (1-12) */
  grade: number;
  /** Grade category name */
  category: string;
  /** Category name in Farsi */
  categoryFa: string;
  /** Number of subjects in curriculum */
  subjectCount: number;
  /** Total periods per week */
  totalPeriods: number;
  /** Expected total periods for this grade category */
  expectedPeriods: number;
  /** List of curriculum subjects */
  subjects: SubjectDefinition[];
  /** Whether subjects exist in database for this grade */
  hasDbSubjects: boolean;
  /** Number of subjects in database for this grade */
  dbSubjectCount: number;
}

/**
 * Result of applying curriculum to a class
 */
export interface ApplyCurriculumResult {
  /** Number of subjects applied */
  subjectCount: number;
  /** Total periods per week */
  totalPeriods: number;
  /** The generated subject requirements */
  requirements: SubjectRequirement[];
}

/**
 * Options for the useCurriculumPopulation hook
 */
export interface UseCurriculumPopulationOptions {
  /** Class ID to apply curriculum to */
  classId?: number;
  /** Class grade (1-12) */
  classGrade: number | null;
  /** Current subject requirements (to check if already populated) */
  currentRequirements?: SubjectRequirement[];
  /** Callback after successful curriculum application */
  onSuccess?: (result: ApplyCurriculumResult) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Farsi name for grade category
 */
function getCategoryFarsi(category: string | null): string {
  switch (category) {
    case 'Alpha-Primary':
      return 'ابتدایی الف (صنف ۱-۳)';
    case 'Beta-Primary':
      return 'ابتدایی ب (صنف ۴-۶)';
    case 'Middle':
      return 'متوسطه (صنف ۷-۹)';
    case 'High':
      return 'لیسه (صنف ۱۰-۱۲)';
    default:
      return '';
  }
}

/**
 * Map database subjects to SubjectRequirement format
 */
function mapSubjectsToRequirements(subjects: Subject[]): SubjectRequirement[] {
  return subjects.map((subject) => ({
    subjectId: subject.id,
    periodsPerWeek: subject.periodsPerWeek ?? 3,
    teacherId: null,
  }));
}

/**
 * Calculate total periods from requirements
 */
function calculateTotalPeriods(requirements: SubjectRequirement[]): number {
  return requirements.reduce((sum, req) => sum + req.periodsPerWeek, 0);
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook for populating class subject requirements from Ministry curriculum
 *
 * @param options - Configuration options
 * @returns Object with curriculum data, preview, and apply function
 *
 * @example
 * ```tsx
 * const {
 *   curriculumPreview,
 *   canApplyCurriculum,
 *   applyCurriculum,
 *   isApplying,
 *   ensureSubjectsExist,
 * } = useCurriculumPopulation({
 *   classId: classData.id,
 *   classGrade: classData.grade,
 *   currentRequirements: classData.subjectRequirements,
 *   onSuccess: () => refetch(),
 * });
 * ```
 */
export function useCurriculumPopulation(options: UseCurriculumPopulationOptions) {
  const { classId, classGrade, currentRequirements = [], onSuccess } = options;

  const queryClient = useQueryClient();

  // Fetch all subjects from database
  const { data: allSubjects = [], isLoading: isLoadingSubjects } = useSubjects();

  // Insert curriculum mutation (to ensure subjects exist in DB)
  const insertCurriculumMutation = useInsertCurriculum();

  // Filter subjects for the class grade
  const gradeSubjects = useMemo(() => {
    if (classGrade === null) return [];
    return allSubjects.filter((s) => s.grade === classGrade && !s.isDeleted);
  }, [allSubjects, classGrade]);

  // Get curriculum preview from local data
  const curriculumPreview = useMemo((): CurriculumPreview | null => {
    if (classGrade === null) return null;

    const category = getGradeCategory(classGrade);
    const curriculumSubjects = getCurriculumForGrade(classGrade);
    const expectedPeriods = getExpectedTotalPeriods(classGrade);
    const totalPeriods = curriculumSubjects.reduce((sum, s) => sum + s.periodsPerWeek, 0);

    return {
      grade: classGrade,
      category: category || '',
      categoryFa: getCategoryFarsi(category),
      subjectCount: curriculumSubjects.length,
      totalPeriods,
      expectedPeriods,
      subjects: curriculumSubjects,
      hasDbSubjects: gradeSubjects.length > 0,
      dbSubjectCount: gradeSubjects.length,
    };
  }, [classGrade, gradeSubjects.length]);

  // Check if curriculum can be applied
  const canApplyCurriculum = useMemo(() => {
    return classGrade !== null && classGrade >= 1 && classGrade <= 12;
  }, [classGrade]);

  // Check if class already has requirements
  const hasExistingRequirements = useMemo(() => {
    return currentRequirements.length > 0;
  }, [currentRequirements.length]);

  // Ensure subjects exist in database for the grade
  const ensureSubjectsExist = useCallback(async (): Promise<Subject[]> => {
    if (classGrade === null) {
      throw new Error('Grade is required');
    }

    // Check if subjects already exist
    if (gradeSubjects.length > 0) {
      logger.debug('Subjects already exist for grade', {
        grade: classGrade,
        count: gradeSubjects.length,
      });
      return gradeSubjects;
    }

    // Insert curriculum subjects
    logger.info('Inserting curriculum subjects for grade', { grade: classGrade });
    await insertCurriculumMutation.mutateAsync(classGrade);

    // Invalidate and refetch subjects
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjects });

    // Return the newly inserted subjects (will be available after refetch)
    // For now, we need to fetch them again
    const updatedSubjects = queryClient.getQueryData<Subject[]>(QUERY_KEYS.subjects) || [];
    return updatedSubjects.filter((s) => s.grade === classGrade && !s.isDeleted);
  }, [classGrade, gradeSubjects, insertCurriculumMutation, queryClient]);

  // Apply curriculum mutation
  const applyCurriculumMutation = useMutation({
    mutationFn: async ({ overwrite = false }: { overwrite?: boolean } = {}) => {
      if (!classId) {
        throw new Error('Class ID is required');
      }
      if (classGrade === null) {
        throw new Error('Class grade is required');
      }

      // Step 1: Ensure subjects exist in database
      let subjects = gradeSubjects;
      if (subjects.length === 0) {
        logger.info('No subjects found for grade, inserting curriculum first', {
          grade: classGrade,
        });
        subjects = await ensureSubjectsExist();

        // Refetch to get the latest subjects
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subjects });
        const latestSubjects = queryClient.getQueryData<Subject[]>(QUERY_KEYS.subjects) || [];
        subjects = latestSubjects.filter((s) => s.grade === classGrade && !s.isDeleted);
      }

      if (subjects.length === 0) {
        throw new Error('No subjects found for this grade. Please add subjects first.');
      }

      // Step 2: Map subjects to requirements
      const requirements = mapSubjectsToRequirements(subjects);
      const totalPeriods = calculateTotalPeriods(requirements);

      logger.debug('Applying curriculum to class', {
        classId,
        grade: classGrade,
        subjectCount: requirements.length,
        totalPeriods,
        overwrite,
      });

      // Step 3: Update class with new requirements
      await classesApi.update(classId, {
        subjectRequirements: requirements,
      });

      return {
        subjectCount: requirements.length,
        totalPeriods,
        requirements,
      } as ApplyCurriculumResult;
    },
    onSuccess: (result) => {
      logger.info('Curriculum applied successfully', {
        classId,
        subjectCount: result.subjectCount,
        totalPeriods: result.totalPeriods,
      });

      // Invalidate caches for cross-feature sync
      invalidateClassCaches(queryClient);

      // Show success toast
      toast.success('برنامه درسی با موفقیت اعمال شد', {
        description: `${result.subjectCount} مضمون (${result.totalPeriods} ساعت در هفته)`,
      });

      // Call success callback
      onSuccess?.(result);
    },
    onError: (error: Error) => {
      logger.error('Failed to apply curriculum', { error: error.message, classId });
      toast.error('خطا در اعمال برنامه درسی', {
        description: error.message,
      });
    },
  });

  // Generate requirements without applying (for preview)
  const generateRequirements = useCallback((): SubjectRequirement[] => {
    if (gradeSubjects.length === 0) return [];
    return mapSubjectsToRequirements(gradeSubjects);
  }, [gradeSubjects]);

  return {
    // Data
    curriculumPreview,
    gradeSubjects,
    generatedRequirements: generateRequirements(),

    // State
    canApplyCurriculum,
    hasExistingRequirements,
    isLoading: isLoadingSubjects,
    isApplying: applyCurriculumMutation.isPending || insertCurriculumMutation.isPending,
    isInsertingSubjects: insertCurriculumMutation.isPending,

    // Actions
    applyCurriculum: applyCurriculumMutation.mutateAsync,
    ensureSubjectsExist,
    generateRequirements,

    // Mutation objects (for advanced usage)
    applyCurriculumMutation,
    insertCurriculumMutation,
  };
}

export default useCurriculumPopulation;
