/**
 * StartTimeInput Component
 *
 * Enhanced time picker with visual feedback
 * Sets default value from constants (07:30)
 *
 * Requirements: 1.4
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_START_TIME } from '../constants/defaults';

interface StartTimeInputProps {
  /** Current time value in HH:mm format */
  value: string;
  /** Callback when time changes */
  onChange: (time: string) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Converts 24h time to period (AM/PM equivalent in Farsi)
 */
function getTimePeriod(time: string): 'morning' | 'afternoon' {
  const hour = parseInt(time.split(':')[0], 10);
  return hour < 12 ? 'morning' : 'afternoon';
}

/**
 * StartTimeInput - Enhanced time picker for school start time
 *
 * Features clock icon and period indicator
 * Requirements: 1.4
 */
export function StartTimeInput({
  value,
  onChange,
  disabled = false,
  className,
}: StartTimeInputProps) {
  const { t } = useTranslation();
  const currentValue = value || DEFAULT_START_TIME;
  const period = getTimePeriod(currentValue);

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Time Input with Icon */}
      <div className="relative flex-1">
        <Clock className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <Input
          type="time"
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'h-12 text-lg font-semibold text-center ps-12',
            'border-2 rounded-xl',
            'focus:border-primary focus:ring-4 focus:ring-primary/20'
          )}
          aria-label={t('schoolSettings.labels.startTime')}
        />
      </div>

      {/* Period Indicator - Horizontal layout */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[60px]',
            period === 'morning'
              ? 'bg-amber-500 text-white shadow-md'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          )}
        >
          {t('schoolSettings.labels.morning')}
        </button>
        <button
          type="button"
          disabled
          className={cn(
            'px-4 py-2.5 rounded-lg text-sm font-semibold transition-all min-w-[60px]',
            period === 'afternoon'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          )}
        >
          {t('schoolSettings.labels.afternoon')}
        </button>
      </div>
    </div>
  );
}
