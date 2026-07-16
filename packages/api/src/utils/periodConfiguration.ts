import type { GradeCategory } from '../types/schoolConfig.types';

export interface PeriodConfigurationLike {
  enablePrimary: boolean;
  enableMiddle: boolean;
  enableHigh: boolean;
  daysOfWeek: readonly string[];
  defaultPeriodsPerDay: number;
  dynamicPeriodsEnabled: boolean;
  periodsPerDayMap?: Record<string, number> | null;
  categoryPeriodsEnabled: boolean;
  categoryPeriodsMap?: Record<string, Record<string, number>> | null;
}

export interface CanonicalPeriodConfiguration {
  periodsPerDayMap: Record<string, number>;
  categoryPeriodsPerDayMap?: Record<string, Record<string, number>>;
}

export function getEnabledGradeCategories(
  config: Pick<PeriodConfigurationLike, 'enablePrimary' | 'enableMiddle' | 'enableHigh'>
): GradeCategory[] {
  return [
    ...(config.enablePrimary ? (['Alpha-Primary', 'Beta-Primary'] as const) : []),
    ...(config.enableMiddle ? (['Middle'] as const) : []),
    ...(config.enableHigh ? (['High'] as const) : []),
  ];
}

export function buildCanonicalPeriodConfiguration(
  config: PeriodConfigurationLike
): CanonicalPeriodConfiguration {
  const basePeriodsPerDayMap = Object.fromEntries(
    config.daysOfWeek.map((day) => [
      day,
      config.dynamicPeriodsEnabled
        ? (config.periodsPerDayMap?.[day] ?? config.defaultPeriodsPerDay)
        : config.defaultPeriodsPerDay,
    ])
  );

  if (!config.categoryPeriodsEnabled) {
    return { periodsPerDayMap: basePeriodsPerDayMap };
  }

  const enabledCategories = getEnabledGradeCategories(config);
  if (enabledCategories.length === 0) {
    throw new Error('Category period mode requires at least one enabled grade category');
  }
  const categoryPeriodsPerDayMap = Object.fromEntries(
    enabledCategories.map((category) => [
      category,
      Object.fromEntries(
        config.daysOfWeek.map((day) => [
          day,
          config.categoryPeriodsMap?.[category]?.[day] ?? config.defaultPeriodsPerDay,
        ])
      ),
    ])
  );

  // The flat map is the solver grid width. Category maps remain the actual
  // class boundaries and therefore override dynamic day values.
  const periodsPerDayMap = Object.fromEntries(
    config.daysOfWeek.map((day) => [
      day,
      Math.max(...enabledCategories.map((category) => categoryPeriodsPerDayMap[category][day])),
    ])
  );

  return {
    periodsPerDayMap,
    categoryPeriodsPerDayMap,
  };
}

export function getEffectivePeriodsForClassDay(
  config: CanonicalPeriodConfiguration,
  category: string | null | undefined,
  day: string
): number | null {
  if (config.categoryPeriodsPerDayMap) {
    if (!category) return null;
    return config.categoryPeriodsPerDayMap[category]?.[day] ?? null;
  }
  return config.periodsPerDayMap[day] ?? null;
}

export interface GeneratedPeriodBoundsIssue {
  lessonIndex: number;
  classId: string;
  day: string;
  periodIndex: number;
  periodsThisDay: number | null;
  reason:
    | 'INVALID_SCHEDULE'
    | 'UNKNOWN_CLASS'
    | 'INACTIVE_DAY'
    | 'INVALID_PERIOD_INDEX'
    | 'OUT_OF_BOUNDS'
    | 'BOUND_MISMATCH';
}

interface SolverPeriodInput {
  config: {
    daysOfWeek: string[];
    periodsPerDayMap?: Record<string, number>;
    categoryPeriodsPerDayMap?: Record<string, Record<string, number>>;
  };
  classes: Array<{ id: string | number; category?: string | null }>;
}

function extractGeneratedLessons(value: unknown): unknown[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Array.isArray(data.schedule)) return data.schedule;
  if (Array.isArray(data.lessons)) return data.lessons;
  return null;
}

export function findGeneratedPeriodBoundsIssues(
  generatedData: unknown,
  solverInput: SolverPeriodInput
): GeneratedPeriodBoundsIssue[] {
  const classCategories = new Map(
    solverInput.classes.map((classGroup) => [String(classGroup.id), classGroup.category ?? null])
  );
  const activeDays = new Set(solverInput.config.daysOfWeek);
  const canonical: CanonicalPeriodConfiguration = {
    periodsPerDayMap: solverInput.config.periodsPerDayMap ?? {},
    categoryPeriodsPerDayMap: solverInput.config.categoryPeriodsPerDayMap,
  };

  const lessons = extractGeneratedLessons(generatedData);
  if (!lessons) {
    return [
      {
        lessonIndex: -1,
        classId: '',
        day: '',
        periodIndex: -1,
        periodsThisDay: null,
        reason: 'INVALID_SCHEDULE',
      },
    ];
  }

  return lessons.flatMap((rawLesson, lessonIndex) => {
    if (!rawLesson || typeof rawLesson !== 'object' || Array.isArray(rawLesson)) {
      return [
        {
          lessonIndex,
          classId: '',
          day: '',
          periodIndex: Number.NaN,
          periodsThisDay: null,
          reason: 'INVALID_PERIOD_INDEX' as const,
        },
      ];
    }

    const lesson = rawLesson as Record<string, unknown>;
    const classId = String(lesson.classId ?? '');
    const day = String(lesson.day ?? '');
    const periodIndex = Number(lesson.periodIndex);
    const reportedBound =
      lesson.periodsThisDay === null || lesson.periodsThisDay === undefined
        ? null
        : Number(lesson.periodsThisDay);
    const category = classCategories.get(classId);
    const effectiveBound = getEffectivePeriodsForClassDay(canonical, category, day);

    let reason: GeneratedPeriodBoundsIssue['reason'] | null = null;
    if (!classCategories.has(classId)) reason = 'UNKNOWN_CLASS';
    else if (!activeDays.has(day)) reason = 'INACTIVE_DAY';
    else if (!Number.isInteger(periodIndex) || periodIndex < 0) reason = 'INVALID_PERIOD_INDEX';
    else if (effectiveBound === null || periodIndex >= effectiveBound) reason = 'OUT_OF_BOUNDS';
    else if (reportedBound !== null && reportedBound !== effectiveBound) reason = 'BOUND_MISMATCH';

    return reason
      ? [
          {
            lessonIndex,
            classId,
            day,
            periodIndex,
            periodsThisDay: effectiveBound,
            reason,
          },
        ]
      : [];
  });
}
