import { describe, expect, it } from 'vitest';
import {
  formatLocalizedDate,
  getPrimaryCalendar,
  gregorianPartsToIso,
  isoToSolar,
  normalizeDateDigits,
  solarToIso,
} from './datePresentation';

describe('date presentation calendars', () => {
  it('selects Gregorian only for English and Solar Hijri for local languages', () => {
    expect(getPrimaryCalendar('en')).toBe('gregory');
    expect(getPrimaryCalendar('fa-AF')).toBe('persian');
    expect(getPrimaryCalendar('ps')).toBe('persian');
  });

  it('round-trips the first day of Solar Hijri 1405 through ISO storage', () => {
    expect(isoToSolar('2026-03-21')).toEqual({ year: 1405, month: 1, day: 1 });
    expect(solarToIso(1405, 1, 1)).toBe('2026-03-21');
  });

  it('rejects impossible Gregorian and Solar Hijri dates', () => {
    expect(gregorianPartsToIso(2026, 2, 29)).toBeNull();
    expect(solarToIso(1404, 12, 30)).toBeNull();
  });

  it('keeps ISO date-only values stable across timezones', () => {
    const kabul = formatLocalizedDate('2026-03-21', 'en', undefined, 'Asia/Kabul');
    const newYork = formatLocalizedDate('2026-03-21', 'en', undefined, 'America/New_York');
    expect(kabul).toBe(newYork);
  });

  it('accepts Persian and Arabic-Indic digits from localized keyboards', () => {
    expect(normalizeDateDigits('۱۴۰۵/۰۱/۰۱')).toBe('1405/01/01');
    expect(normalizeDateDigits('١٤٠٥/٠١/٠١')).toBe('1405/01/01');
  });
});
