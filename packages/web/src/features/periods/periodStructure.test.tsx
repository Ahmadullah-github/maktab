import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { parseSchoolConfigDto } from '@/features/school-settings/schemas/schoolConfigDto.schema';
import { DayOfWeek, type ClassMetadata, type ScheduledLesson } from '@/features/schedule/types';
import { findSchedulePeriodIntegrityIssues } from '@/features/schedule/utils/periodIntegrity';
import periodContract from '../../../../../test/fixtures/period-configuration.contract.json';
import { GRADE_CATEGORIES, type GradeCategoryKey } from './constants/defaults';
import {
  buildEvenlyDistributedBreaks,
  getNextAvailableBreakPeriod,
} from './components/BreakConfiguration';
import { CategoryPeriodsMatrix } from './components/CategoryPeriodsMatrix';
import { periodStructureSchema } from './schemas/periodStructure.schema';
import type { CategoryPeriodsMap, PeriodsPerDayMap } from './types';
import { getEffectivePeriodsForDay, normalizeBreaks } from './utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { exists: () => false },
  }),
}));

const basePeriodValues = {
  revision: 1,
  schoolId: null,
  defaultPeriodsPerDay: 6,
  periodDuration: 45,
  dynamicPeriodsEnabled: false,
  periodsPerDayMap: {},
  categoryPeriodsEnabled: false,
  categoryPeriodsMap: {},
  breaks: [],
  breaksByDay: {},
  prayerBreaksEnabled: false,
  prayerBreaks: [],
};

describe('period structure invariants', () => {
  it('discards invalid values for disabled modes before validation', () => {
    const parsed = periodStructureSchema.parse({
      ...basePeriodValues,
      periodsPerDayMap: { Saturday: 99 },
      categoryPeriodsMap: { High: { Saturday: 99 } },
      prayerBreaks: [{ name: '', time: 'bad', duration: 1 }],
    });

    expect(parsed.periodsPerDayMap).toEqual({});
    expect(parsed.categoryPeriodsMap).toEqual({});
    expect(parsed.prayerBreaks).toEqual([]);
  });

  it('reports active prayer validation with translation keys', () => {
    const result = periodStructureSchema.safeParse({
      ...basePeriodValues,
      prayerBreaksEnabled: true,
      prayerBreaks: [{ name: '', time: 'bad', duration: 1 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toContain(
      'periodStructure.validation.prayerNameRequired'
    );
  });

  it('matches the shared category-authority contract and ignores dynamic grid values', () => {
    const config = periodContract.config;
    const enabledCategories: GradeCategoryKey[] = [
      ...(config.enablePrimary ? (['Alpha-Primary', 'Beta-Primary'] as const) : []),
      ...(config.enableMiddle ? (['Middle'] as const) : []),
      ...(config.enableHigh ? (['High'] as const) : []),
    ];

    for (const [day, expectedPeriods] of Object.entries(periodContract.expected.solverGrid)) {
      expect(
        getEffectivePeriodsForDay(day as WeekDay, {
          defaultPeriods: config.defaultPeriodsPerDay,
          dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
          periodsPerDayMap: config.periodsPerDayMap as PeriodsPerDayMap,
          categoryPeriodsEnabled: config.categoryPeriodsEnabled,
          categoryPeriodsMap: config.categoryPeriodsMap as CategoryPeriodsMap,
          enabledCategories,
        })
      ).toBe(expectedPeriods);
    }
  });

  it('keeps the first duplicate break and handles full/tiny distributions', () => {
    expect(
      normalizeBreaks([
        { afterPeriod: 2, duration: 10 },
        { afterPeriod: 2, duration: 30 },
      ])
    ).toEqual([{ afterPeriod: 2, duration: 10 }]);
    expect(normalizeBreaks(periodContract.duplicateBreaks)).toEqual(
      periodContract.expected.deduplicatedBreaks
    );
    expect(
      getNextAvailableBreakPeriod(
        [
          { afterPeriod: 1, duration: 10 },
          { afterPeriod: 2, duration: 10 },
        ],
        3
      )
    ).toBeNull();
    expect(buildEvenlyDistributedBreaks(4, 3).map((entry) => entry.afterPeriod)).toEqual([1, 2]);
  });

  it('renders category controls when only one category is enabled', () => {
    const highOnly = GRADE_CATEGORIES.filter((category) => category.key === 'High');
    render(
      <CategoryPeriodsMatrix
        enabled
        categoryPeriodsMap={{ High: { Saturday: 6 } }}
        onCategoryPeriodsMapChange={vi.fn()}
        activeDays={['Saturday']}
        defaultPeriods={6}
        filteredCategories={highOnly}
      />
    );

    expect(screen.getByRole('spinbutton')).toHaveAttribute(
      'aria-label',
      'gradeCategories.high - days.saturday'
    );
  });
});

function MessageWithoutText() {
  const form = useForm<{ value: string }>({ defaultValues: { value: '' } });
  useEffect(() => {
    form.setError('value', { type: 'manual' });
  }, [form]);
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="value"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe('defensive UI contracts', () => {
  it('never renders the literal word undefined for message-less field errors', () => {
    render(<MessageWithoutText />);
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('detects a lesson beyond its category boundary', () => {
    const classes = new Map<string, ClassMetadata>([
      [
        'alpha',
        {
          classId: 'alpha',
          className: 'Alpha',
          gradeLevel: 1,
          category: 'Alpha-Primary',
          categoryDari: null,
          studentCount: 20,
          singleTeacherMode: false,
          classTeacherId: null,
          classTeacherName: null,
          classTeacherSubjects: null,
        },
      ],
    ]);
    const lesson = {
      day: DayOfWeek.Saturday,
      periodIndex: 2,
      classId: 'alpha',
      periodsThisDay: 2,
    } as ScheduledLesson;
    const issues = findSchedulePeriodIntegrityIssues([lesson], classes, {
      daysOfWeek: ['Saturday'],
      periodsPerDayMap: { Saturday: 5 },
      totalPeriodsPerWeek: 5,
      hasVariablePeriods: false,
      categoryPeriodsPerDayMap: { 'Alpha-Primary': { Saturday: 2 } },
    });
    expect(issues[0]?.reason).toBe('OUT_OF_BOUNDS');
  });

  it('falls back to the global day boundary when the category map is empty', () => {
    const classes = new Map<string, ClassMetadata>([
      [
        'middle',
        {
          classId: 'middle',
          className: 'Middle',
          gradeLevel: 7,
          category: 'Middle',
          categoryDari: null,
          studentCount: 30,
          singleTeacherMode: false,
          classTeacherId: null,
          classTeacherName: null,
          classTeacherSubjects: null,
        },
      ],
    ]);
    const lesson = {
      day: DayOfWeek.Saturday,
      periodIndex: 5,
      classId: 'middle',
      periodsThisDay: 6,
    } as ScheduledLesson;

    const issues = findSchedulePeriodIntegrityIssues([lesson], classes, {
      daysOfWeek: ['Saturday'],
      periodsPerDayMap: { Saturday: 6 },
      totalPeriodsPerWeek: 6,
      hasVariablePeriods: false,
      categoryPeriodsPerDayMap: {},
    });

    expect(issues).toEqual([]);
  });

  it('rejects malformed school-config DTOs at the frontend boundary', () => {
    expect(() => parseSchoolConfigDto({ periodsPerDayMap: 'not-an-object' })).toThrow();
  });
});
