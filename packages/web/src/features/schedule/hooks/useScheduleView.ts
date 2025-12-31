/**
 * Hook for managing schedule view state and filtering
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.3, 9.4
 */

import { useCallback, useMemo, useState } from 'react';

import { GRADE_CATEGORIES } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import type {
  CategoryWithClasses,
  ClassMetadata,
  DayOfWeek,
  ScheduledLesson,
  ScheduleViewType,
  TeacherMetadata,
  UseScheduleViewReturn,
} from '../types';

/**
 * Determines the category key for a class based on grade level
 */
function getCategoryKey(gradeLevel: number | null): string | null {
  if (gradeLevel === null) return null;

  for (const [key, category] of Object.entries(GRADE_CATEGORIES)) {
    if ((category.gradeRange as readonly number[]).includes(gradeLevel)) {
      return key;
    }
  }
  return null;
}

/**
 * Groups classes by grade category
 * Requirement: 6.5
 */
function groupClassesByCategory(classes: ClassMetadata[]): CategoryWithClasses[] {
  const categoryMap = new Map<string, ClassMetadata[]>();

  // Initialize categories in order
  const categoryOrder = ['ALPHA_PRIMARY', 'BETA_PRIMARY', 'MIDDLE', 'HIGH'];
  for (const key of categoryOrder) {
    categoryMap.set(key, []);
  }

  // Group classes by category
  for (const cls of classes) {
    const categoryKey = getCategoryKey(cls.gradeLevel);
    if (categoryKey && categoryMap.has(categoryKey)) {
      categoryMap.get(categoryKey)!.push(cls);
    }
  }

  // Convert to CategoryWithClasses array
  const result: CategoryWithClasses[] = [];
  for (const key of categoryOrder) {
    const category = GRADE_CATEGORIES[key as keyof typeof GRADE_CATEGORIES];
    const classesInCategory = categoryMap.get(key) ?? [];

    // Sort classes by name within each category
    classesInCategory.sort((a, b) => a.className.localeCompare(b.className, 'fa'));

    result.push({
      key,
      name: category.labelEn,
      nameFa: category.labelFa,
      classes: classesInCategory,
    });
  }

  return result;
}

/**
 * Hook for managing schedule view state and filtering lessons
 *
 * Provides:
 * - Current view type (class or teacher)
 * - Current selected entity ID
 * - Filtered lessons for the current view
 * - Available classes grouped by category
 * - Available teachers
 * - Period configuration
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.3, 9.4
 */
export function useScheduleView(initialView: ScheduleViewType = 'class'): UseScheduleViewReturn {
  // Local state for view management
  const [currentView, setCurrentView] = useState<ScheduleViewType>(initialView);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);

  // Get data from store
  const indexes = useScheduleStore((state) => state.indexes);
  const metadata = useScheduleStore((state) => state.metadata);
  const classes = useScheduleStore((state) => state.classes);
  const teachers = useScheduleStore((state) => state.teachers);

  /**
   * Set view type and entity ID
   * Requirement: 6.4
   */
  const setView = useCallback((view: ScheduleViewType, id: string | null) => {
    setCurrentView(view);
    setCurrentViewId(id);
  }, []);

  /**
   * Get available classes grouped by category
   * Requirement: 6.5
   * Memoized for performance (Requirement: 9.3)
   */
  const availableClasses = useMemo<CategoryWithClasses[]>(() => {
    const classArray = Array.from(classes.values());
    return groupClassesByCategory(classArray);
  }, [classes]);

  /**
   * Get available teachers sorted by name
   * Requirement: 6.6
   * Memoized for performance (Requirement: 9.3)
   */
  const availableTeachers = useMemo<TeacherMetadata[]>(() => {
    const teacherArray = Array.from(teachers.values());
    return teacherArray.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'fa'));
  }, [teachers]);

  /**
   * Filter lessons based on current view
   * Requirement: 6.3, 6.7
   * Memoized for performance (Requirement: 9.4)
   */
  const filteredLessons = useMemo<ScheduledLesson[]>(() => {
    if (currentViewId === null) {
      return [];
    }

    if (currentView === 'class') {
      // Get lessons from byClass index (Requirement: 6.7)
      return indexes.byClass.get(currentViewId) ?? [];
    } else {
      // Get lessons from byTeacher index (Requirement: 6.7)
      return indexes.byTeacher.get(currentViewId) ?? [];
    }
  }, [currentView, currentViewId, indexes.byClass, indexes.byTeacher]);

  /**
   * Get periods per day from metadata
   * Requirement: 6.8
   * Memoized for performance
   */
  const periodsPerDay = useMemo<Map<DayOfWeek, number>>(() => {
    const periodMap = new Map<DayOfWeek, number>();

    if (metadata?.periodConfiguration?.periodsPerDayMap) {
      for (const [day, periods] of Object.entries(metadata.periodConfiguration.periodsPerDayMap)) {
        periodMap.set(day as DayOfWeek, periods);
      }
    }

    return periodMap;
  }, [metadata?.periodConfiguration?.periodsPerDayMap]);

  /**
   * Get days from metadata
   * Requirement: 6.8
   * Memoized for performance
   */
  const days = useMemo<DayOfWeek[]>(() => {
    if (metadata?.periodConfiguration?.daysOfWeek) {
      return metadata.periodConfiguration.daysOfWeek as DayOfWeek[];
    }
    return [];
  }, [metadata?.periodConfiguration?.daysOfWeek]);

  return {
    currentView,
    currentViewId,
    filteredLessons,
    setView,
    availableClasses,
    availableTeachers,
    periodsPerDay,
    days,
  };
}
