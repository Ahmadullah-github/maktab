/** Grade-category metadata shared by subject, class, and assignment views. */

export interface SubjectDefinition {
  name: string;
  nameEn: string;
  code: string;
  periodsPerWeek: number;
  isDifficult?: boolean;
  requiredRoomType?: string;
  isCore?: boolean;
}

export type GradeCategory = 'Alpha-Primary' | 'Beta-Primary' | 'Middle' | 'High';

export interface GradeCategoryInfo {
  category: GradeCategory;
  grades: number[];
  totalPeriods: number;
  description: string;
  descriptionFa: string;
}

export const GRADE_CATEGORIES: Record<GradeCategory, GradeCategoryInfo> = {
  'Alpha-Primary': {
    category: 'Alpha-Primary',
    grades: [1, 2, 3],
    totalPeriods: 24,
    description: 'Primary School (Grades 1-3)',
    descriptionFa: 'ابتدایی الف (صنف ۱-۳)',
  },
  'Beta-Primary': {
    category: 'Beta-Primary',
    grades: [4, 5, 6],
    totalPeriods: 32,
    description: 'Primary School (Grades 4-6)',
    descriptionFa: 'ابتدایی ب (صنف ۴-۶)',
  },
  Middle: {
    category: 'Middle',
    grades: [7, 8, 9],
    totalPeriods: 36,
    description: 'Middle School (Grades 7-9)',
    descriptionFa: 'متوسطه (صنف ۷-۹)',
  },
  High: {
    category: 'High',
    grades: [10, 11, 12],
    totalPeriods: 36,
    description: 'High School (Grades 10-12)',
    descriptionFa: 'لیسه (صنف ۱۰-۱۲)',
  },
};

export function getGradeCategory(grade: number): GradeCategory | null {
  if (grade >= 1 && grade <= 3) return 'Alpha-Primary';
  if (grade >= 4 && grade <= 6) return 'Beta-Primary';
  if (grade >= 7 && grade <= 9) return 'Middle';
  if (grade >= 10 && grade <= 12) return 'High';
  return null;
}

export function getExpectedTotalPeriods(grade: number): number {
  const category = getGradeCategory(grade);
  return category ? GRADE_CATEGORIES[category].totalPeriods : 0;
}
