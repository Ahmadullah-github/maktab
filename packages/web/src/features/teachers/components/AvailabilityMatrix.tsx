/**
 * AvailabilityMatrix Component
 *
 * Visual grid for configuring teacher availability across days and periods.
 * - Days as columns (RTL: right to left)
 * - Periods as rows based on SchoolConfig
 * - Supports variable periods per day from periodsPerDayMap
 * - Click to toggle cell state between available/unavailable
 * - Visual states: available (green), unavailable (red)
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { cn } from '@/lib/utils';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UnavailableSlot } from '../types';

export interface AvailabilityMatrixProps {
  /** Array of unavailable slots (day-period combinations) */
  value: UnavailableSlot[];
  /** Callback when slots change */
  onChange: (slots: UnavailableSlot[]) => void;
  /** Whether the matrix is disabled/read-only */
  disabled?: boolean;
  /** Days of the week from SchoolConfig */
  daysOfWeek: string[];
  /** Map of day name to number of periods (for variable periods per day) */
  periodsPerDayMap: Record<string, number> | null;
  /** Default periods per day when not specified in map */
  defaultPeriodsPerDay: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Legend component explaining the color coding
 */
function AvailabilityLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded bg-green-100 border border-green-300" />
        <span>{t('teachers.available')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
        <span>{t('teachers.unavailable')}</span>
      </div>
    </div>
  );
}

/**
 * Check if a slot is in the unavailable list
 */
export function isSlotUnavailable(slots: UnavailableSlot[], day: number, period: number): boolean {
  return slots.some((slot) => slot.day === day && slot.period === period);
}

/**
 * Toggle a slot's availability state
 * Returns a new array with the slot added or removed
 */
export function toggleSlot(
  slots: UnavailableSlot[],
  day: number,
  period: number
): UnavailableSlot[] {
  const isCurrentlyUnavailable = isSlotUnavailable(slots, day, period);

  if (isCurrentlyUnavailable) {
    // Remove the slot (make available)
    return slots.filter((slot) => !(slot.day === day && slot.period === period));
  } else {
    // Add the slot (make unavailable)
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

  let maxPeriods = defaultPeriodsPerDay;
  for (const day of daysOfWeek) {
    const periods = getPeriodsForDay(day, periodsPerDayMap, defaultPeriodsPerDay);
    if (periods > maxPeriods) {
      maxPeriods = periods;
    }
  }
  return maxPeriods;
}

/**
 * AvailabilityMatrix displays a grid for configuring teacher availability
 *
 * @example
 * ```tsx
 * <AvailabilityMatrix
 *   value={unavailableSlots}
 *   onChange={setUnavailableSlots}
 *   daysOfWeek={['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']}
 *   periodsPerDayMap={null}
 *   defaultPeriodsPerDay={7}
 * />
 * ```
 */
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

  // Calculate the maximum number of periods to display
  const maxPeriods = useMemo(
    () => getMaxPeriods(daysOfWeek, periodsPerDayMap, defaultPeriodsPerDay),
    [daysOfWeek, periodsPerDayMap, defaultPeriodsPerDay]
  );

  // Handle cell click to toggle availability
  const handleCellClick = useCallback(
    (dayIndex: number, periodIndex: number) => {
      if (disabled) return;
      const newSlots = toggleSlot(value, dayIndex, periodIndex);
      onChange(newSlots);
    },
    [value, onChange, disabled]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, dayIndex: number, periodIndex: number) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleCellClick(dayIndex, periodIndex);
      }
    },
    [handleCellClick, disabled]
  );

  // Generate period rows (0 to maxPeriods - 1)
  const periodRows = useMemo(() => {
    return Array.from({ length: maxPeriods }, (_, i) => i);
  }, [maxPeriods]);

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" role="grid">
          <thead>
            <tr>
              {/* Period column header */}
              <th className="p-2 text-center text-xs font-medium text-muted-foreground border bg-muted/30 min-w-[60px]">
                {t('common.period')}
              </th>
              {/* Day column headers - RTL order (days array is already in correct order) */}
              {daysOfWeek.map((day, dayIndex) => (
                <th
                  key={dayIndex}
                  className="p-2 text-center text-xs font-medium text-muted-foreground border bg-muted/30 min-w-[80px]"
                >
                  {t(`days.${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodRows.map((periodIndex) => (
              <tr key={periodIndex}>
                {/* Period number cell */}
                <td className="p-2 text-center text-xs font-medium text-muted-foreground border bg-muted/20">
                  {t('common.periodNumber', { number: periodIndex + 1 })}
                </td>
                {/* Day cells */}
                {daysOfWeek.map((day, dayIndex) => {
                  const periodsForThisDay = getPeriodsForDay(
                    day,
                    periodsPerDayMap,
                    defaultPeriodsPerDay
                  );
                  const isCellActive = periodIndex < periodsForThisDay;
                  const isUnavailable = isSlotUnavailable(value, dayIndex, periodIndex);

                  // If this period doesn't exist for this day, render an inactive cell
                  if (!isCellActive) {
                    return (
                      <td
                        key={dayIndex}
                        className="p-2 border bg-gray-50 dark:bg-gray-900"
                        aria-hidden="true"
                      />
                    );
                  }

                  return (
                    <td
                      key={dayIndex}
                      className={cn(
                        'p-2 border cursor-pointer transition-colors select-none',
                        isUnavailable
                          ? 'bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50'
                          : 'bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50',
                        disabled && 'cursor-not-allowed opacity-60'
                      )}
                      onClick={() => handleCellClick(dayIndex, periodIndex)}
                      onKeyDown={(e) => handleKeyDown(e, dayIndex, periodIndex)}
                      tabIndex={disabled ? -1 : 0}
                      role="gridcell"
                      aria-label={`${t(`days.${day}`)} ${t('common.periodNumber', { number: periodIndex + 1 })} - ${isUnavailable ? t('teachers.unavailable') : t('teachers.available')}`}
                      aria-pressed={isUnavailable}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AvailabilityLegend />
    </div>
  );
}

export default AvailabilityMatrix;
