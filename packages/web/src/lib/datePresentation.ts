export type PrimaryCalendar = 'gregory' | 'persian';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getPrimaryCalendar(language: string): PrimaryCalendar {
  return language.toLowerCase().startsWith('en') ? 'gregory' : 'persian';
}

export function getCalendarLocale(
  language: string,
  calendar: PrimaryCalendar | 'islamic-civil'
): string {
  const normalizedLanguage = language.toLowerCase();
  const isEnglish = normalizedLanguage.startsWith('en');
  const base = isEnglish ? 'en-US' : normalizedLanguage.startsWith('ps') ? 'ps-AF' : 'fa-AF';
  const numbering = isEnglish ? 'latn' : 'arabext';
  return `${base}-u-ca-${calendar}-nu-${numbering}`;
}

export function normalizeDateDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

function dateValue(value: string | Date): { date: Date; dateOnly: boolean } | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : { date: value, dateOnly: false };
  }
  const match = DATE_ONLY.exec(value);
  const date = new Date(match ? `${value}T12:00:00.000Z` : value);
  return Number.isNaN(date.getTime()) ? null : { date, dateOnly: Boolean(match) };
}

export function formatLocalizedDate(
  value: string | Date,
  language: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  timezone = 'Asia/Kabul'
): string {
  const parsed = dateValue(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat(getCalendarLocale(language, getPrimaryCalendar(language)), {
    ...options,
    timeZone: parsed.dateOnly ? 'UTC' : timezone,
  }).format(parsed.date);
}

export function formatLunarCivilDate(
  value: string | Date,
  language: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' },
  timezone = 'Asia/Kabul'
): string {
  const parsed = dateValue(value);
  if (!parsed) return '—';
  return new Intl.DateTimeFormat(getCalendarLocale(language, 'islamic-civil'), {
    ...options,
    timeZone: parsed.dateOnly ? 'UTC' : timezone,
  }).format(parsed.date);
}

export function formatLocalizedDateWithLunar(
  value: string | Date,
  language: string,
  options?: Intl.DateTimeFormatOptions,
  timezone?: string
) {
  return {
    primary: formatLocalizedDate(value, language, options, timezone),
    lunar: formatLunarCivilDate(value, language, options, timezone),
  };
}

function numericCalendarParts(date: Date, calendar: PrimaryCalendar): [number, number, number] {
  const parts = new Intl.DateTimeFormat(`en-US-u-ca-${calendar}-nu-latn`, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return [value('year'), value('month'), value('day')];
}

export function isoToSolar(isoDate: string): { year: number; month: number; day: number } | null {
  if (!DATE_ONLY.test(isoDate)) return null;
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const [year, month, day] = numericCalendarParts(date, 'persian');
  return { year, month, day };
}

function compareParts(left: [number, number, number], right: [number, number, number]): number {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

export function solarToIso(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  if (!Number.isInteger(day) || day < 1 || day > 31 || (month > 6 && day > 30)) return null;

  const target: [number, number, number] = [year, month, day];
  let low = Math.floor(Date.UTC(year + 620, 0, 1) / 86_400_000);
  let high = Math.floor(Date.UTC(year + 623, 0, 1) / 86_400_000);

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const date = new Date(middle * 86_400_000 + 12 * 3_600_000);
    const comparison = compareParts(numericCalendarParts(date, 'persian'), target);
    if (comparison === 0) return date.toISOString().slice(0, 10);
    if (comparison < 0) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

export function gregorianPartsToIso(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}
