/**
 * TimezoneSelector Component
 *
 * Enhanced dropdown with timezone options from constants
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
import { Globe } from 'lucide-react';
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
 * TimezoneSelector - Enhanced dropdown for timezone selection
 *
 * Features globe icon and clean styling
 * Requirements: 1.5, 8.5
 */
export function TimezoneSelector({
  value,
  onChange,
  disabled = false,
  className,
}: TimezoneSelectorProps) {
  const { t } = useTranslation();
  const currentValue = value || DEFAULT_TIMEZONE;

  return (
    <div className={cn('relative', className)}>
      <Globe className="absolute start-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10 pointer-events-none" />
      <Select
        value={currentValue}
        onValueChange={(val: string) => onChange(val)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            'h-12 ps-12 text-base',
            'border-2 rounded-xl',
            'focus:border-primary focus:ring-4 focus:ring-primary/20'
          )}
          aria-label={t('schoolSettings.labels.timezone')}
        >
          <SelectValue placeholder={t('schoolSettings.placeholders.selectTimezone')} />
        </SelectTrigger>
        <SelectContent>
          {VALID_TIMEZONES.map((tz) => (
            <SelectItem key={tz.value} value={tz.value} className="text-base py-3">
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
