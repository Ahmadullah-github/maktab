/**
 * HoursIndicator Component
 *
 * Displays filled hours / max hours with a visual progress indicator
 * Shows the ratio of assigned teaching hours to maximum allowed hours
 *
 * Requirements: 1.1
 */

import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface HoursIndicatorProps {
  /** Number of hours currently filled/assigned */
  filledHours: number;
  /** Maximum hours allowed */
  maxHours: number;
  /** Optional additional CSS classes */
  className?: string;
  /** Whether to show the progress bar (default: true) */
  showProgressBar?: boolean;
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * HoursIndicator displays a filled/max hours ratio with progress bar
 *
 * @example
 * ```tsx
 * <HoursIndicator filledHours={18} maxHours={24} />
 * <HoursIndicator filledHours={24} maxHours={24} showProgressBar={false} />
 * ```
 */
export function HoursIndicator({
  filledHours,
  maxHours,
  className,
  showProgressBar = true,
  size = 'sm',
}: HoursIndicatorProps) {
  const { t } = useTranslation();

  // Calculate percentage (capped at 100%)
  const percentage = maxHours > 0 ? Math.min((filledHours / maxHours) * 100, 100) : 0;

  // Determine color based on fill level
  const getProgressColor = () => {
    if (percentage >= 100) return 'bg-red-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (percentage >= 100) return 'text-red-700';
    if (percentage >= 80) return 'text-amber-700';
    return 'text-gray-700';
  };

  const sizeClasses = {
    sm: {
      container: 'min-w-[80px]',
      text: 'text-xs',
      bar: 'h-1.5',
    },
    md: {
      container: 'min-w-[100px]',
      text: 'text-sm',
      bar: 'h-2',
    },
  };

  const label = t('common.hoursPerWeek');

  return (
    <div
      className={cn('flex flex-col gap-1', sizeClasses[size].container, className)}
      title={label}
      aria-label={`${filledHours} / ${maxHours} ${label}`}
    >
      {/* Hours text */}
      <div className={cn('flex items-center justify-between', sizeClasses[size].text)}>
        <span className={cn('font-medium tabular-nums', getTextColor())}>
          {filledHours} / {maxHours}
        </span>
      </div>

      {/* Progress bar */}
      {showProgressBar && (
        <div
          className={cn('w-full rounded-full bg-gray-200 overflow-hidden', sizeClasses[size].bar)}
          role="progressbar"
          aria-valuenow={filledHours}
          aria-valuemin={0}
          aria-valuemax={maxHours}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-300', getProgressColor())}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default HoursIndicator;
