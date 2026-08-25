import { describe, expect, it } from 'vitest';
import { parseCurriculumPaste, validateGradeDraft } from './SchoolCurriculumPage';

describe('school curriculum draft contracts', () => {
  it('parses spreadsheet rows in the documented column order', () => {
    const result = parseCurriculumPaste(
      'ترکی\tTurkish\tTR7\t2\ttrue\tcomputer_lab\nهنر,Art,ART7,1,false,'
    );

    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      name: 'ترکی',
      nameEn: 'Turkish',
      code: 'TR7',
      weeklyPeriods: 2,
      isDifficult: true,
      requiredRoomType: 'computer_lab',
    });
  });

  it('reports missing, duplicated, and invalid row values', () => {
    const result = parseCurriculumPaste(
      'بدون کد\tNo code\t\t0\tmaybe\nتکراری\tDuplicate\tDUP\t2\tfalse\nدوباره\tAgain\tdup\t3\tfalse'
    );

    expect(result.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(['code', 'weeklyPeriods', 'isDifficult'])
    );
    expect(result.issues.some((issue) => issue.message.includes('تکرار'))).toBe(true);
  });

  it('accepts school-specific manual subjects without template metadata', () => {
    expect(
      validateGradeDraft([
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'ترکی',
          nameEn: null,
          code: 'TR9',
          normalizedCode: 'tr9',
          weeklyPeriods: 1,
          isDifficult: false,
          requiredRoomType: null,
        },
      ])
    ).toEqual([]);
  });
});
