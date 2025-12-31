/**
 * DefaultPeriodsInput Component
 *
 * Renders a number input with min/max from constants
 * Sets default value from constants (7)
 *
 * Requirements: 2.3, 8.4
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PERIOD_LIMITS } from '../constants/defaults';

interface DefaultPeriodsInputProps {
  /** Current period count value */
  value: number;
  /** Callback when period count changes */
  onChange: (periods: number) => void;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Error message to display */
  error?: string;
}

/**
 * DefaultPeriodsInput - Number input for default periods per day
 *
 * Uses configurable min/max constants from PERIOD_LIMITS
 * Default value is 7 from constants
 *
 * Requirements: 2.3, 8.4
 */
export function DefaultPeriodsInput({
  value,
  onChange,
  disabled = false,
  className,
  error,
}: DefaultPeriodsInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(newValue);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Input
        type="number"
        value={value ?? PERIOD_LIMITS.DEFAULT}
        onChange={handleChange}
        min={PERIOD_LIMITS.MIN}
        max={PERIOD_LIMITS.MAX}
        disabled={disabled}
        className={cn('w-24', error && 'border-destructive', className)}
        aria-label="Default periods per day"
        aria-invalid={!!error}
        aria-describedby={error ? 'default-periods-error' : undefined}
      />
      {error && (
        <span id="default-periods-error" className="text-sm text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
