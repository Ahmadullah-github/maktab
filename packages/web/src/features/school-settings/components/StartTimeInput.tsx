/**
 * StartTimeInput Component
 *
 * Renders a time picker with HH:mm format
 * Sets default value from constants (07:30)
 *
 * Requirements: 1.4
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
  /** Placeholder text */
  placeholder?: string;
}

/**
 * StartTimeInput - Time picker for school start time
 *
 * Uses native HTML time input for HH:mm format
 * Default value is 07:30 from constants
 *
 * Requirements: 1.4
 */
export function StartTimeInput({
  value,
  onChange,
  disabled = false,
  className,
  placeholder,
}: StartTimeInputProps) {
  return (
    <Input
      type="time"
      value={value || DEFAULT_START_TIME}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn('w-32', className)}
      placeholder={placeholder}
      aria-label="School start time"
    />
  );
}
