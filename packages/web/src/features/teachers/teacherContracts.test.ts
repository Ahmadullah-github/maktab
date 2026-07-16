import { describe, expect, it } from 'vitest';

import { teacherFormSchema } from '@/schemas/teacher.schema';
import en from './i18n/en.json';
import fa from './i18n/fa.json';
import { filterTeachersByStatus } from './hooks/useTeacherFilters';
import { validateImportedTeachers } from './hooks/useBulkImportTeachers';
import type { Teacher } from './types';

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key)
  );
}

const baseTeacher: Teacher = {
  id: 1,
  schoolId: null,
  fullName: 'Ahmad Ahmadi',
  staffCode: 'T-00001',
  employmentType: 'part_time',
  primarySubjectIds: [],
  allowedSubjectIds: [],
  restrictToPrimarySubjects: true,
  availability: {},
  unavailable: [],
  maxPeriodsPerWeek: 42,
  maxPeriodsPerDay: 7,
  maxConsecutivePeriods: 2,
  timePreference: 'any',
  preferredRoomIds: [],
  preferredColleagues: [],
  classAssignments: [],
  meta: {},
  isDeleted: false,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
};

describe('teacher client contracts', () => {
  it('treats zero weekly capacity as a valid cannot-teach limit', () => {
    const result = teacherFormSchema.safeParse({
      fullName: '  Ahmad Ahmadi  ',
      staffCode: ' t 001 ',
      employmentType: 'full_time',
      primarySubjectIds: [],
      allowedSubjectIds: [],
      restrictToPrimarySubjects: true,
      unavailable: [],
      maxPeriodsPerWeek: 0,
      maxPeriodsPerDay: 1,
      maxConsecutivePeriods: 1,
      timePreference: 'any',
      preferredRoomIds: [],
      preferredColleagues: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe('Ahmad Ahmadi');
      expect(result.data.staffCode).toBe('T-001');
    }
  });

  it('uses explicit employment type instead of inferred workload', () => {
    expect(filterTeachersByStatus([baseTeacher], 'fullTime', 42)).toEqual([]);
    expect(filterTeachersByStatus([baseTeacher], 'partTime', 42)).toEqual([baseTeacher]);
  });

  it('keeps English and Farsi teacher catalogs in parity', () => {
    expect(keys(en).sort()).toEqual(keys(fa).sort());
  });

  it('uses the configured calendar capacity for imported teachers', () => {
    const result = validateImportedTeachers(
      [{ fullName: 'Ahmad Ahmadi', staffCode: 'T-IMPORT-1' }],
      [],
      new Map(),
      { maxPeriodsPerWeek: 34, maxPeriodsPerDay: 6 }
    );

    expect(result.errors).toEqual([]);
    expect(result.valid[0]).toMatchObject({
      maxPeriodsPerWeek: 34,
      maxPeriodsPerDay: 6,
    });
  });

  it('normalizes an imported workload above the configured calendar and reports it', () => {
    const result = validateImportedTeachers(
      [{ fullName: 'Ahmad Ahmadi', staffCode: 'T-IMPORT-2', maxPeriodsPerWeek: 35 }],
      [],
      new Map(),
      { maxPeriodsPerWeek: 34, maxPeriodsPerDay: 6 }
    );

    expect(result.errors).toEqual([
      expect.objectContaining({ field: 'maxPeriodsPerWeek', value: '35' }),
    ]);
    expect(result.valid[0]?.maxPeriodsPerWeek).toBe(34);
  });
});
