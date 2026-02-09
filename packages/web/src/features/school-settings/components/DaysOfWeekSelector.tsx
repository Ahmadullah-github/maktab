/**
 * DaysOfWeekSelector Component
 *
 * Interactive toggle buttons for selecting days of the week
 * Uses translated day names from i18n
 * Applies Afghan week defaults (Saturday-Thursday)
 *
 * Requirements: 1.3, 7.4, 8.1
 */

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
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
 * DaysOfWeekSelector - Interactive toggle buttons for days of the week
 *
 * Renders all seven days as toggle buttons with visual feedback
 * Requirements: 1.3, 7.4, 8.1
 */
export function DaysOfWeekSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DaysOfWeekSelectorProps) {
  const { t } = useTranslation();

  const handleDayToggle = (day: WeekDay) => {
    if (disabled) return;

    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {ALL_WEEK_DAYS.map((day) => {
        const isActive = value.includes(day);
        const dayLabel = t(`days.${day}`);
        const dayShort = t(`days.${day}Short`, day.slice(0, 3));

        return (
          <button
            key={day}
            type="button"
            onClick={() => handleDayToggle(day)}
            disabled={disabled}
            aria-label={dayLabel}
            aria-pressed={isActive}
            className={cn(
              'flex-1 min-w-[70px] p-3 rounded-xl border-2 transition-all duration-200',
              'flex flex-col items-center gap-1 text-center',
              'hover:border-primary/30 hover:bg-muted/50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive && 'border-primary bg-primary/10',
              !isActive && 'border-border bg-card',
              disabled && 'opacity-50 cursor-not-allowed hover:border-border hover:bg-card'
            )}
          >
            <span
              className={cn('text-sm font-semibold', isActive ? 'text-primary' : 'text-foreground')}
            >
              {dayLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">{dayShort}</span>
            <div
              className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center mt-1 transition-all',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-transparent'
              )}
            >
              {isActive && <Check className="w-3 h-3" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
