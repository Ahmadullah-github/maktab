import { toJalaali } from "jalaali-js";
import momentHijri from "moment-hijri";

export type CalendarStrings = {
  time: string;
  gregorian: string;
  jalali: string;
  hijri: string;
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatGregorian(date: Date, useArabicDigits: boolean): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return localizeDigits(`${y}-${m}-${d}`, useArabicDigits);
}

export function formatJalali(date: Date, useArabicDigits: boolean): string {
  const j = toJalaali(date);
  const y = j.jy;
  const m = pad2(j.jm);
  const d = pad2(j.jd);
  return localizeDigits(`${y}-${m}-${d}`, useArabicDigits);
}

export function formatHijri(date: Date, useArabicDigits: boolean): string {
  const m = momentHijri(date);
  const y = m.iYear();
  const mo = pad2(m.iMonth() + 1);
  const d = pad2(m.iDate());
  return localizeDigits(`${y}-${mo}-${d}`, useArabicDigits);
}

export function formatTime(date: Date, useArabicDigits: boolean): string {
  const h = pad2(date.getHours());
  const mi = pad2(date.getMinutes());
  return localizeDigits(`${h}:${mi}`, useArabicDigits);
}

export function localizeDigits(input: string, useArabicDigits: boolean): string {
  if (!useArabicDigits) return input;
  const map: Record<string, string> = {
    "0": "۰",
    "1": "۱",
    "2": "۲",
    "3": "۳",
    "4": "۴",
    "5": "۵",
    "6": "۶",
    "7": "۷",
    "8": "۸",
    "9": "۹",
  };
  return input.replace(/[0-9]/g, (d) => map[d]);
}

// Export a general number formatter for statistics and counts
export function formatNumber(value: number | string, useArabicDigits: boolean): string {
  return localizeDigits(String(value), useArabicDigits);
}

export function getCalendarStrings(now: Date, useArabicDigits: boolean): CalendarStrings {
  return {
    time: formatTime(now, useArabicDigits),
    gregorian: formatGregorian(now, useArabicDigits),
    jalali: formatJalali(now, useArabicDigits),
    hijri: formatHijri(now, useArabicDigits),
  };
}


