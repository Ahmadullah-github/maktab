import { describe, expect, it } from 'vitest';
import {
  activeGrades,
  categoryForGrade,
  parsePastedSubjects,
} from '../components/SchoolCurriculumPage';
import en from '../i18n/en.json';
import fa from '../i18n/fa.json';

function translationKeys(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null
      ? translationKeys(child as object, path)
      : [path];
  });
}

describe('school curriculum helpers', () => {
  it('derives only active school grades', () => {
    expect(activeGrades({ enablePrimary: false, enableMiddle: true, enableHigh: true })).toEqual([
      7, 8, 9, 10, 11, 12,
    ]);
  });

  it('maps grade bands to period categories', () => {
    expect([1, 4, 7, 10].map(categoryForGrade)).toEqual([
      'Alpha-Primary',
      'Beta-Primary',
      'Middle',
      'High',
    ]);
  });

  it('parses tab-separated and compact comma-separated rows', () => {
    const rows = parsePastedSubjects('ترکی\tTurkish\tTR7\t1\nهنر,ART7,2');
    expect(
      rows.map(({ name, nameEn, code, periodsPerWeek }) => ({ name, nameEn, code, periodsPerWeek }))
    ).toEqual([
      { name: 'ترکی', nameEn: 'Turkish', code: 'TR7', periodsPerWeek: 1 },
      { name: 'هنر', nameEn: undefined, code: 'ART7', periodsPerWeek: 2 },
    ]);
  });

  it('keeps English and Dari curriculum translations in sync', () => {
    expect(translationKeys(fa)).toEqual(translationKeys(en));
    expect(fa.pageTitle).toBe('نصاب تعلیمی مکتب');
    expect(en.pageTitle).toBe('School Curriculum');
  });
});
