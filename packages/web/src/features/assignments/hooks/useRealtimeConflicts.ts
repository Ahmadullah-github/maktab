/**
 * useRealtimeConflicts Hook
 *
 * Provides real-time conflict detection with immediate checking
 * on assignment changes and conflict resolution suggestions.
 *
 * Requirements: 6.6
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import { detectAllConflicts, detectTeacherConflicts } from '../services/conflictDetection';
import type { AssignmentConflict, ConflictType } from '../types';
import { QUERY_KEYS } from './useRealtimeWorkload';

/**
 * Conflict resolution suggestion
 */
export interface ConflictResolution {
  type: string;
  description: string;
  descriptionFa: string;
  action: () => Promise<void>;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Options for the useRealtimeConflicts hook
 */
export interface UseRealtimeConflictsOptions {
  /** Callback when conflicts are detected */
  onConflictsDetected?: (conflicts: AssignmentConflict[]) => void;
  /** Callback when conflicts are resolved */
  onConflictsResolved?: (resolvedConflicts: AssignmentConflict[]) => void;
  /** Auto-check conflicts on mount */
  autoCheck?: boolean;
}

/**
 * Result of the useRealtimeConflicts hook
 */
export interface UseRealtimeConflictsResult {
  /** Current detected conflicts */
  conflicts: AssignmentConflict[];
  /** Check conflicts for a specific teacher */
  checkTeacherConflicts: (teacher: Teacher) => AssignmentConflict[];
  /** Check all conflicts in the system */
  checkAllConflicts: () => AssignmentConflict[];
  /** Preview conflicts after adding an assignment */
  previewConflictsWithAssignment: (
    teacher: Teacher,
    subjectId: number,
    classIds: number[]
  ) => AssignmentConflict[];
  /** Get resolution suggestions for a conflict */
  getResolutionSuggestions: (conflict: AssignmentConflict) => ConflictResolution[];
  /** Clear all conflicts */
  clearConflicts: () => void;
  /** Refresh conflicts from current data */
  refreshConflicts: () => void;
  /** Check if there are any error-level conflicts */
  hasErrors: boolean;
  /** Check if there are any warning-level conflicts */
  hasWarnings: boolean;
  /** Get conflicts by type */
  getConflictsByType: (type: ConflictType) => AssignmentConflict[];
  /** Get conflicts for a specific teacher */
  getConflictsForTeacher: (teacherId: number) => AssignmentConflict[];
  /** Get conflicts for a specific subject */
  getConflictsForSubject: (subjectId: number) => AssignmentConflict[];
  /** Get conflicts for a specific class */
  getConflictsForClass: (classId: number) => AssignmentConflict[];
}

/**
 * Hook for real-time conflict detection with resolution suggestions
 *
 * Provides immediate conflict checking on assignment changes
 * and updates conflict indicators across all related components.
 *
 * @param options - Configuration options
 * @returns Conflict detection and resolution functions
 */
export function useRealtimeConflicts(
  options: UseRealtimeConflictsOptions = {}
): UseRealtimeConflictsResult {
  const { onConflictsDetected, onConflictsResolved } = options;

  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<AssignmentConflict[]>([]);

  /**
   * Get cached data from query cache
   */
  const getCachedData = useCallback(() => {
    const teachers = queryClient.getQueryData<Teacher[]>(QUERY_KEYS.teachers) ?? [];
    const subjects = queryClient.getQueryData<Subject[]>(QUERY_KEYS.subjects) ?? [];
    const classes = queryClient.getQueryData<ClassGroup[]>(QUERY_KEYS.classes) ?? [];

    return {
      teachers: teachers.filter((t) => !(t as { isDeleted?: boolean }).isDeleted),
      subjects: subjects.filter((s) => !s.isDeleted),
      classes: classes.filter((c) => !c.isDeleted),
    };
  }, [queryClient]);

  /**
   * Check conflicts for a specific teacher
   */
  const checkTeacherConflicts = useCallback(
    (teacher: Teacher): AssignmentConflict[] => {
      const { subjects, classes } = getCachedData();
      const teacherConflicts = detectTeacherConflicts(teacher, subjects, classes);

      // Update state with new conflicts
      setConflicts((prev) => {
        // Remove old conflicts for this teacher
        const filtered = prev.filter((c) => c.affectedEntities.teacherId !== teacher.id);
        const newConflicts = [...filtered, ...teacherConflicts];

        // Trigger callback if conflicts changed
        if (teacherConflicts.length > 0 && onConflictsDetected) {
          onConflictsDetected(teacherConflicts);
        }

        return newConflicts;
      });

      return teacherConflicts;
    },
    [getCachedData, onConflictsDetected]
  );

  /**
   * Check all conflicts in the system
   */
  const checkAllConflicts = useCallback((): AssignmentConflict[] => {
    const { teachers, subjects, classes } = getCachedData();
    const allConflicts = detectAllConflicts(teachers, subjects, classes);

    setConflicts(allConflicts);

    if (allConflicts.length > 0 && onConflictsDetected) {
      onConflictsDetected(allConflicts);
    }

    return allConflicts;
  }, [getCachedData, onConflictsDetected]);

  /**
   * Preview conflicts after adding an assignment
   */
  const previewConflictsWithAssignment = useCallback(
    (teacher: Teacher, subjectId: number, classIds: number[]): AssignmentConflict[] => {
      const { subjects, classes } = getCachedData();

      // Create a temporary teacher with the new assignment
      const tempTeacher: Teacher = {
        ...teacher,
        classAssignments: [...teacher.classAssignments, { subjectId, classIds }],
      };

      // Check conflicts for the temporary teacher
      return detectTeacherConflicts(tempTeacher, subjects, classes);
    },
    [getCachedData]
  );

  /**
   * Get resolution suggestions for a conflict
   */
  const getResolutionSuggestions = useCallback(
    (conflict: AssignmentConflict): ConflictResolution[] => {
      const suggestions: ConflictResolution[] = [];

      switch (conflict.type) {
        case 'workload_exceeded':
          suggestions.push(
            {
              type: 'reduce_assignments',
              description: 'Reduce the number of assigned classes',
              descriptionFa: 'کاهش تعداد صنف‌های تخصیص یافته',
              action: async () => {
                // This would be implemented by the calling component
                console.log('Reduce assignments action');
              },
              priority: 'high',
            },
            {
              type: 'increase_max_periods',
              description: "Increase the teacher's maximum periods",
              descriptionFa: 'افزایش حداکثر ساعات معلم',
              action: async () => {
                console.log('Increase max periods action');
              },
              priority: 'medium',
            },
            {
              type: 'reassign_to_other_teacher',
              description: 'Reassign some classes to another teacher',
              descriptionFa: 'تخصیص برخی صنف‌ها به معلم دیگر',
              action: async () => {
                console.log('Reassign action');
              },
              priority: 'medium',
            }
          );
          break;

        case 'subject_incompatible':
          suggestions.push(
            {
              type: 'add_subject_to_teacher',
              description: "Add the subject to the teacher's allowed subjects",
              descriptionFa: 'افزودن مضمون به لیست مجاز معلم',
              action: async () => {
                console.log('Add subject action');
              },
              priority: 'high',
            },
            {
              type: 'assign_compatible_teacher',
              description: 'Assign a compatible teacher instead',
              descriptionFa: 'تخصیص معلم مناسب',
              action: async () => {
                console.log('Assign compatible teacher action');
              },
              priority: 'high',
            }
          );
          break;

        case 'coverage_insufficient':
          suggestions.push({
            type: 'assign_teachers',
            description: 'Assign teachers to unassigned classes',
            descriptionFa: 'تخصیص معلم به صنف‌های بدون معلم',
            action: async () => {
              console.log('Assign teachers action');
            },
            priority: 'high',
          });
          break;

        case 'duplicate_assignment':
          suggestions.push({
            type: 'remove_duplicate',
            description: 'Remove duplicate assignment, keeping only one teacher',
            descriptionFa: 'حذف تخصیص تکراری و نگه داشتن یک معلم',
            action: async () => {
              console.log('Remove duplicate action');
            },
            priority: 'high',
          });
          break;

        default:
          break;
      }

      return suggestions;
    },
    []
  );

  /**
   * Clear all conflicts
   */
  const clearConflicts = useCallback(() => {
    const previousConflicts = conflicts;
    setConflicts([]);

    if (previousConflicts.length > 0 && onConflictsResolved) {
      onConflictsResolved(previousConflicts);
    }
  }, [conflicts, onConflictsResolved]);

  /**
   * Refresh conflicts from current data
   */
  const refreshConflicts = useCallback(() => {
    checkAllConflicts();
  }, [checkAllConflicts]);

  /**
   * Check if there are any error-level conflicts
   */
  const hasErrors = useMemo(() => {
    return conflicts.some((c) => c.severity === 'error');
  }, [conflicts]);

  /**
   * Check if there are any warning-level conflicts
   */
  const hasWarnings = useMemo(() => {
    return conflicts.some((c) => c.severity === 'warning');
  }, [conflicts]);

  /**
   * Get conflicts by type
   */
  const getConflictsByType = useCallback(
    (type: ConflictType): AssignmentConflict[] => {
      return conflicts.filter((c) => c.type === type);
    },
    [conflicts]
  );

  /**
   * Get conflicts for a specific teacher
   */
  const getConflictsForTeacher = useCallback(
    (teacherId: number): AssignmentConflict[] => {
      return conflicts.filter((c) => c.affectedEntities.teacherId === teacherId);
    },
    [conflicts]
  );

  /**
   * Get conflicts for a specific subject
   */
  const getConflictsForSubject = useCallback(
    (subjectId: number): AssignmentConflict[] => {
      return conflicts.filter((c) => c.affectedEntities.subjectId === subjectId);
    },
    [conflicts]
  );

  /**
   * Get conflicts for a specific class
   */
  const getConflictsForClass = useCallback(
    (classId: number): AssignmentConflict[] => {
      return conflicts.filter((c) => c.affectedEntities.classId === classId);
    },
    [conflicts]
  );

  return useMemo(
    () => ({
      conflicts,
      checkTeacherConflicts,
      checkAllConflicts,
      previewConflictsWithAssignment,
      getResolutionSuggestions,
      clearConflicts,
      refreshConflicts,
      hasErrors,
      hasWarnings,
      getConflictsByType,
      getConflictsForTeacher,
      getConflictsForSubject,
      getConflictsForClass,
    }),
    [
      conflicts,
      checkTeacherConflicts,
      checkAllConflicts,
      previewConflictsWithAssignment,
      getResolutionSuggestions,
      clearConflicts,
      refreshConflicts,
      hasErrors,
      hasWarnings,
      getConflictsByType,
      getConflictsForTeacher,
      getConflictsForSubject,
      getConflictsForClass,
    ]
  );
}

export default useRealtimeConflicts;
