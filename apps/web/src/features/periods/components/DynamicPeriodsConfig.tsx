/**
 * DynamicPeriodsConfig Component
 *
 * Shows day-by-day period count inputs when enabled
 * Uses active days from school settings
 *
 * Requirements: 3.1, 3.2, 10.1
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WeekDay } from '@/features/school-settings/constants/defaults';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { PERIOD_LIMITS } from '../constants/defaults';
import type { PeriodsPerDayMap } from '../types';

interface DynamicPeriodsConfigProps {
  /** Whether dynamic periods is enabled */
  enabled: boolean;
  /** Map of day to period count */
  periodsPerDayMap: PeriodsPerDayMap;
  /** Callback when periods per day map changes */
  onPeriodsPerDayMapChange: (map: PeriodsPerDayMap) => void;
  /** Active school days from school settings */
  activeDays: WeekDay[];
  /** Default periods per day (used as initial value for each day) */
  defaultPeriods: number;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Validation errors for specific days */
  errors?: Partial<Record<WeekDay, string>>;
}

/**
 * DynamicPeriodsConfig - Day-by-day period configuration
 *
 * Shows an input for each active school day when enabled
 * Uses translated day names from i18n
 *
 * Requirements: 3.1, 3.2, 10.1
 */
export function DynamicPeriodsConfig({
  enabled,
  periodsPerDayMap,
  onPeriodsPerDayMapChange,
  activeDays,
  defaultPeriods,
  disabled = false,
  className,
  errors,
}: DynamicPeriodsConfigProps) {
  const { t } = useTranslation();

  const handleDayPeriodChange = (day: WeekDay, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onPeriodsPerDayMapChange({
        ...periodsPerDayMap,
        [day]: numValue,
      });
    }
  };

  const getDayPeriods = (day: WeekDay): number => {
    return periodsPerDayMap[day] ?? defaultPeriods;
  };

  // Don't render anything if not enabled
  if (!enabled) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Help text */}
      <p className="text-sm text-muted-foreground">{t('periodStructure.help.dynamicPeriods')}</p>

      {/* Day-by-day inputs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {activeDays.map((day) => {
          const error = errors?.[day];
          return (
            <div key={day} className="flex flex-col gap-1">
              <Label htmlFor={`period-${day}`} className="text-sm">
                {t(`days.${day.toLowerCase()}`)}
              </Label>
              <Input
                id={`period-${day}`}
                type="number"
                value={getDayPeriods(day)}
                onChange={(e) => handleDayPeriodChange(day, e.target.value)}
                min={PERIOD_LIMITS.MIN}
                max={PERIOD_LIMITS.MAX}
                disabled={disabled}
                className={cn('w-full', error && 'border-destructive')}
                aria-invalid={!!error}
                aria-describedby={error ? `period-${day}-error` : undefined}
              />
              {error && (
                <span id={`period-${day}-error`} className="text-xs text-destructive">
                  {error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
