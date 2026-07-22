export type PresentationLanguage = 'fa' | 'en';

const DEFAULT_TIME_ZONE = 'Asia/Kabul';

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(dateOnly ? `${value}T12:00:00.000Z` : value);
}

export function formatExportDate(
  value: string | Date,
  language: PresentationLanguage,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  const locale = language === 'fa' ? 'fa-AF-u-ca-persian' : 'en-US-u-ca-gregory';
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(toDate(value));
}

export function formatLunarCivilDate(
  value: string | Date,
  language: PresentationLanguage,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' }
): string {
  const locale = language === 'fa' ? 'fa-AF-u-ca-islamic-civil' : 'en-US-u-ca-islamic-civil';
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: DEFAULT_TIME_ZONE,
  }).format(toDate(value));
}

export function formatExportDateWithLunar(
  value: string | Date,
  language: PresentationLanguage,
  options?: Intl.DateTimeFormatOptions
): { primary: string; lunar: string } {
  return {
    primary: formatExportDate(value, language, options),
    lunar: formatLunarCivilDate(value, language, options),
  };
}
