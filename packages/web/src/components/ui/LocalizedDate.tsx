import { cn } from '@/lib/utils';
import { formatLocalizedDateWithLunar } from '@/lib/datePresentation';
import { useTranslation } from 'react-i18next';

interface LocalizedDateProps {
  value: string | Date;
  timezone?: string;
  className?: string;
  showLunar?: boolean;
  options?: Intl.DateTimeFormatOptions;
}

export function LocalizedDate({
  value,
  timezone,
  className,
  showLunar = true,
  options,
}: LocalizedDateProps) {
  const { t, i18n } = useTranslation();
  const dates = formatLocalizedDateWithLunar(
    value,
    i18n.resolvedLanguage ?? i18n.language,
    options,
    timezone
  );
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span>{dates.primary}</span>
      {showLunar ? (
        <span className="text-xs text-muted-foreground">
          {t('calendar.lunarCalculated')}: {dates.lunar}
        </span>
      ) : null}
    </span>
  );
}
