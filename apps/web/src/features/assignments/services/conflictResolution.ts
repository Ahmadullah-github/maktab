/**
 * Conflict Resolution Service
 * Provides suggestions and actions for resolving assignment conflicts
 *
 * Requirements: 6.5, 6.6
 */

import type { ClassGroup } from '../../classes/types';
import type { Subject } from '../../subjects/types';
import type { Teacher } from '../../teachers/types';
import type { AssignmentConflict, TeacherCompatibility } from '../types';
import { getCompatibleTeachersForSubject } from './assignmentValidation';
import { calculateTeacherWorkload } from './workloadCalculation';

// ============================================================================
// Resolution Types
// ============================================================================

/**
 * Type of resolution action
 */
export type ResolutionActionType =
  | 'reduce_assignments'
  | 'increase_max_periods'
  | 'reassign_to_other_teacher'
  | 'add_subject_to_teacher'
  | 'assign_compatible_teacher'
  | 'check_availability'
  | 'choose_different_time'
  | 'assign_more_teachers'
  | 'remove_duplicate';

/**
 * Resolution suggestion with action
 */
export interface ResolutionSuggestion {
  type: ResolutionActionType;
  description: string;
  descriptionFa: string;
  priority: 'high' | 'medium' | 'low';
  /** Whether this resolution can be applied automatically */
  canAutoApply: boolean;
  /** Data needed to apply the resolution */
  actionData?: {
    teacherId?: number;
    subjectId?: number;
    classId?: number;
    periodsToRemove?: number;
    alternativeTeachers?: TeacherCompatibility[];
  };
}

/**
 * Result of applying a resolution
 */
export interface ResolutionResult {
  success: boolean;
  message: string;
  messageFa: string;
  /** Remaining conflicts after resolution */
  remainingConflicts: AssignmentConflict[];
}

// ============================================================================
// ConflictResolutionService Class
// ============================================================================

/**
 * Conflict Resolution Service
 * Provides methods for suggesting and applying conflict resolutions
 *
 * Requirements: 6.5, 6.6
 */
export class ConflictResolutionService {
  /**
   * Get resolution suggestions for a conflict
   */
  static suggestResolutions(
    conflict: AssignmentConflict,
    teachers: Teacher[],
    subjects: Subject[],
    classes: ClassGroup[]
  ): ResolutionSuggestion[] {
    switch (conflict.type) {
      case 'workload_exceeded':
        return this.suggestWorkloadResolutions(conflict, teachers, subjects, classes);
      case 'subject_incompatible':
        return this.suggestCompatibilityResolutions(conflict, teachers, subjects);
      case 'availability_conflict':
        return this.suggestAvailabilityResolutions(conflict);
      case 'coverage_insufficient':
        return this.suggestCoverageResolutions(conflict, teachers, subjects);
      case 'duplicate_assignment':
        return this.suggestDuplicateResolutions(conflict, teachers);
      default:
        return [];
    }
  }

  /**
   * Suggest resolutions for workload exceeded conflicts
   */
  private static suggestWorkloadResolutions(
    conflict: AssignmentConflict,
    teachers: Teacher[],
    subjects: Subject[],
    classes: ClassGroup[]
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];
    const { teacherId, subjectId } = conflict.affectedEntities;

    if (!teacherId) return suggestions;

    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return suggestions;

    // Calculate how many periods need to be removed
    const workload = calculateTeacherWorkload(teacher, subjects, classes);
    const periodsToRemove = workload.totalPeriods - workload.maxPeriods;

    // Suggestion 1: Reduce assignments
    suggestions.push({
      type: 'reduce_assignments',
      description: `Remove ${periodsToRemove} periods of assignments from this teacher`,
      descriptionFa: `${periodsToRemove} ساعت از تخصیص‌های این معلم را حذف کنید`,
      priority: 'high',
      canAutoApply: false,
      actionData: {
        teacherId,
        periodsToRemove,
      },
    });

    // Suggestion 2: Increase max periods
    suggestions.push({
      type: 'increase_max_periods',
      description: `Increase teacher's maximum hours from ${workload.maxPeriods} to ${workload.totalPeriods}`,
      descriptionFa: `حداکثر ساعات معلم را از ${workload.maxPeriods} به ${workload.totalPeriods} افزایش دهید`,
      priority: 'medium',
      canAutoApply: true,
      actionData: {
        teacherId,
      },
    });

    // Suggestion 3: Reassign to another teacher
    if (subjectId) {
      const alternativeTeachers = getCompatibleTeachersForSubject(teachers, subjectId).filter(
        (t) => t.teacherId !== teacherId && t.canAcceptAssignment
      );

      if (alternativeTeachers.length > 0) {
        suggestions.push({
          type: 'reassign_to_other_teacher',
          description: `Reassign some classes to another qualified teacher`,
          descriptionFa: `برخی صنف‌ها را به معلم واجد شرایط دیگری تخصیص دهید`,
          priority: 'high',
          canAutoApply: false,
          actionData: {
            teacherId,
            subjectId,
            alternativeTeachers,
          },
        });
      }
    }

    return suggestions;
  }

  /**
   * Suggest resolutions for subject incompatibility conflicts
   */
  private static suggestCompatibilityResolutions(
    conflict: AssignmentConflict,
    teachers: Teacher[],
    subjects: Subject[]
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];
    const { teacherId, subjectId } = conflict.affectedEntities;

    if (!teacherId || !subjectId) return suggestions;

    const teacher = teachers.find((t) => t.id === teacherId);
    const subject = subjects.find((s) => s.id === subjectId);

    if (!teacher || !subject) return suggestions;

    // Suggestion 1: Add subject to teacher's allowed subjects
    suggestions.push({
      type: 'add_subject_to_teacher',
      description: `Add "${subject.name}" to ${teacher.fullName}'s allowed subjects`,
      descriptionFa: `"${subject.name}" را به لیست مضامین مجاز ${teacher.fullName} اضافه کنید`,
      priority: 'medium',
      canAutoApply: true,
      actionData: {
        teacherId,
        subjectId,
      },
    });

    // Suggestion 2: Assign to a compatible teacher
    const compatibleTeachers = getCompatibleTeachersForSubject(teachers, subjectId).filter(
      (t) => t.canAcceptAssignment
    );

    if (compatibleTeachers.length > 0) {
      suggestions.push({
        type: 'assign_compatible_teacher',
        description: `Assign to a qualified teacher instead`,
        descriptionFa: `به جای آن به معلم واجد شرایط تخصیص دهید`,
        priority: 'high',
        canAutoApply: false,
        actionData: {
          subjectId,
          alternativeTeachers: compatibleTeachers,
        },
      });
    }

    return suggestions;
  }

  /**
   * Suggest resolutions for availability conflicts
   */
  private static suggestAvailabilityResolutions(
    conflict: AssignmentConflict
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];

    // Suggestion 1: Check availability
    suggestions.push({
      type: 'check_availability',
      description: `Review and update the teacher's availability schedule`,
      descriptionFa: `زمان‌بندی حضور معلم را بررسی و به‌روزرسانی کنید`,
      priority: 'high',
      canAutoApply: false,
      actionData: {
        teacherId: conflict.affectedEntities.teacherId,
      },
    });

    // Suggestion 2: Choose different time
    suggestions.push({
      type: 'choose_different_time',
      description: `Schedule this class at a different time`,
      descriptionFa: `این صنف را در زمان دیگری برنامه‌ریزی کنید`,
      priority: 'medium',
      canAutoApply: false,
      actionData: {
        classId: conflict.affectedEntities.classId,
      },
    });

    return suggestions;
  }

  /**
   * Suggest resolutions for coverage insufficient conflicts
   */
  private static suggestCoverageResolutions(
    conflict: AssignmentConflict,
    teachers: Teacher[],
    subjects: Subject[]
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];
    const { subjectId } = conflict.affectedEntities;

    if (!subjectId) return suggestions;

    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject) return suggestions;

    // Find teachers who can teach this subject
    const compatibleTeachers = getCompatibleTeachersForSubject(teachers, subjectId).filter(
      (t) => t.canAcceptAssignment
    );

    if (compatibleTeachers.length > 0) {
      suggestions.push({
        type: 'assign_more_teachers',
        description: `Assign more teachers to "${subject.name}"`,
        descriptionFa: `معلم‌های بیشتری به "${subject.name}" تخصیص دهید`,
        priority: 'high',
        canAutoApply: false,
        actionData: {
          subjectId,
          alternativeTeachers: compatibleTeachers,
        },
      });
    }

    return suggestions;
  }

  /**
   * Suggest resolutions for duplicate assignment conflicts
   */
  private static suggestDuplicateResolutions(
    conflict: AssignmentConflict,
    teachers: Teacher[]
  ): ResolutionSuggestion[] {
    const suggestions: ResolutionSuggestion[] = [];
    const { subjectId, classId } = conflict.affectedEntities;

    // Find teachers assigned to this subject-class combination
    const assignedTeachers = teachers.filter((t) => {
      // Ensure classAssignments is an array
      const teacherAssignments = Array.isArray(t.classAssignments) ? t.classAssignments : [];
      return teacherAssignments.some((a) => {
        // Ensure classIds is an array
        const assignmentClassIds = Array.isArray(a.classIds) ? a.classIds : [];
        return a.subjectId === subjectId && assignmentClassIds.includes(classId || 0);
      });
    });

    suggestions.push({
      type: 'remove_duplicate',
      description: `Remove duplicate assignments, keeping only one teacher`,
      descriptionFa: `تخصیص‌های تکراری را حذف کنید و فقط یک معلم نگه دارید`,
      priority: 'high',
      canAutoApply: false,
      actionData: {
        subjectId,
        classId,
        alternativeTeachers: assignedTeachers.map((t) => ({
          teacherId: t.id,
          teacherName: t.fullName,
          subjectId: subjectId || 0,
          compatibility: 'primary' as const,
          currentWorkload: 0,
          maxWorkload: t.maxPeriodsPerWeek,
          availableCapacity: 0,
          canAcceptAssignment: true,
        })),
      },
    });

    return suggestions;
  }

  /**
   * Get the best resolution suggestion for a conflict
   */
  static getBestResolution(
    conflict: AssignmentConflict,
    teachers: Teacher[],
    subjects: Subject[],
    classes: ClassGroup[]
  ): ResolutionSuggestion | null {
    const suggestions = this.suggestResolutions(conflict, teachers, subjects, classes);

    if (suggestions.length === 0) return null;

    // Sort by priority and return the first one
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return suggestions[0];
  }

  /**
   * Get all resolutions for multiple conflicts
   */
  static getAllResolutions(
    conflicts: AssignmentConflict[],
    teachers: Teacher[],
    subjects: Subject[],
    classes: ClassGroup[]
  ): Map<AssignmentConflict, ResolutionSuggestion[]> {
    const resolutionMap = new Map<AssignmentConflict, ResolutionSuggestion[]>();

    for (const conflict of conflicts) {
      const suggestions = this.suggestResolutions(conflict, teachers, subjects, classes);
      resolutionMap.set(conflict, suggestions);
    }

    return resolutionMap;
  }

  /**
   * Format resolution suggestion for display
   */
  static formatResolution(suggestion: ResolutionSuggestion, locale: 'fa' | 'en' = 'fa'): string {
    return locale === 'fa' ? suggestion.descriptionFa : suggestion.description;
  }

  /**
   * Get resolution type label
   */
  static getResolutionTypeLabel(type: ResolutionActionType, locale: 'fa' | 'en' = 'fa'): string {
    const labels: Record<ResolutionActionType, { en: string; fa: string }> = {
      reduce_assignments: {
        en: 'Reduce Assignments',
        fa: 'کاهش تخصیص‌ها',
      },
      increase_max_periods: {
        en: 'Increase Max Hours',
        fa: 'افزایش حداکثر ساعات',
      },
      reassign_to_other_teacher: {
        en: 'Reassign Teacher',
        fa: 'تغییر معلم',
      },
      add_subject_to_teacher: {
        en: 'Add Subject',
        fa: 'افزودن مضمون',
      },
      assign_compatible_teacher: {
        en: 'Assign Compatible Teacher',
        fa: 'تخصیص معلم مناسب',
      },
      check_availability: {
        en: 'Check Availability',
        fa: 'بررسی حضور',
      },
      choose_different_time: {
        en: 'Change Time',
        fa: 'تغییر زمان',
      },
      assign_more_teachers: {
        en: 'Assign More Teachers',
        fa: 'تخصیص معلم‌های بیشتر',
      },
      remove_duplicate: {
        en: 'Remove Duplicate',
        fa: 'حذف تکراری',
      },
    };

    return labels[type]?.[locale] || type;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Quick helper to get best resolution for a conflict
 */
export function getBestResolution(
  conflict: AssignmentConflict,
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): ResolutionSuggestion | null {
  return ConflictResolutionService.getBestResolution(conflict, teachers, subjects, classes);
}

/**
 * Quick helper to get all resolutions for a conflict
 */
export function getResolutionsForConflict(
  conflict: AssignmentConflict,
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): ResolutionSuggestion[] {
  return ConflictResolutionService.suggestResolutions(conflict, teachers, subjects, classes);
}

/**
 * Check if a conflict has any auto-applicable resolutions
 */
export function hasAutoApplicableResolution(
  conflict: AssignmentConflict,
  teachers: Teacher[],
  subjects: Subject[],
  classes: ClassGroup[]
): boolean {
  const suggestions = ConflictResolutionService.suggestResolutions(
    conflict,
    teachers,
    subjects,
    classes
  );
  return suggestions.some((s) => s.canAutoApply);
}
