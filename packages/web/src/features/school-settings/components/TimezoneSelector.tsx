/**
 * TimezoneSelector Component
 *
 * Renders a dropdown with timezone options from constants
 * Sets default to Asia/Kabul
 *
 * Requirements: 1.5, 8.5
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TIMEZONE, VALID_TIMEZONES } from '../constants/defaults';

interface TimezoneSelectorProps {
  /** Currently selected timezone */
  value: string;
  /** Callback when timezone changes */
  onChange: (timezone: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * TimezoneSelector - Dropdown for timezone selection
 *
 * Uses timezone options from constants with Farsi labels
 * Default is Asia/Kabul
 *
 * Requirements: 1.5, 8.5
 */
export function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  className,
}: TimezoneSelectorProps) {
  const { t } = useTranslation();

  return (
    <Select
      value={value || DEFAULT_TIMEZONE}
      onValueChange={(val: string) => onChange(val)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-48', className)} aria-label="Timezone selector">
        <SelectValue placeholder={t('schoolSettings.placeholders.selectTimezone')} />
      </SelectTrigger>
      <SelectContent>
        {VALID_TIMEZONES.map((tz) => (
          <SelectItem key={tz.value} value={tz.value}>
            {tz.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
