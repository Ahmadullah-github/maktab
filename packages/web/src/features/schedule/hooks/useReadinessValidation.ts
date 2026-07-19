/**
 * Hook for validating readiness before schedule generation
 *
 * Performs pre-generation validation checks to identify potential issues
 * that could cause generation failures or poor quality schedules.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */

import { useClasses } from '@/features/classes';
import { useSubjects } from '@/features/subjects';
import { useTeachers } from '@/features/teachers';
import type { BlockingIssue, ReadinessValidation, ValidationWarning } from '@/types/readiness';
import {
  createBlockingIssue,
  createValidationWarning,
  isCriticalDataReady,
} from '@/types/readiness';
import { useMemo } from 'react';
import { useReadinessData } from './useReadinessData';

/**
 * Return type for useReadinessValidation hook
 */
export interface UseReadinessValidationReturn {
  /** Complete validation result */
  validation: ReadinessValidation;
  /** Whether the system is ready for generation */
  isReady: boolean;
  /** Blocking issues that prevent generation */
  blockingIssues: BlockingIssue[];
  /** Warnings that don't block but should be addressed */
  warnings: ValidationWarning[];
  /** Whether validation is still loading */
  isLoading: boolean;
  /** Error from validation queries */
  error: Error | null;
}

/**
 * Hook for validating readiness before schedule generation
 *
 * Checks for:
 * - Teachers with zero subjects assigned (14.2)
 * - Classes with no subjects configured (14.3)
 * - Period mismatches between required and available (14.4)
 *
 * @returns Object with validation result, warnings, and blocking issues
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 */
export function useReadinessValidation(): UseReadinessValidationReturn {
  // Get readiness data for blocking issue checks
  const { data: readinessData, isLoading: isLoadingReadiness, error: readinessError } = useReadinessData();

  // Fetch detailed data for validation
  const { data: teachers, isLoading: isLoadingTeachers, error: teachersError } = useTeachers();
  const { data: classes, isLoading: isLoadingClasses, error: classesError } = useClasses();
  const { data: subjects, isLoading: isLoadingSubjects, error: subjectsError } = useSubjects();
  const error = (readinessError || teachersError || classesError || subjectsError) as Error | null;

  const isLoading =
    isLoadingReadiness || isLoadingTeachers || isLoadingClasses || isLoadingSubjects;

  // Calculate blocking issues from readiness data
  const blockingIssues = useMemo((): BlockingIssue[] => {
    const issues: BlockingIssue[] = [];

    if (readinessData.teacherCount === 0) {
      issues.push(createBlockingIssue('no_teachers'));
    }
    if (readinessData.classCount === 0) {
      issues.push(createBlockingIssue('no_classes'));
    }
    if (readinessData.subjectCount === 0) {
      issues.push(createBlockingIssue('no_subjects'));
    }

    return issues;
  }, [readinessData]);

  // Calculate validation warnings
  // Requirements: 14.2, 14.3, 14.4
  const warnings = useMemo((): ValidationWarning[] => {
    const warningList: ValidationWarning[] = [];

    // Skip validation if data is not loaded
    if (!teachers || !classes || !subjects) {
      return warningList;
    }

    // Check for teachers with zero subjects (14.2)
    for (const teacher of teachers) {
      const hasSubjects =
        (teacher.primarySubjectIds?.length ?? 0) > 0 ||
        (teacher.allowedSubjectIds?.length ?? 0) > 0;

      if (!hasSubjects) {
        warningList.push(
          createValidationWarning(
            'teacher_no_subjects',
            String(teacher.id),
            teacher.fullName,
            'teacher'
          )
        );
      }
    }

    // Check for classes with no subjects configured (14.3)
    for (const classGroup of classes) {
      const hasSubjects = (classGroup.subjectRequirements?.length ?? 0) > 0;

      if (!hasSubjects) {
        warningList.push(
          createValidationWarning(
            'class_no_subjects',
            String(classGroup.id),
            classGroup.displayName || classGroup.name,
            'class'
          )
        );
      }
    }

    // Check for period mismatches (14.4)
    // Calculate total required periods from all classes
    let totalRequiredPeriods = 0;
    for (const classGroup of classes) {
      if (classGroup.subjectRequirements) {
        for (const req of classGroup.subjectRequirements) {
          totalRequiredPeriods += req.periodsPerWeek;
        }
      }
    }

    // Calculate total available teacher periods
    let totalAvailablePeriods = 0;
    for (const teacher of teachers) {
      totalAvailablePeriods += teacher.maxPeriodsPerWeek;
    }

    // Warn if required periods significantly exceed available
    // Allow some buffer (10%) for flexibility
    if (totalRequiredPeriods > totalAvailablePeriods * 1.1 && totalAvailablePeriods > 0) {
      warningList.push({
        type: 'period_mismatch',
        entityId: 'system',
        entityName: 'سیستم',
        messageFa: `تعداد ساعات مورد نیاز (${totalRequiredPeriods}) بیشتر از ساعات موجود استادان (${totalAvailablePeriods}) است`,
        messageEn: `Required periods (${totalRequiredPeriods}) exceed available teacher periods (${totalAvailablePeriods})`,
        entityType: 'teacher',
      });
    }

    // Check for subjects without any teacher assigned
    const teacherSubjectIds = new Set<number>();
    for (const teacher of teachers) {
      for (const subjectId of teacher.primarySubjectIds || []) {
        teacherSubjectIds.add(subjectId);
      }
      for (const subjectId of teacher.allowedSubjectIds || []) {
        teacherSubjectIds.add(subjectId);
      }
    }

    // Get subjects that are required by classes but have no teacher
    const requiredSubjectIds = new Set<number>();
    for (const classGroup of classes) {
      for (const req of classGroup.subjectRequirements || []) {
        requiredSubjectIds.add(req.subjectId);
      }
    }

    for (const subjectId of requiredSubjectIds) {
      if (!teacherSubjectIds.has(subjectId)) {
        const subject = subjects.find((s) => s.id === subjectId);
        if (subject) {
          warningList.push(
            createValidationWarning(
              'subject_no_teacher',
              String(subject.id),
              subject.name,
              'subject'
            )
          );
        }
      }
    }

    return warningList;
  }, [teachers, classes, subjects]);

  // Determine if system is ready for generation
  const isReady = useMemo(() => {
    // Must have no blocking issues
    if (blockingIssues.length > 0) {
      return false;
    }

    // Must have critical data
    if (!isCriticalDataReady(readinessData)) {
      return false;
    }

    return true;
  }, [blockingIssues, readinessData]);

  // Build complete validation result
  const validation: ReadinessValidation = useMemo(() => {
    return {
      isReady,
      blockingIssues,
      warnings,
    };
  }, [isReady, blockingIssues, warnings]);

  return {
    validation,
    isReady,
    blockingIssues,
    warnings,
    isLoading,
    error,
  };
}
