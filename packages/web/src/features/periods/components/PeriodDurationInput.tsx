/**
 * PeriodDurationInput Component
 *
 * Renders a number input for period duration in minutes
 * Sets default value from constants (45)
 *
 * Requirements: 2.4
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { DURATION_LIMITS } from '../constants/defaults';

interface PeriodDurationInputProps {
  /** Current duration value in minutes */
  value: number;
  /** Callback when duration changes */
  onChange: (duration: number) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Error message to display */
  error?: string;
}

/**
 * PeriodDurationInput - Number input for period duration in minutes
 *
 * Uses configurable min/max constants from DURATION_LIMITS
 * Default value is 45 minutes from constants
 *
 * Requirements: 2.4
 */
export function PeriodDurationInput({
  value,
  onChange,
  disabled = false,
  className,
  error,
}: PeriodDurationInputProps) {
  const { t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value ?? DURATION_LIMITS.DEFAULT}
          onChange={handleChange}
          min={DURATION_LIMITS.MIN}
          max={DURATION_LIMITS.MAX}
          disabled={disabled}
          className={cn('w-24', error && 'border-destructive', className)}
          aria-label="Period duration in minutes"
          aria-invalid={!!error}
          aria-describedby={error ? 'period-duration-error' : undefined}
        />
        <span className="text-sm text-muted-foreground">{t('periodStructure.labels.minutes')}</span>
      </div>
      {error && (
        <span id="period-duration-error" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
