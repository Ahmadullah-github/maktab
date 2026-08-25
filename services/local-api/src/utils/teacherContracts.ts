export const TEACHER_EMPLOYMENT_TYPES = ['full_time', 'part_time'] as const;
export type TeacherEmploymentType = (typeof TEACHER_EMPLOYMENT_TYPES)[number];

export const TEACHER_TIME_PREFERENCES = ['any', 'morning', 'afternoon'] as const;
export type TeacherTimePreference = (typeof TEACHER_TIME_PREFERENCES)[number];

export interface TeacherUnavailableSlot {
  day: string;
  period: number;
}

export function normalizeTeacherName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

export function normalizeTeacherStaffCode(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, '-').toUpperCase();
}

export function normalizeUnavailableSlots(value: unknown[]): TeacherUnavailableSlot[] {
  const seen = new Set<string>();
  const result: TeacherUnavailableSlot[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') continue;
    const record = candidate as Record<string, unknown>;
    const day = typeof record.day === 'string' ? record.day.trim() : '';
    const period = typeof record.period === 'number' ? record.period : Number.NaN;
    if (!day || !Number.isInteger(period) || period < 0) continue;
    const key = `${day.toLowerCase()}:${period}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ day, period });
  }
  return result.sort((a, b) => a.day.localeCompare(b.day) || a.period - b.period);
}
