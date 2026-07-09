import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WeekDay } from '@/features/school-settings/constants/defaults';
import type { CategoryPeriodsMap, PeriodsPerDayMap } from '../types';
import { BreakConfiguration } from '../components/BreakConfiguration';

describe('BreakConfiguration', () => {
  it('renders break slots up to the maximum effective periods across active days', () => {
    const activeDays: WeekDay[] = ['Saturday', 'Thursday'];
    const periodsPerDayMap: PeriodsPerDayMap = {
      Saturday: 8,
      Thursday: 2,
    };
    const categoryPeriodsMap: CategoryPeriodsMap = {};

    const { container } = render(
      <BreakConfiguration
        breaks={[{ afterPeriod: 2, duration: 15 }]}
        breaksByDay={{}}
        onBreaksChange={vi.fn()}
        onBreaksByDayChange={vi.fn()}
        activeDays={activeDays}
        defaultPeriods={7}
        dynamicPeriodsEnabled
        periodsPerDayMap={periodsPerDayMap}
        categoryPeriodsEnabled={false}
        categoryPeriodsMap={categoryPeriodsMap}
      />
    );

    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(7);
  });
});
