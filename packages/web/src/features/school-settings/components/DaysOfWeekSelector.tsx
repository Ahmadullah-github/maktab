/**
 * DaysOfWeekSelector Component
 *
 * Renders checkboxes for all seven days of the week
 * Uses translated day names from i18n
 * Applies Afghan week defaults (Saturday-Thursday)
 *
 * Requirements: 1.3, 7.4, 8.1
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { ALL_WEEK_DAYS, type WeekDay } from '../constants/defaults';

interface DaysOfWeekSelectorProps {
  /** Currently selected days */
  value: WeekDay[];
  /** Callback when selection changes */
  onChange: (days: WeekDay[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * DaysOfWeekSelector - Multi-select checkboxes for days of the week
 *
 * Renders all seven days from constants with translated labels
 * Requirements: 1.3, 7.4, 8.1
 */
export function DaysOfWeekSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DaysOfWeekSelectorProps) {
  const { t } = useTranslation();

  const handleDayToggle = (day: WeekDay, checked: boolean) => {
    if (checked) {
      onChange([...value, day]);
    } else {
      onChange(value.filter((d) => d !== day));
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-4', className)}>
      {ALL_WEEK_DAYS.map((day) => {
        const isChecked = value.includes(day);
        const dayLabel = t(`days.${day}`);

        return (
          <div key={day} className="flex items-center gap-2">
            <Checkbox
              id={`day-${day}`}
              checked={isChecked}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                handleDayToggle(day, checked === true)
              }
              disabled={disabled}
              aria-label={dayLabel}
            />
            <Label
              htmlFor={`day-${day}`}
              className={cn(
                'cursor-pointer select-none text-sm',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              {dayLabel}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
