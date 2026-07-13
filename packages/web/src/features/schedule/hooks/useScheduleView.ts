/**
 * Hook for managing schedule view state and filtering
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.3, 9.4
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { GRADE_CATEGORIES } from '../constants';
import { useScheduleStore } from '../stores/scheduleStore';
import { DayOfWeek } from '../types';
import type {
  CategoryWithClasses,
  ClassMetadata,
  ScheduledLesson,
  ScheduleViewType,
  TeacherMetadata,
  UseScheduleViewReturn,
} from '../types';
import { cloneClassMetadata, cloneTeacherMetadata } from '../utils/metadataCloners';

/**
 * Fixed display order for grade categories
 */
type GradeCategoryKey = keyof typeof GRADE_CATEGORIES;
const CATEGORY_ORDER: GradeCategoryKey[] = ['ALPHA_PRIMARY', 'BETA_PRIMARY', 'MIDDLE', 'HIGH'];
const DAY_ORDER: DayOfWeek[] = [
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
];

/**
 * Normalizes category values from metadata into UI category keys
 */
function normalizeCategoryKey(category: string | null): GradeCategoryKey | null {
  if (!category) return null;

  const normalized = category.trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (normalized in GRADE_CATEGORIES) {
    return normalized as GradeCategoryKey;
  }

  return null;
}

/**
 * Determines the category key for a class based on metadata category or grade level
 */
function getCategoryKey(
  classMetadata: Pick<ClassMetadata, 'category' | 'gradeLevel'>
): GradeCategoryKey | null {
  const metadataCategory = normalizeCategoryKey(classMetadata.category);
  if (metadataCategory) return metadataCategory;

  if (classMetadata.gradeLevel === null) return null;

  for (const [key, category] of Object.entries(GRADE_CATEGORIES)) {
    if ((category.gradeRange as readonly number[]).includes(classMetadata.gradeLevel)) {
      return key as GradeCategoryKey;
    }
  }

  return null;
}

/**
 * Resolves the period-configuration category name used in solver metadata.
 */
function getPeriodConfigurationCategoryName(
  classMetadata: Pick<ClassMetadata, 'category' | 'gradeLevel'>
): string | null {
  const metadataCategory = normalizeCategoryKey(classMetadata.category);
  if (metadataCategory) {
    return GRADE_CATEGORIES[metadataCategory].labelEn;
  }

  if (classMetadata.category && classMetadata.category.trim().length > 0) {
    return classMetadata.category.trim();
  }

  if (classMetadata.gradeLevel === null) {
    return null;
  }

  for (const category of Object.values(GRADE_CATEGORIES)) {
    if ((category.gradeRange as readonly number[]).includes(classMetadata.gradeLevel)) {
      return category.labelEn;
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
  for (const key of CATEGORY_ORDER) {
    categoryMap.set(key, []);
  }

  // Group classes by category
  for (const cls of classes) {
    const categoryKey = getCategoryKey(cls);
    if (categoryKey && categoryMap.has(categoryKey)) {
      categoryMap.get(categoryKey)!.push(cls);
    }
  }

  // Convert to CategoryWithClasses array
  const result: CategoryWithClasses[] = [];
  for (const key of CATEGORY_ORDER) {
    const category = GRADE_CATEGORIES[key];
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
  const lessons = useScheduleStore((state) => state.lessons);

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
    const classArray = Array.from(classes.values(), cloneClassMetadata);
    return groupClassesByCategory(classArray);
  }, [classes]);

  /**
   * Get available teachers sorted by name
   * Requirement: 6.6
   * Memoized for performance (Requirement: 9.3)
   */
  const availableTeachers = useMemo<TeacherMetadata[]>(() => {
    const teacherArray = Array.from(teachers.values(), cloneTeacherMetadata);
    return teacherArray.sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'fa'));
  }, [teachers]);

  /**
   * Keep the current selection aligned with the available entities.
   * Class view should always land on a valid class, while teacher view keeps
   * its intentional "all teachers" null state unless the current teacher disappears.
   */
  useEffect(() => {
    if (currentView === 'class') {
      const availableClassIds = availableClasses.flatMap((category) =>
        category.classes.map((classMetadata) => classMetadata.classId)
      );

      if (availableClassIds.length === 0) {
        if (currentViewId !== null) {
          setCurrentViewId(null);
        }
        return;
      }

      if (currentViewId === null || !availableClassIds.includes(currentViewId)) {
        setCurrentViewId(availableClassIds[0]);
      }
      return;
    }

    if (currentViewId !== null && !teachers.has(currentViewId)) {
      setCurrentViewId(null);
    }
  }, [availableClasses, currentView, currentViewId, teachers]);

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
    const periodConfiguration = metadata?.periodConfiguration;

    if (
      currentView === 'class' &&
      currentViewId !== null &&
      periodConfiguration?.categoryPeriodsPerDayMap
    ) {
      const selectedClass = classes.get(currentViewId);
      const categoryName = selectedClass
        ? getPeriodConfigurationCategoryName(selectedClass)
        : null;
      const categoryPeriods = categoryName
        ? periodConfiguration.categoryPeriodsPerDayMap[categoryName]
        : undefined;

      if (categoryPeriods && Object.keys(categoryPeriods).length > 0) {
        for (const [day, periods] of Object.entries(categoryPeriods)) {
          periodMap.set(day as DayOfWeek, periods);
        }

        return periodMap;
      }
    }

    if (
      periodConfiguration?.periodsPerDayMap &&
      Object.keys(periodConfiguration.periodsPerDayMap).length > 0
    ) {
      for (const [day, periods] of Object.entries(periodConfiguration.periodsPerDayMap)) {
        periodMap.set(day as DayOfWeek, periods);
      }

      return periodMap;
    }

    for (const lesson of lessons) {
      const derivedPeriods = lesson.periodsThisDay ?? lesson.periodIndex + 1;
      const currentPeriods = periodMap.get(lesson.day) ?? 0;
      if (derivedPeriods > currentPeriods) {
        periodMap.set(lesson.day, derivedPeriods);
      }
    }

    return periodMap;
  }, [
    classes,
    currentView,
    currentViewId,
    lessons,
    metadata?.periodConfiguration,
  ]);

  /**
   * Get days from metadata
   * Requirement: 6.8
   * Memoized for performance
   */
  const days = useMemo<DayOfWeek[]>(() => {
    if (
      metadata?.periodConfiguration?.daysOfWeek &&
      metadata.periodConfiguration.daysOfWeek.length > 0
    ) {
      return metadata.periodConfiguration.daysOfWeek as DayOfWeek[];
    }

    const lessonDays = new Set<DayOfWeek>(lessons.map((lesson) => lesson.day));
    return DAY_ORDER.filter((day) => lessonDays.has(day));
  }, [lessons, metadata?.periodConfiguration?.daysOfWeek]);

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
