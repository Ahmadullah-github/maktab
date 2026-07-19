/**
 * AvailabilityMatrix Component
 *
 * Visual grid for configuring teacher availability across days and periods.
 * Modern UI matching RoomEditDrawer pattern.
 * - Days as rows
 * - Periods as columns
 * - Supports variable periods per day from periodsPerDayMap
 * - Click to toggle cell state between available/unavailable
 * - Visual states: available (green checkmark), unavailable (red X)
 */

import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UnavailableSlot } from '../types';
import type { WeekDay } from '@/features/school-settings/constants/defaults';

export interface AvailabilityMatrixProps {
  value: UnavailableSlot[];
  onChange: (slots: UnavailableSlot[]) => void;
  disabled?: boolean;
  daysOfWeek: WeekDay[];
  periodsPerDayMap: Record<string, number> | null;
  defaultPeriodsPerDay: number;
  className?: string;
}

/**
 * Check if a slot is in the unavailable list
 */
export function isSlotUnavailable(slots: UnavailableSlot[], day: WeekDay, period: number): boolean {
  return slots.some((slot) => slot.day === day && slot.period === period);
}

/**
 * Toggle a slot's availability state
 */
export function toggleSlot(
  slots: UnavailableSlot[],
  day: WeekDay,
  period: number
): UnavailableSlot[] {
  const isCurrentlyUnavailable = isSlotUnavailable(slots, day, period);

  if (isCurrentlyUnavailable) {
    return slots.filter((slot) => !(slot.day === day && slot.period === period));
  } else {
    return [...slots, { day, period }];
  }
}

/**
 * Get the number of periods for a specific day
 */
export function getPeriodsForDay(
  dayName: string,
  periodsPerDayMap: Record<string, number> | null,
  defaultPeriodsPerDay: number
): number {
  if (periodsPerDayMap && periodsPerDayMap[dayName] !== undefined) {
    return periodsPerDayMap[dayName];
  }
  return defaultPeriodsPerDay;
}

/**
 * Calculate the maximum periods across all days
 */
export function getMaxPeriods(
  daysOfWeek: string[],
  periodsPerDayMap: Record<string, number> | null,
  defaultPeriodsPerDay: number
): number {
  if (!periodsPerDayMap) {
    return defaultPeriodsPerDay;
  }

  let maxPeriods = 0;
  for (const day of daysOfWeek) {
    const periods = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);
    if (periods > maxPeriods) {
      maxPeriods = periods;
    }
  }
  return maxPeriods || defaultPeriodsPerDay;
}

export function AvailabilityMatrix({
  value,
  onChange,
  disabled = false,
  daysOfWeek,
  periodsPerDayMap,
  defaultPeriodsPerDay,
  className,
}: AvailabilityMatrixProps) {
  const { t } = useTranslation();

  const maxPeriods = useMemo(
    () => getMaxPeriods(daysOfWeek, periodsPerDayMap, defaultPeriodsPerDay),
    [daysOfWeek, periodsPerDayMap, defaultPeriodsPerDay]
  );

  const availabilitySummary = useMemo(() => {
    const unavailableKeys = new Set(value.map((slot) => `${slot.day}:${slot.period}`));
    const byDay = daysOfWeek.map((day) => {
      const total = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);
      let unavailable = 0;
      for (let period = 0; period < total; period += 1) {
        if (unavailableKeys.has(`${day}:${period}`)) unavailable += 1;
      }
      return { day, available: total - unavailable, total };
    });
    return {
      byDay,
      available: byDay.reduce((sum, item) => sum + item.available, 0),
      total: byDay.reduce((sum, item) => sum + item.total, 0),
    };
  }, [daysOfWeek, defaultPeriodsPerDay, periodsPerDayMap, value]);

  const handleCellClick = useCallback(
    (day: WeekDay, periodIndex: number) => {
      if (disabled) return;
      const newSlots = toggleSlot(value, day, periodIndex);
      onChange(newSlots);
    },
    [value, onChange, disabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, day: WeekDay, periodIndex: number) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCellClick(day, periodIndex);
      }
    },
    [handleCellClick, disabled]
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-600 px-1">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-slate-300 bg-emerald-50 flex items-center justify-center">
            <span className="text-emerald-500 text-[10px]">✓</span>
          </div>
          <span>{t('teachers.available', 'در دسترس')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-red-300 bg-red-100 flex items-center justify-center">
            <X className="h-3 w-3 text-red-500" />
          </div>
          <span>{t('teachers.unavailable', 'غیرفعال')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center">
            <span className="text-slate-400 text-[10px]">—</span>
          </div>
          <span>{t('teachers.notApplicable', 'ندارد')}</span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-xl border-2 border-slate-300 bg-white shadow-sm">
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr className="bg-linear-to-b from-slate-100 to-slate-50">
              <th className="p-3 text-start text-xs font-bold text-slate-700 border-b-2 border-e-2 border-slate-300 sticky start-0 bg-linear-to-b from-slate-100 to-slate-50 z-10 min-w-[80px]">
                {t('common.day', 'روز')}
              </th>
              {Array.from({ length: maxPeriods }, (_, i) => (
                <th
                  key={i}
                  className="p-2.5 text-center min-w-[44px] text-xs font-bold text-slate-700 border-b-2 border-e-2 border-slate-300 last:border-e-0"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 font-normal">
                      {t('common.period', 'زنگ')}
                    </span>
                    <span className="text-sm">{i + 1}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daysOfWeek.map((day, dayIndex) => {
              const periodsForThisDay = getPeriodsForDay(
                day,
                periodsPerDayMap,
                defaultPeriodsPerDay
              );
              const isLastRow = dayIndex === daysOfWeek.length - 1;
              const isEvenRow = dayIndex % 2 === 0;

              return (
                <tr key={day} className={cn(isEvenRow ? 'bg-white' : 'bg-slate-50/70')}>
                  <td
                    className={cn(
                      'p-3 font-semibold text-xs text-slate-700 border-e-2 border-slate-300 sticky start-0 z-10 min-w-[80px]',
                      isEvenRow ? 'bg-white' : 'bg-slate-50',
                      !isLastRow && 'border-b-2 border-slate-200'
                    )}
                  >
                    <div className="flex flex-col">
                      <span>{t(`days.${day}`)}</span>
                      {periodsForThisDay !== maxPeriods && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({periodsForThisDay} {t('common.periods', 'زنگ')})
                        </span>
                      )}
                    </div>
                  </td>
                  {Array.from({ length: maxPeriods }, (_, periodIndex) => {
                    const isActive = periodIndex < periodsForThisDay;
                    const isUnavailable = isSlotUnavailable(value, day, periodIndex);
                    const isLastCol = periodIndex === maxPeriods - 1;

                    return (
                      <td
                        key={periodIndex}
                        className={cn(
                          'p-0 text-center transition-all duration-150',
                          !isLastRow && 'border-b-2 border-slate-200',
                          !isLastCol && 'border-e-2 border-slate-200',
                          isActive
                            ? isUnavailable
                              ? 'bg-red-100 hover:bg-red-200 cursor-pointer'
                              : 'bg-emerald-50/50 hover:bg-emerald-100 cursor-pointer'
                            : 'bg-slate-100 cursor-not-allowed',
                          disabled && 'cursor-not-allowed opacity-50'
                        )}
                        onClick={() => isActive && handleCellClick(day, periodIndex)}
                        role={isActive ? 'checkbox' : undefined}
                        aria-checked={isActive ? isUnavailable : undefined}
                        tabIndex={isActive && !disabled ? 0 : -1}
                        onKeyDown={(e) => {
                          if (isActive) {
                            handleKeyDown(e, day, periodIndex);
                          }
                        }}
                      >
                        <div className="w-full h-[44px] flex items-center justify-center">
                          {isActive && isUnavailable && (
                            <div className="w-7 h-7 rounded-md bg-red-200 flex items-center justify-center">
                              <X className="h-4 w-4 text-red-600" />
                            </div>
                          )}
                          {isActive && !isUnavailable && (
                            <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center">
                              <span className="text-emerald-500 text-sm">✓</span>
                            </div>
                          )}
                          {!isActive && <span className="text-slate-300 text-lg">—</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t('teachers.availableCapacity', 'ظرفیت در دسترس هفتگی')}</span>
          <span className="font-semibold tabular-nums text-blue-700">
            {availabilitySummary.available}/{availabilitySummary.total}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {availabilitySummary.byDay.map((item) => (
            <span key={item.day}>
              {t(`days.${item.day}`)}: {item.available}/{item.total}
            </span>
          ))}
        </div>
      </div>

      {/* Hint text */}
      <p className="text-xs text-slate-500">
        {t('teachers.availabilityHint', 'برای تغییر وضعیت، روی خانه‌ها کلیک کنید')}
      </p>
    </div>
  );
}

export default AvailabilityMatrix;
