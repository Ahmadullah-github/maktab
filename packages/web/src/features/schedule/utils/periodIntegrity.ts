import type {
  ClassMetadata,
  PeriodConfiguration,
  ScheduledLesson,
} from '../types';

export interface SchedulePeriodIntegrityIssue {
  lessonIndex: number;
  classId: string;
  day: string;
  periodIndex: number;
  expectedPeriods: number | null;
  reason: 'UNKNOWN_CLASS' | 'UNKNOWN_DAY' | 'OUT_OF_BOUNDS' | 'BOUND_MISMATCH';
}

export function findSchedulePeriodIntegrityIssues(
  lessons: readonly ScheduledLesson[],
  classes: ReadonlyMap<string, ClassMetadata>,
  periodConfiguration: PeriodConfiguration | null | undefined
): SchedulePeriodIntegrityIssue[] {
  if (!periodConfiguration) return [];
  const activeDays = new Set(periodConfiguration.daysOfWeek);

  return lessons.flatMap((lesson, lessonIndex) => {
    const classMetadata = classes.get(lesson.classId);
    const expectedPeriods = periodConfiguration.categoryPeriodsPerDayMap
      ? classMetadata?.category
        ? (periodConfiguration.categoryPeriodsPerDayMap[classMetadata.category]?.[lesson.day] ?? null)
        : null
      : (periodConfiguration.periodsPerDayMap[lesson.day] ?? null);

    let reason: SchedulePeriodIntegrityIssue['reason'] | null = null;
    if (!classMetadata) reason = 'UNKNOWN_CLASS';
    else if (!activeDays.has(lesson.day)) reason = 'UNKNOWN_DAY';
    else if (
      expectedPeriods === null ||
      !Number.isInteger(lesson.periodIndex) ||
      lesson.periodIndex < 0 ||
      lesson.periodIndex >= expectedPeriods
    ) reason = 'OUT_OF_BOUNDS';
    else if (lesson.periodsThisDay !== null && lesson.periodsThisDay !== expectedPeriods) {
      reason = 'BOUND_MISMATCH';
    }

    return reason
      ? [
          {
            lessonIndex,
            classId: lesson.classId,
            day: lesson.day,
            periodIndex: lesson.periodIndex,
            expectedPeriods,
            reason,
          },
        ]
      : [];
  });
}
