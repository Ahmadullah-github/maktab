import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  formatLunarCivilDate,
  getPrimaryCalendar,
  gregorianPartsToIso,
  isoToSolar,
  normalizeDateDigits,
  solarToIso,
} from '@/lib/datePresentation';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DateParts {
  year: string;
  month: string;
  day: string;
}

interface LocalizedDateFieldProps {
  label: string;
  value: string | null;
  onChange: (isoDate: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
}

function partsFromValue(value: string | null, calendar: 'gregory' | 'persian'): DateParts {
  if (!value) return { year: '', month: '', day: '' };
  if (calendar === 'persian') {
    const solar = isoToSolar(value);
    return solar
      ? { year: String(solar.year), month: String(solar.month), day: String(solar.day) }
      : { year: '', month: '', day: '' };
  }
  const [year, month, day] = value.split('-');
  return { year: year ?? '', month: month ?? '', day: day ?? '' };
}

export function LocalizedDateField({
  label,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
}: LocalizedDateFieldProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const calendar = getPrimaryCalendar(i18n.resolvedLanguage ?? i18n.language);
  const [parts, setParts] = useState(() => partsFromValue(value, calendar));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setParts(partsFromValue(value, calendar)), [calendar, value]);

  const update = (key: keyof DateParts, nextValue: string) => {
    const next = { ...parts, [key]: normalizeDateDigits(nextValue).replace(/\D/g, '') };
    setParts(next);
    if (!next.year && !next.month && !next.day) {
      setError(required ? t('calendar.required') : null);
      onChange(null);
      return;
    }
    if (!next.year || !next.month || !next.day) return;
    const numbers = [Number(next.year), Number(next.month), Number(next.day)] as const;
    const iso =
      calendar === 'persian'
        ? solarToIso(...numbers)
        : gregorianPartsToIso(...numbers);
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setError(t('calendar.invalidDate'));
      return;
    }
    setError(null);
    onChange(iso);
  };

  return (
    <fieldset className="space-y-2" disabled={disabled} aria-describedby={`${id}-help`}>
      <legend className="text-sm font-medium">
        {label}{required ? <span className="ms-1 text-destructive">*</span> : null}
      </legend>
      <div className="grid grid-cols-3 gap-2" dir="ltr">
        {(['year', 'month', 'day'] as const).map((part) => (
          <div key={part} className="space-y-1">
            <Label className="text-xs" htmlFor={`${id}-${part}`}>{t(`calendar.${part}`)}</Label>
            <Input
              id={`${id}-${part}`}
              inputMode="numeric"
              value={parts[part]}
              maxLength={part === 'year' ? 4 : 2}
              aria-invalid={Boolean(error)}
              onChange={(event) => update(part, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div id={`${id}-help`} className="text-xs text-muted-foreground">
        <div>{calendar === 'persian' ? t('calendar.solarHijri') : t('calendar.gregorian')}</div>
        {value ? <div>{t('calendar.lunarCalculated')}: {formatLunarCivilDate(value, i18n.resolvedLanguage ?? i18n.language)}</div> : null}
        {error ? <div className="text-destructive" role="alert">{error}</div> : null}
      </div>
    </fieldset>
  );
}
